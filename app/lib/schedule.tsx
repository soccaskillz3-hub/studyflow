"use client";

import {createContext, useContext, useEffect, useState, type ReactNode} from "react";
import {createClient} from "./supabase/client";
import {toMinutes} from "./time";

export type Session = {
  id: string;
  subject: string;
  start: string; // "HH:MM", 24-hour
  end: string;
  isBreak: boolean;
};

export const sessionMinutes = (s: Session) => toMinutes(s.end) - toMinutes(s.start);

// Where schedules were kept in the browser before accounts. Offered for import once, then removed.
const LEGACY_KEY = "studyflow:v1";

type Legacy = {sessions: Session[]; completed: string[]};

type Row = {
  id: string;
  subject: string;
  starts_at: string; // "HH:MM:SS"
  ends_at: string;
  is_break: boolean;
  completed_at: string | null;
};

const COLUMNS = "id, subject, starts_at, ends_at, is_break, completed_at";

const fromRow = (r: Row): Session => ({
  id: r.id,
  subject: r.subject,
  start: r.starts_at.slice(0, 5),
  end: r.ends_at.slice(0, 5),
  isBreak: r.is_break,
});

const byStart = (a: Session, b: Session) => toMinutes(a.start) - toMinutes(b.start);

// A calendar day in the user's own time zone, e.g. "2026-10-08".
export function dayKey(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type Schedule = {
  sessions: Session[]; // today's, always sorted by start time
  completed: string[]; // ids of finished sessions
  loaded: boolean; // false until today's schedule has been read
  error: string | null; // a load or save that failed
  dismissError: () => void;
  legacy: Legacy | null; // a schedule saved in this browser before accounts, waiting to be imported
  importLegacy: () => Promise<void>;
  dismissLegacy: () => void;
  addSession: (session: Omit<Session, "id">) => void;
  removeSession: (id: string) => void;
  toggle: (id: string) => void;
};

const ScheduleContext = createContext<Schedule | null>(null);

// Holds today's schedule for every page, saved to the logged-in user's account. Changes show
// straight away and save in the background; if a save fails, the schedule is reloaded from the
// account so the screen never shows something that wasn't saved.
export function ScheduleProvider({userId, children}: {userId: string | null; children: ReactNode}) {
  // Null until mounted: the server doesn't know the user's time zone, so it can't tell which day it is.
  const [day, setDay] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<Legacy | null>(null);
  const [reloads, setReloads] = useState(0);

  // Track the date, so a new, empty day starts at midnight.
  useEffect(() => {
    const check = () => setDay(dayKey());
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!userId || !day) return;
    let current = true;
    createClient()
      .from("study_sessions")
      .select(COLUMNS)
      .eq("user_id", userId)
      .eq("day", day)
      .order("starts_at")
      .then(({data, error}) => {
        if (!current) return;
        if (error) return setError("Couldn't load your schedule. Check your connection and reload the page.");
        const rows = data as Row[];
        setSessions(rows.map(fromRow));
        setCompleted(rows.filter((r) => r.completed_at).map((r) => r.id));
        setLoaded(true);
      });
    return () => {
      current = false;
    };
  }, [userId, day, reloads]);

  useEffect(() => {
    if (!userId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the pre-accounts schedule
      if (saved?.sessions?.length) setLegacy({sessions: saved.sessions, completed: saved.completed ?? []});
    } catch {
      // Unreadable: nothing to import.
    }
  }, [userId]);

  const failed = (message: string) => {
    setError(message);
    setReloads((n) => n + 1);
  };

  const addSession = (session: Omit<Session, "id">) => {
    if (!userId || !day) return;
    const id = crypto.randomUUID();
    setSessions((prev) => [...prev, {...session, id}].sort(byStart));
    createClient()
      .from("study_sessions")
      .insert({
        id,
        user_id: userId,
        day,
        subject: session.subject,
        starts_at: session.start,
        ends_at: session.end,
        is_break: session.isBreak,
      })
      .then(({error}) => error && failed("Couldn't save that session. Please try again."));
  };

  const removeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setCompleted((prev) => prev.filter((x) => x !== id));
    createClient()
      .from("study_sessions")
      .delete()
      .eq("id", id)
      .then(({error}) => error && failed("Couldn't remove that session. Please try again."));
  };

  // Complete on first click, undo on second.
  const toggle = (id: string) => {
    const done = !completed.includes(id);
    setCompleted((prev) => (done ? [...prev, id] : prev.filter((x) => x !== id)));
    createClient()
      .from("study_sessions")
      .update({completed_at: done ? new Date().toISOString() : null})
      .eq("id", id)
      .then(({error}) => error && failed("Couldn't save that change. Please try again."));
  };

  const forgetLegacy = () => {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Already gone.
    }
    setLegacy(null);
  };

  // Adds the browser's old schedule to today, keeping which sessions were done.
  const importLegacy = async () => {
    if (!userId || !day || !legacy) return;
    const now = new Date().toISOString();
    const {error} = await createClient()
      .from("study_sessions")
      .insert(
        legacy.sessions.map((s) => ({
          user_id: userId,
          day,
          subject: s.subject,
          starts_at: s.start,
          ends_at: s.end,
          is_break: s.isBreak,
          completed_at: legacy.completed.includes(s.id) ? now : null,
        })),
      );
    if (error) return setError("Couldn't import your old schedule. Please try again.");
    forgetLegacy();
    setReloads((n) => n + 1);
  };

  return (
    <ScheduleContext
      value={{
        sessions,
        completed,
        loaded,
        error,
        dismissError: () => setError(null),
        legacy,
        importLegacy,
        dismissLegacy: forgetLegacy,
        addSession,
        removeSession,
        toggle,
      }}
    >
      {children}
    </ScheduleContext>
  );
}

export function useSchedule() {
  const schedule = useContext(ScheduleContext);
  if (!schedule) throw new Error("useSchedule must be used inside <ScheduleProvider>");
  return schedule;
}
