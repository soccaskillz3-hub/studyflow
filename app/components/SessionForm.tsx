"use client";

import {useEffect, useRef, useState, type FormEvent} from "react";
import TimePicker from "./TimePicker";
import {useSchedule} from "../lib/schedule";
import {fromMinutes, nowMinutes, toMinutes} from "../lib/time";

type Props = {
  day?: string; // "YYYY-MM-DD" to add to; today if not given
  initialStart?: string;
  initialEnd?: string;
  autoFocus?: boolean;
  // Called after a session is added. Without it the form resets for the next entry.
  onAdded?: () => void;
  onCancel?: () => void;
  // Reports the picked times as they change, e.g. so the calendar can preview the block.
  onTimesChange?: (start: string, end: string) => void;
  // Given, the times are set from outside (e.g. by dragging on the calendar) and picking one
  // goes through onTimesChange.
  start?: string;
  end?: string;
};

export default function SessionForm({
  day,
  initialStart = "",
  initialEnd = "",
  autoFocus = false,
  onAdded,
  onCancel,
  onTimesChange,
  start: controlledStart,
  end: controlledEnd,
}: Props) {
  const {addSession} = useSchedule();
  const [subject, setSubject] = useState("");
  const [ownStart, setOwnStart] = useState(initialStart);
  const [ownEnd, setOwnEnd] = useState(initialEnd);
  const controlled = controlledStart !== undefined;
  const start = controlled ? controlledStart : ownStart;
  const end = controlled ? (controlledEnd ?? "") : ownEnd;
  const setStart = (value: string) => (controlled ? onTimesChange?.(value, end) : setOwnStart(value));
  const setEnd = (value: string) => (controlled ? onTimesChange?.(start, value) : setOwnEnd(value));
  const [isBreak, setIsBreak] = useState(false);
  const [error, setError] = useState("");
  const subjectInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only with a mouse: focusing on a phone would pop the keyboard over the calendar.
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) subjectInput.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!controlled) onTimesChange?.(start, end);
  }, [controlled, start, end, onTimesChange]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = subject.trim() || (isBreak ? "Break" : "");
    if (!name) return setError("Give the session a name.");
    if (!start || !end) return setError("Pick a start and end time.");
    if (toMinutes(end) <= toMinutes(start)) return setError("End time must be after start time.");

    addSession({subject: name, start, end, isBreak}, day);
    if (onAdded) return onAdded();
    setSubject("");
    setStart(end); // next session most likely starts where this one ended
    setEnd("");
    setIsBreak(false);
    setError("");
  };

  // Where the pickers start when empty: the next full hour, and an hour after the start.
  const startSuggestion = fromMinutes(Math.ceil((nowMinutes() + 1) / 60) * 60);
  const endSuggestion = fromMinutes(toMinutes(start || startSuggestion) + 60);

  const inputClass =
    "border-b border-white/30 bg-transparent px-1 py-2 text-white placeholder:text-white/45 outline-none transition focus:border-scene [color-scheme:dark]";

  return (
    <form onSubmit={submit}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <input
          ref={subjectInput}
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={isBreak ? "Break" : "Subject, e.g. CS 135"}
          aria-label="Subject"
          className={`${inputClass} md:min-w-0 md:flex-1`}
        />
        <div className="flex items-end gap-3">
          <TimePicker value={start} onChange={setStart} label="Start time" placeholder="Start" suggestion={startSuggestion} />
          <span className="pb-2 text-xs text-white/50">to</span>
          <TimePicker value={end} onChange={setEnd} label="End time" placeholder="End" suggestion={endSuggestion} align="right" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/70">
            <input
              type="checkbox"
              checked={isBreak}
              onChange={(e) => setIsBreak(e.target.checked)}
              className="h-3.5 w-3.5 accent-scene"
            />
            Break
          </label>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 text-xs uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="border border-scene/70 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15 active:scale-[0.98]"
            >
              Add
            </button>
          </div>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
    </form>
  );
}
