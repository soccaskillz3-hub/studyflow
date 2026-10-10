"use client";

import {createContext, useContext, useEffect, useState, type ReactNode} from "react";
import type {Meeting} from "./classSchedule";
import {CLASS_COLUMNS, classFromRow, type ClassMeeting, type ClassRow} from "./classMeetings";
import {usePrefs} from "./prefs";
import {createClient} from "./supabase/client";

export {classesOn, upcomingTests, type ClassMeeting} from "./classMeetings";

// The same course, component and times: importing a schedule twice shouldn't add it twice.
const sameMeeting = (a: Meeting, b: Meeting) =>
  a.code === b.code &&
  a.component === b.component &&
  a.days.join() === b.days.join() &&
  a.start === b.start &&
  a.end === b.end &&
  a.startsOn === b.startsOn &&
  a.endsOn === b.endsOn;

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
  const {prefs, setPrefs} = usePrefs();

  useEffect(() => {
    if (!userId) return;
    let current = true;
    createClient()
      .from("class_meetings")
      .select(CLASS_COLUMNS)
      .eq("user_id", userId)
      .then(({data, error}) => {
        if (!current || error) return; // no classes table yet, or offline: the calendar just shows sessions
        setClasses((data as ClassRow[]).map(classFromRow));
        setLoaded(true);
      });
    return () => {
      current = false;
    };
  }, [userId]);

  // Remembered on the account, so the question isn't asked again on another device.
  const dismissPrompt = () => setPrefs({classPromptDismissed: true});

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
      .select(CLASS_COLUMNS);
    if (error) throw error;
    setClasses((prev) => [...prev, ...(data as ClassRow[]).map(classFromRow)]);
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
        promptDismissed: prefs === null ? null : prefs.classPromptDismissed,
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
