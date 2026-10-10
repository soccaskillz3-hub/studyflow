"use client";

import {useEffect, useId, useRef, useState, type KeyboardEvent} from "react";
import {addDays, dayKey, formatDay, toDate, weekStart} from "../lib/days";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// The first of the month that `day` is in.
function monthStart(day: string) {
  const d = toDate(day);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

// The same day of the month, `n` months on (Jan 31 → Feb 28).
function shiftMonth(day: string, n: number) {
  const d = toDate(day);
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return dayKey(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)));
}

type Props = {
  value: string; // "YYYY-MM-DD" or "" when unset
  onChange: (value: string) => void;
  label: string;
  placeholder?: string; // shown before a day is picked
  min?: string; // earliest day that can be picked
  max?: string;
  align?: "left" | "right";
};

// A day picker in the site's style (the browser's own looks different everywhere): a month at a
// time, weeks starting on Monday like the calendar. Arrow keys move by day and week, Page Up and
// Page Down by month, Enter picks, Escape closes.
export default function DatePicker({value, onChange, label, placeholder = "Pick a day", min, max, align = "left"}: Props) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [today] = useState(() => dayKey());
  const [focused, setFocused] = useState(value || today); // the day keyboard focus is on
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const month = monthStart(focused);
  const first = weekStart(month);
  const days = Array.from({length: 42}, (_, i) => addDays(first, i));
  const allowed = (day: string) => (!min || day >= min) && (!max || day <= max);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const pick = (day: string) => {
    if (!allowed(day)) return;
    onChange(day);
    close();
  };

  // Keep keyboard focus on the focused day as it moves (including into another month).
  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLElement>(`[data-day="${focused}"]`)?.focus({preventScroll: true});
  }, [open, focused]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => shiftMonth(focused, -1),
      PageDown: () => shiftMonth(focused, 1),
    };
    if (e.key === "Escape") {
      e.stopPropagation();
      return close();
    }
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setFocused(move());
  };

  const step = "flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition hover:bg-white/[0.08] hover:text-white";

  return (
    <div ref={root} className="relative min-w-[9.5rem]">
      <button
        ref={trigger}
        type="button"
        aria-label={value ? `${label}: ${formatDay(value, {weekday: "long", month: "long", day: "numeric", year: "numeric"})}` : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (!open) {
            // Open upward when there isn't room for the panel below the field.
            const rect = trigger.current?.getBoundingClientRect();
            if (rect) setOpenUp(window.innerHeight - rect.bottom < 360 && rect.top > 360);
            setFocused(value || (min && today < min ? min : today));
          }
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center justify-between gap-2 border-b px-1 py-2 text-left text-sm tabular-nums outline-none transition focus-visible:border-scene ${
          open ? "border-scene" : "border-white/30 hover:border-white/60"
        }`}
      >
        <span className={`truncate whitespace-nowrap ${value ? "text-white" : "text-white/45"}`}>
          {value ? formatDay(value, {weekday: "short", month: "short", day: "numeric", year: "numeric"}) : placeholder}
        </span>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-white/50" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.5" />
          <path d="M2.25 6.5h11.5M5.5 1.75v3M10.5 1.75v3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`sf-pop sf-panel absolute z-30 w-[17.5rem] rounded-xl border p-3 [text-shadow:none] ${
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setFocused(shiftMonth(focused, -1))} aria-label="Previous month" className={step}>
              ‹
            </button>
            <p className="text-xs uppercase tracking-[0.25em] text-white" aria-live="polite">
              {formatDay(month, {month: "long", year: "numeric"})}
            </p>
            <button type="button" onClick={() => setFocused(shiftMonth(focused, 1))} aria-label="Next month" className={step}>
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-[0.15em] text-white/45" aria-hidden>
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div ref={grid} role="grid" aria-label={formatDay(month, {month: "long", year: "numeric"})} className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const inMonth = day.slice(0, 7) === month.slice(0, 7);
              const selected = day === value;
              const isToday = day === today;
              const ok = allowed(day);
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  data-day={day}
                  tabIndex={day === focused ? 0 : -1}
                  aria-selected={selected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={formatDay(day, {weekday: "long", month: "long", day: "numeric", year: "numeric"})}
                  disabled={!ok}
                  onClick={() => pick(day)}
                  onFocus={() => setFocused(day)}
                  className={`h-8 rounded-md text-xs tabular-nums outline-none transition focus-visible:ring-1 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:text-white/15 ${
                    selected
                      ? "sf-panel-active text-white"
                      : `${inMonth ? "text-white/80" : "text-white/30"} hover:bg-white/[0.08] hover:text-white`
                  } ${isToday && !selected ? "ring-1 ring-scene/60" : ""}`}
                >
                  {toDate(day).getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-dashed border-white/15 px-1 pt-2">
            <button
              type="button"
              onClick={() => (allowed(today) ? pick(today) : setFocused(today))}
              className="text-[11px] uppercase tracking-[0.2em] text-scene-soft transition hover:text-white"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  close();
                }}
                className="text-[11px] uppercase tracking-[0.2em] text-white/55 transition hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
