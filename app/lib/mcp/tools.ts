import "server-only";

import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import type {McpServer} from "@modelcontextprotocol/server";
import {z} from "zod";
import {CLASS_COLUMNS, classFromRow, classesOn, upcomingTests, type ClassRow} from "../classMeetings";
import {addDays, daysBetween, isDayKey} from "../days";
import {toMinutes} from "../time";

// What a connected AI (Claude, ChatGPT, ...) can do in Zeflo, over MCP: read the user's classes,
// tests, study sessions and progress, and plan, change or remove study sessions. Each call runs
// as the signed-in user with their OAuth token, so the database's row level security keeps it to
// their own data, exactly as in the app.

export const INSTRUCTIONS = `Zeflo is a calm study planner for students. It holds the user's class timetable (imported from their school, read-only here), their tests and exams, and the study sessions they plan around them, which they tick off as they finish.

Dates are the user's own calendar days ("YYYY-MM-DD") and times are their local 24-hour clock ("HH:MM"). Zeflo doesn't know the user's time zone, so use today's date as the user knows it.

When planning study time: call get_schedule first, avoid the user's classes and existing sessions, keep sessions between 25 and 120 minutes with short breaks between long stretches, and spread work for a test over the days before it rather than cramming. Name sessions after the course and the task, e.g. "MATH 135 · practice midterm". Briefly confirm the plan with the user before adding many sessions, and always before removing any.`;

const MAX_DAYS = 62; // per read: about two months
const MAX_ADD = 40;

const day = z
  .string()
  .refine(isDayKey, "Use a calendar day as YYYY-MM-DD.")
  .describe('A calendar day, "YYYY-MM-DD"');
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time as "HH:MM".')
  .describe('Local 24-hour time, "HH:MM"');
const subject = z.string().trim().min(1).max(200).describe('What the session is for, e.g. "CS 135 · assignment 4"');

type SessionRow = {
  id: string;
  day: string;
  subject: string;
  starts_at: string;
  ends_at: string;
  is_break: boolean;
  completed_at: string | null;
};
const SESSION_COLUMNS = "id, day, subject, starts_at, ends_at, is_break, completed_at";

const session = (r: SessionRow) => ({
  id: r.id,
  date: r.day,
  subject: r.subject,
  start: r.starts_at.slice(0, 5),
  end: r.ends_at.slice(0, 5),
  isBreak: r.is_break,
  done: r.completed_at !== null,
});

// A client that acts as the user who connected the AI (their OAuth access token).
export function supabaseFor(token: string): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: {headers: {Authorization: `Bearer ${token}`}},
    auth: {persistSession: false, autoRefreshToken: false},
  });
}

const reply = (data: unknown) => ({
  content: [{type: "text" as const, text: JSON.stringify(data, null, 2)}],
  structuredContent: data as Record<string, unknown>,
});
const fail = (message: string) => ({content: [{type: "text" as const, text: message}], isError: true});

// The token the AI signed in with, checked by withMcpAuth before any tool runs.
type Ctx = {http?: {authInfo?: {token: string}}};
const db = (ctx: Ctx) => {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("Not signed in.");
  return supabaseFor(token);
};

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);

export function registerTools(server: McpServer) {
  server.registerTool(
    "get_schedule",
    {
      title: "Get schedule",
      description:
        "The user's classes and study sessions for each day from `from` to `to` (inclusive, at most two months), plus their upcoming tests and exams. Call this before planning.",
      inputSchema: z.object({from: day, to: day}),
      annotations: {readOnlyHint: true},
    },
    async ({from, to}, ctx) => {
      if (to < from) return fail("`to` must be on or after `from`.");
      const days = daysBetween(from, to);
      if (days.length > MAX_DAYS) return fail(`Ask for at most ${MAX_DAYS} days at a time.`);
      const supabase = db(ctx);
      const [classes, sessions] = await Promise.all([
        supabase.from("class_meetings").select(CLASS_COLUMNS),
        supabase.from("study_sessions").select(SESSION_COLUMNS).gte("day", from).lte("day", to).order("day").order("starts_at"),
      ]);
      if (classes.error || sessions.error) return fail("Couldn't read the schedule. Try again.");
      const meetings = (classes.data as ClassRow[]).map(classFromRow);
      const rows = (sessions.data as SessionRow[]).map(session);

      return reply({
        days: days.map((d) => ({
          date: d,
          weekday: new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {weekday: "long"}),
          classes: classesOn(meetings, d).map((c) => ({
            course: c.code,
            title: c.title || undefined,
            kind: c.component || undefined,
            start: c.start,
            end: c.end,
            location: c.location || undefined,
            isTestOrExam: c.startsOn !== null && c.startsOn === c.endsOn,
          })),
          sessions: rows.filter((s) => s.date === d).map((s) => ({id: s.id, subject: s.subject, start: s.start, end: s.end, isBreak: s.isBreak, done: s.done})),
        })),
        upcomingTests: upcomingTests(meetings, from, 0).map((t) => ({
          course: t.code,
          title: t.title || t.component || "Test",
          date: t.startsOn,
          start: t.start,
          end: t.end,
          location: t.location || undefined,
        })),
      });
    },
  );

  server.registerTool(
    "add_study_sessions",
    {
      title: "Add study sessions",
      description: `Add up to ${MAX_ADD} study sessions (or breaks) to the user's calendar. Returns the new sessions with their ids, and notes any that overlap a class or another session.`,
      inputSchema: z.object({
        sessions: z
          .array(z.object({date: day, start: time, end: time, subject, isBreak: z.boolean().optional()}))
          .min(1)
          .max(MAX_ADD),
      }),
    },
    async ({sessions}, ctx) => {
      const bad = sessions.find((s) => toMinutes(s.end) <= toMinutes(s.start));
      if (bad) return fail(`"${bad.subject}" on ${bad.date} ends before it starts.`);
      const supabase = db(ctx);

      const first = sessions.reduce((a, s) => (s.date < a ? s.date : a), sessions[0].date);
      const last = sessions.reduce((a, s) => (s.date > a ? s.date : a), sessions[0].date);
      const [classes, existing] = await Promise.all([
        supabase.from("class_meetings").select(CLASS_COLUMNS),
        supabase.from("study_sessions").select(SESSION_COLUMNS).gte("day", first).lte("day", last),
      ]);
      const meetings = classes.error ? [] : (classes.data as ClassRow[]).map(classFromRow);
      const others = existing.error ? [] : (existing.data as SessionRow[]).map(session);

      const {data, error} = await supabase
        .from("study_sessions")
        .insert(
          sessions.map((s) => ({day: s.date, subject: s.subject, starts_at: s.start, ends_at: s.end, is_break: s.isBreak ?? false})),
        )
        .select(SESSION_COLUMNS);
      if (error) return fail("Couldn't add those sessions. Nothing was added.");

      const added = (data as SessionRow[]).map(session);
      const warnings = added.flatMap((s) => {
        const clash = [
          ...classesOn(meetings, s.date).filter((c) => overlaps(s.start, s.end, c.start, c.end)).map((c) => `${c.code} ${c.component}`.trim()),
          ...others.filter((o) => o.date === s.date && overlaps(s.start, s.end, o.start, o.end)).map((o) => o.subject),
        ];
        return clash.length ? [`"${s.subject}" on ${s.date} overlaps ${clash.join(", ")}`] : [];
      });
      return reply({added, warnings});
    },
  );

  server.registerTool(
    "update_study_session",
    {
      title: "Update a study session",
      description: "Change a study session's day, times, name or break flag, or mark it done or not done. Only the fields given change.",
      inputSchema: z.object({
        id: z.string().uuid(),
        date: day.optional(),
        start: time.optional(),
        end: time.optional(),
        subject: subject.optional(),
        isBreak: z.boolean().optional(),
        done: z.boolean().optional(),
      }),
    },
    async ({id, date, start, end, subject: name, isBreak, done}, ctx) => {
      const supabase = db(ctx);
      const current = await supabase.from("study_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle();
      if (current.error || !current.data) return fail("No study session with that id.");
      const was = session(current.data as SessionRow);
      if (toMinutes(end ?? was.end) <= toMinutes(start ?? was.start)) return fail("The session would end before it starts.");

      const changes = {
        ...(date && {day: date}),
        ...(start && {starts_at: start}),
        ...(end && {ends_at: end}),
        ...(name && {subject: name}),
        ...(isBreak !== undefined && {is_break: isBreak}),
        ...(done !== undefined && {completed_at: done ? (was.done ? current.data.completed_at : new Date().toISOString()) : null}),
      };
      const {data, error} = await supabase.from("study_sessions").update(changes).eq("id", id).select(SESSION_COLUMNS).single();
      if (error) return fail("Couldn't save that change.");
      return reply({updated: session(data as SessionRow)});
    },
  );

  server.registerTool(
    "remove_study_sessions",
    {
      title: "Remove study sessions",
      description: "Delete study sessions by id. Confirm with the user first. Classes can't be removed here.",
      inputSchema: z.object({ids: z.array(z.string().uuid()).min(1).max(MAX_ADD)}),
      annotations: {destructiveHint: true},
    },
    async ({ids}, ctx) => {
      const {data, error} = await db(ctx).from("study_sessions").delete().in("id", ids).select("id");
      if (error) return fail("Couldn't remove those sessions.");
      return reply({removed: (data as {id: string}[]).map((r) => r.id)});
    },
  );

  server.registerTool(
    "get_progress",
    {
      title: "Get study progress",
      description:
        "The user's study streak and totals: minutes planned and done per day for the 30 days up to `today`, and the current streak (days in a row with at least one finished session, counting from today or yesterday).",
      inputSchema: z.object({today: day}),
      annotations: {readOnlyHint: true},
    },
    async ({today}, ctx) => {
      const from = addDays(today, -365);
      const {data, error} = await db(ctx)
        .from("study_days")
        .select("day, sessions, sessions_done, planned_minutes, done_minutes")
        .gte("day", from)
        .lte("day", today)
        .order("day");
      if (error) return fail("Couldn't read progress.");
      const rows = data as {day: string; sessions: number; sessions_done: number; planned_minutes: number; done_minutes: number}[];
      const studied = new Set(rows.filter((r) => r.sessions_done > 0).map((r) => r.day));

      let streak = 0;
      let d = studied.has(today) ? today : addDays(today, -1);
      while (studied.has(d)) {
        streak++;
        d = addDays(d, -1);
      }
      const recent = rows.filter((r) => r.day > addDays(today, -30));
      return reply({
        streakDays: streak,
        last30Days: {
          daysStudied: recent.filter((r) => r.sessions_done > 0).length,
          minutesPlanned: recent.reduce((a, r) => a + r.planned_minutes, 0),
          minutesDone: recent.reduce((a, r) => a + r.done_minutes, 0),
        },
        days: recent.map((r) => ({date: r.day, minutesPlanned: r.planned_minutes, minutesDone: r.done_minutes})),
      });
    },
  );
}
