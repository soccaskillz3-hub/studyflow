// Class meetings as stored in the database, and which of them fall on a given day. Plain
// functions with no React, so the server (e.g. the AI connector) can use them too.

import type {Meeting} from "./classSchedule";
import {toDate} from "./days";
import {toMinutes} from "./time";

export type ClassMeeting = Meeting & {id: string};

export type ClassRow = {
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

export const CLASS_COLUMNS = "id, code, title, component, days, starts_at, ends_at, location, starts_on, ends_on";

export const classFromRow = (r: ClassRow): ClassMeeting => ({
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

// Tests, exams and other one-off meetings (they start and end on the same day) from today on,
// soonest first. Today's stay in the list until they've finished.
export function upcomingTests(classes: ClassMeeting[], today: string, nowMinutes: number) {
  return classes
    .filter((c) => c.startsOn !== null && c.startsOn === c.endsOn)
    .filter((c) => c.startsOn! > today || (c.startsOn === today && toMinutes(c.end) > nowMinutes))
    .sort((a, b) => (a.startsOn === b.startsOn ? toMinutes(a.start) - toMinutes(b.start) : a.startsOn! < b.startsOn! ? -1 : 1));
}

// Classes that meet on a date ("YYYY-MM-DD", the user's local day), sorted by start time.
export function classesOn(classes: ClassMeeting[], day: string) {
  const weekday = toDate(day).getDay();
  return classes
    .filter(
      (c) => c.days.includes(weekday) && (!c.startsOn || c.startsOn <= day) && (!c.endsOn || day <= c.endsOn),
    )
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}
