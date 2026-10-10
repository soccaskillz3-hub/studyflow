"use client";

import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import {addDays, daysBetween, dayKey} from "./days";
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
  day: string;
  subject: string;
  starts_at: string; // "HH:MM:SS"
  ends_at: string;
  is_break: boolean;
  completed_at: string | null;
};

const COLUMNS = "id, day, subject, starts_at, ends_at, is_break, completed_at";

const fromRow = (r: Row): Session => ({
  id: r.id,
  subject: r.subject,
  start: r.starts_at.slice(0, 5),
  end: r.ends_at.slice(0, 5),
  isBreak: r.is_break,
});

const byStart = (a: Session, b: Session) => toMinutes(a.start) - toMinutes(b.start);

const NONE: Session[] = [];

type Schedule = {
  today: string | null; // null until mounted (the server doesn't know the user's time zone)
  sessions: Session[]; // today's, always sorted by start time
  loaded: boolean; // false until today's schedule has been read
  completed: string[]; // ids of finished sessions, on any loaded day
  sessionsOn: (day: string) => Session[]; // sorted by start time; empty until that day loads
  isLoaded: (day: string) => boolean;
  loadedDays: string[]; // every day read so far, in no particular order
  loadDays: (from: string, to: string) => void; // fetch any of these days not already loaded
  error: string | null; // a load or save that failed
  dismissError: () => void;
  legacy: Legacy | null; // a schedule saved in this browser before accounts, waiting to be imported
  importLegacy: () => Promise<void>;
  dismissLegacy: () => void;
  addSession: (session: Omit<Session, "id">, day?: string) => void; // today unless a day is given
  removeSession: (id: string) => void;
  toggle: (id: string) => void;
};

const ScheduleContext = createContext<Schedule | null>(null);

// Holds the logged-in user's sessions for every page, day by day: today's always, and any other
// days a page asks for (the calendar's week and day views). Changes show straight away and save
// in the background; if a save fails, the loaded days are read again from the account so the
// screen never shows something that wasn't saved.
export function ScheduleProvider({userId, children}: {userId: string | null; children: ReactNode}) {
  const [today, setToday] = useState<string | null>(null);
  const [byDay, setByDay] = useState<Record<string, Session[]>>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<Legacy | null>(null);
  // Days already fetched or being fetched, so asking twice doesn't fetch twice.
  const requested = useRef(new Set<string>());
  // Changes made here (counted, and how many are still saving), so a background re-read that
  // started before a change can't overwrite it with what the account held a moment earlier.
  const edits = useRef(0);
  const saving = useRef(0);

  // Read a run of days from the account and show them in place of what was there.
  const read = useCallback(
    (days: string[]) =>
      createClient()
        .from("study_sessions")
        .select(COLUMNS)
        .eq("user_id", userId!)
        .gte("day", days[0])
        .lte("day", days[days.length - 1])
        .order("starts_at")
        .then(({data, error}) => {
          if (error) return false;
          const rows = data as Row[];
          const fetched: Record<string, Session[]> = Object.fromEntries(days.map((d) => [d, []]));
          rows.forEach((r) => fetched[r.day]?.push(fromRow(r)));
          const ids = new Set(rows.map((r) => r.id));
          return () => {
            setByDay((prev) => ({...prev, ...fetched}));
            setCompleted((prev) => [
              ...prev.filter((id) => !ids.has(id)),
              ...rows.filter((r) => r.completed_at).map((r) => r.id),
            ]);
          };
        }),
    [userId],
  );

  const loadDays = useCallback(
    (from: string, to: string) => {
      if (!userId) return;
      const missing = daysBetween(from, to).filter((d) => !requested.current.has(d));
      if (!missing.length) return;
      missing.forEach((d) => requested.current.add(d));
      read(missing).then((show) => {
        if (show) return show();
        missing.forEach((d) => requested.current.delete(d));
        setError("Couldn't load your schedule. Check your connection and reload the page.");
      });
    },
    [userId, read],
  );

  // Throw away everything loaded and read it again, e.g. after a save failed.
  const reload = () => {
    const days = [...requested.current].sort();
    requested.current.clear();
    if (days.length) loadDays(days[0], days[days.length - 1]);
  };

  // Track the date, so a new day starts at midnight, and always have today loaded.
  useEffect(() => {
    const check = () => setToday(dayKey());
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (today) loadDays(today, today);
  }, [today, loadDays]);

  // Read the loaded days again when someone comes back to the tab, so sessions added elsewhere
  // (a connected AI assistant, another device) show up. At most every 15 seconds, only the days
  // already shown (each run of consecutive days in one read), and never over a change made here
  // meanwhile: one still saving skips the refresh, and one made during it discards the result.
  useEffect(() => {
    if (!userId) return;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 15_000 || saving.current) return;
      last = Date.now();
      const at = edits.current;
      const runs: string[][] = [];
      for (const d of [...requested.current].sort()) {
        const run = runs[runs.length - 1];
        if (run && addDays(run[run.length - 1], 1) === d) run.push(d);
        else runs.push([d]);
      }
      runs.forEach((run) =>
        read(run).then((show) => {
          if (show && edits.current === at) show();
        }),
      );
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, read]);

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
    reload();
  };

  // Count a change made here while it saves (see `edits` above); on failure, say so and re-read.
  const saved = (message: string) => {
    edits.current++;
    saving.current++;
    const done = ({error}: {error: unknown}) => {
      saving.current--;
      if (error) failed(message);
    };
    const lost = () => {
      saving.current--;
      failed(message);
    };
    return [done, lost] as const;
  };

  const sessionsOn = (day: string) => byDay[day] ?? NONE;
  const dayOf = (id: string) => Object.keys(byDay).find((d) => byDay[d].some((s) => s.id === id));

  const addSession = (session: Omit<Session, "id">, day = today) => {
    if (!userId || !day) return;
    const id = crypto.randomUUID();
    setByDay((prev) => ({...prev, [day]: [...(prev[day] ?? []), {...session, id}].sort(byStart)}));
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
      .then(...saved("Couldn't save that session. Please try again."));
  };

  const removeSession = (id: string) => {
    const day = dayOf(id);
    if (day) setByDay((prev) => ({...prev, [day]: prev[day].filter((s) => s.id !== id)}));
    setCompleted((prev) => prev.filter((x) => x !== id));
    createClient()
      .from("study_sessions")
      .delete()
      .eq("id", id)
      .then(...saved("Couldn't remove that session. Please try again."));
  };

  // Complete on first click, undo on second.
  const toggle = (id: string) => {
    const done = !completed.includes(id);
    setCompleted((prev) => (done ? [...prev, id] : prev.filter((x) => x !== id)));
    createClient()
      .from("study_sessions")
      .update({completed_at: done ? new Date().toISOString() : null})
      .eq("id", id)
      .then(...saved("Couldn't save that change. Please try again."));
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
    if (!userId || !today || !legacy) return;
    const now = new Date().toISOString();
    const {error} = await createClient()
      .from("study_sessions")
      .insert(
        legacy.sessions.map((s) => ({
          user_id: userId,
          day: today,
          subject: s.subject,
          starts_at: s.start,
          ends_at: s.end,
          is_break: s.isBreak,
          completed_at: legacy.completed.includes(s.id) ? now : null,
        })),
      );
    if (error) return setError("Couldn't import your old schedule. Please try again.");
    forgetLegacy();
    reload();
  };

  return (
    <ScheduleContext
      value={{
        today,
        sessions: today ? sessionsOn(today) : NONE,
        loaded: today !== null && today in byDay,
        completed,
        sessionsOn,
        isLoaded: (day) => day in byDay,
        loadedDays: Object.keys(byDay),
        loadDays,
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
