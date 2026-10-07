"use client";

import {useEffect, useId, useRef, useState, type KeyboardEvent} from "react";
import {formatTime, fromParts, toParts} from "../lib/time";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_STEP = 5;

type Option = {key: string; label: string; selected: boolean; pick: () => void};

// One scrolling column of choices. Arrow keys move focus; Enter or Space picks.
function Column({label, options, className = ""}: {label: string; options: Option[]; className?: string}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=option]")];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = items[Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), items.length - 1)];
    next?.focus();
  };

  return (
    <div role="listbox" aria-label={label} onKeyDown={onKeyDown} className={`sf-picker-col relative h-52 overflow-y-auto py-[5.5rem] ${className}`}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="option"
          aria-selected={o.selected}
          tabIndex={o.selected ? 0 : -1}
          onClick={o.pick}
          className={`block w-full rounded-md py-1.5 text-center text-sm tabular-nums outline-none transition focus-visible:ring-1 focus-visible:ring-white/60 ${
            o.selected
              ? "sf-panel-active text-white"
              : "text-white/65 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  value: string; // "HH:MM" or "" when unset
  onChange: (value: string) => void;
  label: string;
  // Time to start from when nothing is picked yet.
  suggestion: string;
  align?: "left" | "right";
};

export default function TimePicker({value, onChange, label, suggestion, align = "left"}: Props) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const {hour12, minute, pm} = toParts(value || suggestion);
  const minutes = Array.from({length: 60 / MINUTE_STEP}, (_, i) => i * MINUTE_STEP);
  // Keep an off-step minute (e.g. 10:43 saved earlier) selectable.
  if (!minutes.includes(minute)) {
    minutes.push(minute);
    minutes.sort((a, b) => a - b);
  }

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const panel = root.current;
    // Center each column on its selected value and put focus on the hour.
    panel?.querySelectorAll<HTMLElement>("[role=listbox]").forEach((col) => {
      const sel = col.querySelector<HTMLElement>("[aria-selected=true]");
      if (sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.offsetHeight / 2;
    });
    panel?.querySelector<HTMLElement>("[role=listbox] [aria-selected=true]")?.focus({preventScroll: true});

    const onPointerDown = (e: PointerEvent) => {
      if (!panel?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={root} className="relative min-w-0 flex-1">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          // Open upward when there isn't room for the panel below the field.
          const rect = trigger.current?.getBoundingClientRect();
          if (rect) setOpenUp(window.innerHeight - rect.bottom < 300 && rect.top > 300);
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center justify-between gap-2 border-b px-1 py-2 text-left tabular-nums outline-none transition focus-visible:border-scene ${
          open ? "border-scene" : "border-white/30 hover:border-white/60"
        }`}
      >
        <span className={`truncate whitespace-nowrap ${value ? "text-white" : "text-white/45"}`}>{value ? formatTime(value) : "--:-- --"}</span>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-white/50" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 4.5V8l2.3 1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
          className={`sf-pop absolute z-30 w-56 ${openUp ? "bottom-full mb-2" : "top-full mt-2"} sf-panel rounded-xl border p-2 [text-shadow:none] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex gap-1">
            <Column
              label="Hour"
              className="flex-1"
              options={HOURS.map((h) => ({
                key: `h${h}`,
                label: String(h),
                selected: h === hour12,
                pick: () => onChange(fromParts(h, minute, pm)),
              }))}
            />
            <Column
              label="Minute"
              className="flex-1"
              options={minutes.map((m) => ({
                key: `m${m}`,
                label: String(m).padStart(2, "0"),
                selected: m === minute,
                pick: () => onChange(fromParts(hour12, m, pm)),
              }))}
            />
            <Column
              label="AM or PM"
              className="w-14 shrink-0"
              options={[false, true].map((isPm) => ({
                key: isPm ? "pm" : "am",
                label: isPm ? "PM" : "AM",
                selected: isPm === pm,
                pick: () => onChange(fromParts(hour12, minute, isPm)),
              }))}
            />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-dashed border-white/15 px-1 pt-2">
            <span className="text-xs text-scene-soft tabular-nums">{formatTime(fromParts(hour12, minute, pm))}</span>
            <button
              type="button"
              onClick={() => {
                onChange(fromParts(hour12, minute, pm));
                close();
              }}
              className="border border-scene/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
