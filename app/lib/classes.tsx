"use client";

import {createContext, useContext, useEffect, useState, type ReactNode} from "react";
import type {Meeting} from "./classSchedule";
import {toDate} from "./days";
import {createClient} from "./supabase/client";
import {toMinutes} from "./time";

export type ClassMeeting = Meeting & {id: string};

type Row = {
  id: string;
  code: string;
  title: string;
  component: string;
  days: number[];
  starts_at: string; // "HH:MM:SS"
  ends_at: string;
  location: string;
  starts_on: string | null;
  ends_on: string | null;
};

const COLUMNS = "id, code, title, component, days, starts_at, ends_at, location, starts_on, ends_on";

const fromRow = (r: Row): ClassMeeting => ({
  id: r.id,
  code: r.code,
  title: r.title,
  component: r.component,
  days: r.days,
  start: r.starts_at.slice(0, 5),
  end: r.ends_at.slice(0, 5),
  location: r.location,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
});

// The same course, component and times: importing a schedule twice shouldn't add it twice.
const sameMeeting = (a: Meeting, b: Meeting) =>
  a.code === b.code &&
  a.component === b.component &&
  a.days.join() === b.days.join() &&
  a.start === b.start &&
  a.end === b.end &&
  a.startsOn === b.startsOn &&
  a.endsOn === b.endsOn;

// Classes that meet on a date ("YYYY-MM-DD", the user's local day), sorted by start time.
export function classesOn(classes: ClassMeeting[], day: string) {
  const weekday = toDate(day).getDay();
  return classes
    .filter(
      (c) => c.days.includes(weekday) && (!c.startsOn || c.startsOn <= day) && (!c.endsOn || day <= c.endsOn),
    )
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

type Classes = {
  classes: ClassMeeting[];
  loaded: boolean;
  // Whether the person said "Not now" to adding their class schedule. Null until known.
  promptDismissed: boolean | null;
  dismissPrompt: () => void;
  // Saves the meetings that aren't already there; resolves to how many were added, or throws.
  addMeetings: (meetings: Meeting[]) => Promise<number>;
  removeMeetings: (ids: string[]) => Promise<void>;
};

const ClassesContext = createContext<Classes | null>(null);

// The logged-in user's imported classes (weekly meetings), for the calendar and the Classes page.
export function ClassesProvider({userId, children}: {userId: string | null; children: ReactNode}) {
  const [classes, setClasses] = useState<ClassMeeting[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    createClient()
      .from("class_meetings")
      .select(COLUMNS)
      .eq("user_id", userId)
      .then(({data, error}) => {
        if (!current || error) return; // no classes table yet, or offline: the calendar just shows sessions
        setClasses((data as Row[]).map(fromRow));
        setLoaded(true);
      });
    createClient()
      .from("user_settings")
      .select("prefs")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({data}) => {
        // No settings yet (or the prefs column isn't set up): nothing has been dismissed.
        if (current) setPrefs((data?.prefs as Record<string, unknown> | undefined) ?? {});
      });
    return () => {
      current = false;
    };
  }, [userId]);

  // Remembered on the account, so the question isn't asked again on another device.
  const dismissPrompt = () => {
    if (!userId) return;
    const next = {...prefs, classPromptDismissed: true};
    setPrefs(next);
    createClient()
      .from("user_settings")
      .upsert({user_id: userId, prefs: next})
      .then(() => {
        // If this fails the question just comes back next visit; there's nothing to undo here.
      });
  };

  const addMeetings = async (meetings: Meeting[]) => {
    if (!userId) throw new Error("Not logged in");
    const fresh = meetings.filter((m) => !classes.some((c) => sameMeeting(c, m)));
    if (!fresh.length) return 0;
    const {data, error} = await createClient()
      .from("class_meetings")
      .insert(
        fresh.map((m) => ({
          user_id: userId,
          code: m.code,
          title: m.title,
          component: m.component,
          days: m.days,
          starts_at: m.start,
          ends_at: m.end,
          location: m.location,
          starts_on: m.startsOn,
          ends_on: m.endsOn,
        })),
      )
      .select(COLUMNS);
    if (error) throw error;
    setClasses((prev) => [...prev, ...(data as Row[]).map(fromRow)]);
    return fresh.length;
  };

  const removeMeetings = async (ids: string[]) => {
    const {error} = await createClient().from("class_meetings").delete().in("id", ids);
    if (error) throw error;
    setClasses((prev) => prev.filter((c) => !ids.includes(c.id)));
  };

  return (
    <ClassesContext
      value={{
        classes,
        loaded,
        promptDismissed: prefs === null ? null : prefs.classPromptDismissed === true,
        dismissPrompt,
        addMeetings,
        removeMeetings,
      }}
    >
      {children}
    </ClassesContext>
  );
}

export function useClasses() {
  const classes = useContext(ClassesContext);
  if (!classes) throw new Error("useClasses must be used inside <ClassesProvider>");
  return classes;
}
