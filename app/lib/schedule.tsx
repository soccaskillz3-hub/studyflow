"use client";

import {createContext, useContext, useEffect, useState, type ReactNode} from "react";
import {toMinutes} from "./time";

export type Session = {
  id: string;
  subject: string;
  start: string; // "HH:MM", 24-hour
  end: string;
  isBreak: boolean;
};

export const sessionMinutes = (s: Session) => toMinutes(s.end) - toMinutes(s.start);

const STORAGE_KEY = "studyflow:v1";

type Schedule = {
  sessions: Session[]; // always sorted by start time
  completed: string[]; // ids of finished sessions
  loaded: boolean; // false until the saved schedule has been read
  addSession: (session: Omit<Session, "id">) => void;
  removeSession: (id: string) => void;
  toggle: (id: string) => void;
};

const ScheduleContext = createContext<Schedule | null>(null);

// Holds the schedule for every tab. It lives in the root layout, so it survives navigating between tabs.
export function ScheduleProvider({children}: {children: ReactNode}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load the saved schedule once on the client (localStorage doesn't exist on the server).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
        setSessions(saved.sessions ?? []);
        setCompleted(saved.completed ?? []);
      }
    } catch {
      // Ignore unreadable storage and start with an empty schedule.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({sessions, completed}));
    } catch {
      // Storage may be unavailable (e.g. private mode); the app still works in-memory.
    }
  }, [sessions, completed, loaded]);

  const addSession = (session: Omit<Session, "id">) =>
    setSessions((prev) =>
      [...prev, {...session, id: crypto.randomUUID()}].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
    );

  const removeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setCompleted((prev) => prev.filter((x) => x !== id));
  };

  // Complete on first click, undo on second.
  const toggle = (id: string) =>
    setCompleted((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <ScheduleContext value={{sessions, completed, loaded, addSession, removeSession, toggle}}>
      {children}
    </ScheduleContext>
  );
}

export function useSchedule() {
  const schedule = useContext(ScheduleContext);
  if (!schedule) throw new Error("useSchedule must be used inside <ScheduleProvider>");
  return schedule;
}
