"use client";

import {useEffect, useState} from "react";
import {useAccount} from "./account";
import {useClasses} from "./classes";
import {addDays, weekDays} from "./days";
import {sessionMinutes, useSchedule, type Session} from "./schedule";
import {createClient} from "./supabase/client";

// One day's study, breaks left out: minutes planned and done, and how many sessions.
export type DayTotal = {planned: number; done: number; sessions: number; sessionsDone: number};

export type History = Record<string, DayTotal>; // by "YYYY-MM-DD"

const EMPTY: DayTotal = {planned: 0, done: 0, sessions: 0, sessionsDone: 0};

export const totalOn = (history: History, day: string) => history[day] ?? EMPTY;

export function dayTotal(sessions: Session[], completed: string[]): DayTotal {
  const study = sessions.filter((s) => !s.isBreak);
  const done = study.filter((s) => completed.includes(s.id));
  const minutes = (list: Session[]) => list.reduce((sum, s) => sum + sessionMinutes(s), 0);
  return {planned: minutes(study), done: minutes(done), sessions: study.length, sessionsDone: done.length};
}

type Row = {day: string; planned_minutes: number; done_minutes: number; sessions: number; sessions_done: number};

// The view holds at most one row per day, so this covers nearly three years.
const MAX_DAYS = 1000;

// Every day the logged-in user has planned anything, from the study_days view. Days the schedule
// already has loaded are taken from there instead, so ticking a session off shows up here at once.
// `history` is null until the first read finishes.
export function useStudyHistory() {
  const userId = useAccount()?.id;
  const {loadedDays, sessionsOn, completed} = useSchedule();
  const [saved, setSaved] = useState<History | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    createClient()
      .from("study_days")
      .select("day, planned_minutes, done_minutes, sessions, sessions_done")
      .eq("user_id", userId)
      .order("day", {ascending: false})
      .limit(MAX_DAYS)
      .then(({data, error}) => {
        if (!current) return;
        if (error) return setError(true);
        setSaved(
          Object.fromEntries(
            (data as Row[]).map((r) => [
              r.day,
              {planned: r.planned_minutes, done: r.done_minutes, sessions: r.sessions, sessionsDone: r.sessions_done},
            ]),
          ),
        );
      });
    return () => {
      current = false;
    };
  }, [userId]);

  if (!saved) return {history: null, error};
  const history: History = {...saved};
  for (const day of loadedDays) history[day] = dayTotal(sessionsOn(day), completed);
  return {history, error};
}

const studied = (history: History, day: string) => totalOn(history, day).done > 0;

// A streak is a run of days in a row with at least one study session done. Today only adds to
// it: until something's done today, the streak still counts up to yesterday.
export function streaks(history: History, today: string) {
  const studiedToday = studied(history, today);
  let current = 0;
  for (let d = studiedToday ? today : addDays(today, -1); studied(history, d); d = addDays(d, -1)) current++;

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  const days = Object.keys(history)
    .filter((d) => d <= today && studied(history, d))
    .sort();
  for (const day of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return {current, best, studiedToday};
}

// How strongly to shade a day: 0 (nothing done) to 4 (two hours or more).
export function intensity(done: number) {
  if (done <= 0) return 0;
  if (done < 30) return 1;
  if (done < 60) return 2;
  if (done < 120) return 3;
  return 4;
}

export type SubjectTotal = {subject: string; planned: number; done: number};

// A course code at the start of a session's name, written in capitals ("CS 135", "MATH137B").
const COURSE_CODE = /^([A-Z]{2,8})\s*(\d{2,4}[A-Z]?)\b/;

// What to group a session under on the Progress page: its course when the name starts with one
// ("CS 135 assignment" and "CS 135 lab prep" both count for CS 135), otherwise the name itself.
// Imported class codes match in any case; other names need a capitalised code, so ordinary
// names like "Week 10 notes" aren't mistaken for courses.
export function courseOf(subject: string, codes: string[]) {
  const name = subject.trim().replace(/\s+/g, " ");
  const upper = name.toUpperCase();
  const known = codes.find((code) => upper === code || upper.startsWith(`${code} `));
  if (known) return known;
  const match = name.match(COURSE_CODE);
  return match ? `${match[1]} ${match[2]}` : name;
}

// One week (Monday to Sunday) from the schedule, loading it if needed: each day's totals, the
// week's, and time per subject (by course where there is one), most studied first. Live, so ticking a session off shows at once.
export function useWeek(start: string) {
  const {sessionsOn, isLoaded, loadDays, completed} = useSchedule();
  const {classes} = useClasses();
  const codes = [...new Set(classes.map((c) => c.code.toUpperCase().replace(/\s+/g, " ")))];
  const days = weekDays(start);
  const end = days[6];

  useEffect(() => {
    loadDays(start, end);
  }, [start, end, loadDays]);

  const totals = days.map((day) => ({day, ...dayTotal(sessionsOn(day), completed)}));

  const bySubject = new Map<string, SubjectTotal>();
  for (const s of days.flatMap((d) => sessionsOn(d))) {
    if (s.isBreak) continue;
    const subject = courseOf(s.subject, codes);
    const entry = bySubject.get(subject) ?? {subject, planned: 0, done: 0};
    entry.planned += sessionMinutes(s);
    if (completed.includes(s.id)) entry.done += sessionMinutes(s);
    bySubject.set(subject, entry);
  }

  return {
    totals,
    loaded: days.every(isLoaded),
    planned: totals.reduce((sum, t) => sum + t.planned, 0),
    done: totals.reduce((sum, t) => sum + t.done, 0),
    studiedDays: totals.filter((t) => t.done > 0).length,
    subjects: [...bySubject.values()].sort((a, b) => b.done - a.done || b.planned - a.planned),
  };
}
