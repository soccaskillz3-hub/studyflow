"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {chime} from "./audio/sfx";

// The focus timer is stored as timestamps rather than a ticking counter, so it keeps
// correct time across reloads, background tabs and leaving the page.
type TimerState = {
  sessionId: string;
  focusMs: number; // full length of the focus block, including any time added
  focusLeftMs: number; // focus remaining as of `runningSince` (or now, when not running)
  runningSince: number | null; // when focus last resumed; null while paused or on a break
  onBreak: {totalMs: number; endsAt: number} | null;
};

export type Phase = "focus" | "paused" | "break" | "complete";

const STORAGE_KEY = "studyflow:timer";

function load(): TimerState | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

function save(state: TimerState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not persisted; the timer still runs for this page view.
  }
}

const focusLeft = (s: TimerState, now: number) =>
  Math.max(0, s.runningSince === null ? s.focusLeftMs : s.focusLeftMs - (now - s.runningSince));

// Runs the timer for one session of `minutes` length. Resumes a saved timer for the same
// session; otherwise starts a fresh one.
export function useFocusTimer(sessionId: string | null, minutes: number) {
  const [state, setState] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastPhase = useRef<Phase | null>(null);

  // Start or resume once the session is known.
  useEffect(() => {
    if (!sessionId || minutes <= 0) return;
    const saved = load();
    const next: TimerState =
      saved?.sessionId === sessionId
        ? saved
        : {sessionId, focusMs: minutes * 60_000, focusLeftMs: minutes * 60_000, runningSince: Date.now(), onBreak: null};
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved timer once on the client
    setState(next);
    setNow(Date.now());
  }, [sessionId, minutes]);

  useEffect(() => {
    if (state) save(state);
  }, [state]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // A break that has run out hands back to focus automatically.
  useEffect(() => {
    if (state?.onBreak && now >= state.onBreak.endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the break ran out while ticking
      setState({...state, onBreak: null, runningSince: now});
    }
  }, [state, now]);

  const left = state ? focusLeft(state, now) : minutes * 60_000;
  const phase: Phase = !state
    ? "paused"
    : state.onBreak
      ? "break"
      : left <= 0
        ? "complete"
        : state.runningSince === null
          ? "paused"
          : "focus";

  // Chime when focus finishes or a break ends (not on first load).
  useEffect(() => {
    const prev = lastPhase.current;
    lastPhase.current = phase;
    if (prev === null) return;
    if ((phase === "complete" && prev !== "complete") || (prev === "break" && phase === "focus")) chime();
  }, [phase]);

  const update = useCallback((fn: (s: TimerState, now: number) => TimerState) => {
    setState((s) => (s ? fn(s, Date.now()) : s));
  }, []);

  return {
    phase,
    focusLeftMs: left,
    focusMs: state?.focusMs ?? minutes * 60_000,
    breakLeftMs: state?.onBreak ? Math.max(0, state.onBreak.endsAt - now) : 0,
    breakMs: state?.onBreak?.totalMs ?? 0,
    pause: () => update((s, t) => ({...s, focusLeftMs: focusLeft(s, t), runningSince: null})),
    resume: () => update((s, t) => ({...s, runningSince: t})),
    startBreak: (breakMinutes: number) =>
      update((s, t) => ({
        ...s,
        focusLeftMs: focusLeft(s, t),
        runningSince: null,
        onBreak: {totalMs: breakMinutes * 60_000, endsAt: t + breakMinutes * 60_000},
      })),
    endBreak: () => update((s, t) => ({...s, onBreak: null, runningSince: t})),
    addFocus: (extraMinutes: number) =>
      update((s, t) => ({
        ...s,
        focusMs: s.focusMs + extraMinutes * 60_000,
        focusLeftMs: focusLeft(s, t) + extraMinutes * 60_000,
        runningSince: t,
      })),
    clear: () => {
      save(null);
      setState(null);
    },
  };
}
