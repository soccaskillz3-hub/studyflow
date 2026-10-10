"use client";

import {use, useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent} from "react";
import CalendarNav from "../../components/CalendarNav";
import StartButton from "../../components/StartButton";
import SectionLabel from "../../components/SectionLabel";
import SessionForm from "../../components/SessionForm";
import TimePicker from "../../components/TimePicker";
import {classesOn, useClasses} from "../../lib/classes";
import {dayEntries, hourRange, layoutBlocks} from "../../lib/dayLayout";
import {addDays, formatDay, isDayKey} from "../../lib/days";
import {useSchedule} from "../../lib/schedule";
import {formatHour, formatMinutes, formatTime, fromMinutes, nowMinutes, toMinutes} from "../../lib/time";

const HOUR_PX = 72;
const PX_PER_MIN = HOUR_PX / 60;
const SNAP = 15; // minutes; clicked times round down to this
const LATEST_START = 24 * 60 - 5 - SNAP; // 11:40 PM, so a new session still fits before 11:55 PM
const LATEST_END = 24 * 60 - 5; // 11:55 PM

type Drag =
  | {mode: "create"; anchor: number; moved: boolean} // pressing on open space and dragging
  | {mode: "start" | "end"} // the new block's top or bottom edge
  | {mode: "move"; offset: number; length: number}; // the new block itself

// Whether the screen is at least as wide as Tailwind's sm breakpoint. Phones keep the add panel
// as a sheet along the bottom; wider screens show it right next to the new block.
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

// One day, hour by hour: today by default, or any day as /calendar?day=2026-10-14.
export default function CalendarPage({searchParams}: PageProps<"/calendar">) {
  const {day: requested} = use(searchParams);
  const {today} = useSchedule();
  const day = isDayKey(requested) ? requested : today;
  // Keyed by day, so moving to another day starts fresh (no half-added session carried over).
  return day && today ? <DayView key={day} day={day} isToday={day === today} /> : null;
}

function ComposerHeading({day, isToday, overlaps}: {day: string; isToday: boolean; overlaps: string[]}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="text-[11px] uppercase tracking-[0.3em] text-white/80">
        New session{isToday ? "" : ` · ${formatDay(day, {weekday: "short", month: "short", day: "numeric"})}`}
      </p>
      {overlaps.length > 0 && <p className="text-xs text-amber-200">Overlaps {overlaps.join(", ")}</p>}
    </div>
  );
}

// Adding a session right inside its dashed block (wider screens): type the name, press Enter. Drag
// the block or its edges for the time, or click a time for exact minutes. Short blocks fit it all on one line.
function BlockComposer({
  day,
  start,
  end,
  overlaps,
  oneLine,
  onTimesChange,
  onClose,
}: {
  day: string;
  start: string;
  end: string;
  overlaps: string[];
  oneLine: boolean;
  onTimesChange: (start: string, end: string) => void;
  onClose: () => void;
}) {
  const {addSession} = useSchedule();
  const [name, setName] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [missingName, setMissingName] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only with a mouse: focusing on a touch screen would pop the keyboard over the calendar.
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus({preventScroll: true});
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const subject = name.trim() || (isBreak ? "Break" : "");
    if (!subject) {
      setMissingName(true);
      return input.current?.focus();
    }
    addSession({subject, start, end, isBreak}, day);
    onClose();
  };

  const minutes = toMinutes(end) - toMinutes(start);
  const times = (
    // Not clipped (no truncate) here, or the time pickers' dropdowns would be cut off.
    <span className="flex min-w-0 items-baseline whitespace-nowrap text-[11px] text-scene-soft/90">
      <TimePicker inline value={start} onChange={(v) => onTimesChange(v, end)} label="Start time" suggestion={start} />
      <span>&nbsp;–&nbsp;</span>
      <TimePicker inline value={end} onChange={(v) => onTimesChange(start, v)} label="End time" suggestion={end} />
      <span className="tabular-nums">&nbsp;· {formatMinutes(minutes)}</span>
      {overlaps.length > 0 && <span className="min-w-0 truncate text-amber-200">&nbsp;· overlaps {overlaps.join(", ")}</span>}
    </span>
  );

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      aria-label="Add a session"
      className="cursor-auto"
    >
      <div className="flex items-center gap-2">
        <input
          ref={input}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMissingName(false);
          }}
          placeholder={missingName ? "Give it a name first" : isBreak ? "Break" : "Name it, e.g. CS 135"}
          aria-label="Subject"
          aria-invalid={missingName}
          autoComplete="off"
          className={`min-w-0 flex-1 select-text bg-transparent p-0 text-sm text-white outline-none ${
            missingName ? "placeholder:text-rose-300" : "placeholder:text-scene-soft/70"
          }`}
        />
        {oneLine && times}
        <button
          type="button"
          aria-pressed={isBreak}
          onClick={() => setIsBreak((b) => !b)}
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.2em] transition ${
            isBreak ? "bg-scene/25 text-scene-ink" : "text-white/55 hover:text-white"
          }`}
        >
          Break
        </button>
        <button
          type="submit"
          className="shrink-0 rounded border border-scene/70 bg-slate-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-scene-ink transition hover:bg-scene/20"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          className="shrink-0 px-1 text-sm leading-none text-white/55 transition hover:text-white"
        >
          ×
        </button>
      </div>
      {!oneLine && <div className="mt-0.5">{times}</div>}
    </form>
  );
}

function DayView({day, isToday}: {day: string; isToday: boolean}) {
  const swipeArea = useRef<HTMLElement>(null);
  const {sessionsOn, isLoaded, loadDays, completed, toggle, removeSession} = useSchedule();
  const {classes} = useClasses();
  // The current time, for today only. Null until mounted: the server doesn't know the visitor's local time.
  const [clock, setClock] = useState<number | null>(null);
  const now = isToday ? clock : null;
  const nowLine = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  // The session being added from the calendar, previewed as a dashed block while the panel is open.
  const [draft, setDraft] = useState<{start: string; end: string} | null>(null);
  const [composerKey, setComposerKey] = useState(0); // bumped to reset the form for each new slot
  const [hover, setHover] = useState<number | null>(null); // minutes under the mouse, on open space
  const [creating, setCreating] = useState(false); // dragging out a new block (panel opens on release)
  const drag = useRef<Drag | null>(null);
  const skipClick = useRef(false); // a drag ends in a click event, which shouldn't open another panel
  const wide = useWide();

  const sessions = sessionsOn(day);
  const loaded = isLoaded(day);

  useEffect(() => {
    loadDays(day, day);
  }, [day, loadDays]);

  useEffect(() => {
    const tick = () => setClock(nowMinutes());
    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Bring the current time into view once, after the schedule has loaded. On phones the day scrolls
  // inside its own box, so scroll that; on wider screens the box doesn't scroll, so move the page.
  useEffect(() => {
    const box = scroller.current;
    if (scrolled.current || now === null || !loaded || !box || !nowLine.current) return;
    if (getComputedStyle(box).overflowY === "auto") {
      const offset = nowLine.current.getBoundingClientRect().top - box.getBoundingClientRect().top;
      box.scrollTo({top: box.scrollTop + offset - box.clientHeight / 2, behavior: "smooth"});
    } else {
      nowLine.current.scrollIntoView({block: "center", behavior: "smooth"});
    }
    scrolled.current = true;
  }, [now, loaded]);

  // Bring the new block (and on phones, its panel) into view when it opens.
  useEffect(() => {
    if (composerKey > 0) ghost.current?.scrollIntoView({block: "nearest", behavior: "smooth"});
  }, [composerKey]);

  const updateDraft = useCallback((start: string, end: string) => setDraft({start, end}), []);
  const closeComposer = () => setDraft(null);

  const dayClasses = classesOn(classes, day);
  const entries = dayEntries(sessions, dayClasses);

  // Show a normal waking day, stretched to fit every session and class, the draft and the current time.
  const {first: firstHour, last: lastHour} = hourRange(draft ? [...entries, draft] : entries, now);
  const hours = Array.from({length: lastHour - firstHour}, (_, i) => firstHour + i);
  const top = (minutes: number) => (minutes - firstHour * 60) * PX_PER_MIN;

  const blocks = layoutBlocks(entries);
  const current = now === null ? undefined : blocks.find((b) => b.start <= now && now < b.end);
  const upcoming = now === null ? undefined : blocks.find((b) => b.start > now);

  // Time under a point on the grid, rounded down to the snap and kept inside the day.
  const minutesAt = (clientY: number) => {
    const rect = grid.current!.getBoundingClientRect();
    const minutes = firstHour * 60 + (clientY - rect.top) / PX_PER_MIN;
    const latest = Math.min(lastHour * 60 - SNAP, LATEST_START);
    return Math.min(Math.max(Math.floor(minutes / SNAP) * SNAP, firstHour * 60), latest);
  };
  // The same, rounded to the nearest snap: for dragging an edge, which should land where the pointer is.
  const minutesNear = (clientY: number) => {
    const rect = grid.current!.getBoundingClientRect();
    const minutes = firstHour * 60 + (clientY - rect.top) / PX_PER_MIN;
    return Math.min(Math.max(Math.round(minutes / SNAP) * SNAP, firstHour * 60), LATEST_END);
  };

  // Dragging on open space draws a new block from where the press began.
  const createFrom = (anchor: number, at: number) =>
    setDraft({
      start: fromMinutes(Math.min(anchor, at)),
      end: fromMinutes(Math.min(Math.max(anchor, at) + SNAP, LATEST_END)),
    });

  // Dragging the new block's edges or body (mouse or touch). Which part is in its data-drag.
  const grab = (e: ReactPointerEvent<HTMLElement>) => {
    const mode = e.currentTarget.dataset.drag as "start" | "end" | "move";
    // Typing, clicking a button or picking a time inside the block, not dragging it.
    if ((e.target as HTMLElement).closest("input, button, [role=dialog]")) return;
    if (!draft || draftStart === null || draftEnd === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current =
      mode === "move"
        ? {mode, offset: minutesNear(e.clientY) - draftStart, length: draftEnd - draftStart}
        : {mode};
  };
  const pull = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.mode === "create" || draftStart === null || draftEnd === null) return;
    const at = minutesNear(e.clientY);
    if (d.mode === "start") updateDraft(fromMinutes(Math.min(at, draftEnd - SNAP)), fromMinutes(draftEnd));
    else if (d.mode === "end") updateDraft(fromMinutes(draftStart), fromMinutes(Math.max(at, draftStart + SNAP)));
    else if (d.mode === "move") {
      const start = Math.min(Math.max(at - d.offset, firstHour * 60), LATEST_END - d.length);
      updateDraft(fromMinutes(start), fromMinutes(start + d.length));
    }
  };
  const letGo = () => {
    drag.current = null;
  };

  // Open the add panel at a start time. It runs an hour, or until the next session if that comes sooner.
  const openComposer = (requested: number) => {
    const start = Math.min(requested, LATEST_START);
    const next = blocks.find((b) => b.start >= start + SNAP && b.start < start + 60);
    setDraft({start: fromMinutes(start), end: fromMinutes(next ? next.start : start + 60)});
    setComposerKey((k) => k + 1);
    setHover(null);
  };

  const draftStart = draft?.start ? toMinutes(draft.start) : null;
  const draftEnd = draft?.end ? toMinutes(draft.end) : null;
  const draftValid = draftStart !== null && draftEnd !== null && draftEnd > draftStart;
  const editing = wide && !creating; // the new block is the editor itself (phones get a sheet)
  const overlaps = draftValid
    ? entries.filter((e) => toMinutes(e.start) < draftEnd && draftStart < toMinutes(e.end))
    : [];

  let status = "";
  if (now !== null) {
    if (current) status = `${current.entry.label} · ${formatMinutes(current.end - now)} left`;
    else if (upcoming) status = `Free · ${upcoming.entry.label} in ${formatMinutes(upcoming.start - now)}`;
    else status = entries.length ? "Nothing else scheduled today" : "Nothing scheduled today";
  } else if (loaded) {
    const studyMinutes = sessions
      .filter((s) => !s.isBreak)
      .reduce((sum, s) => sum + toMinutes(s.end) - toMinutes(s.start), 0);
    const parts = [
      studyMinutes ? `${formatMinutes(studyMinutes)} of study` : "",
      dayClasses.length ? `${dayClasses.length} ${dayClasses.length === 1 ? "class" : "classes"}` : "",
    ].filter(Boolean);
    status = parts.length ? parts.join(" · ") : "Nothing planned";
  }

  return (
    <section ref={swipeArea} className="mt-12">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SectionLabel>{isToday ? "Today" : formatDay(day, {weekday: "long"})}</SectionLabel>
        </div>
        <CalendarNav
          prev={`/calendar?day=${addDays(day, -1)}`}
          next={`/calendar?day=${addDays(day, 1)}`}
          home="/calendar"
          homeLabel="Today"
          atHome={isToday}
          prevLabel="Previous day"
          nextLabel="Next day"
          swipeArea={swipeArea}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {!isToday
            ? formatDay(day, {month: "long", day: "numeric", year: "numeric"})
            : now === null
              ? " "
              : formatTime(fromMinutes(now))}
        </p>
        <p className="text-sm text-scene-soft">{status}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm text-white/60">
          {loaded && entries.length === 0 ? "Your day is open. " : ""}Pick an open time to add a session.
        </p>
        <button
          type="button"
          onClick={() => openComposer(now === null ? 9 * 60 : Math.ceil((now + 1) / SNAP) * SNAP)}
          className="border border-scene/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15 active:scale-[0.98]"
        >
          + Add
        </button>
      </div>

      <div ref={scroller} className="sf-day-scroll mt-4 sm:mt-8">
        <div className="py-8 sm:py-0">
          <div className="relative flex" style={{height: hours.length * HOUR_PX}}>
            {/* Hour labels */}
            <div className="relative w-14 shrink-0 sm:w-16">
              {[...hours, lastHour].map((h) => {
                const isNow = now !== null && Math.floor(now / 60) === h;
                return (
                  <span
                    key={h}
                    className={`absolute -translate-y-1/2 text-[11px] tabular-nums ${isNow ? "text-scene-soft" : "text-white/55"}`}
                    style={{top: top(h * 60)}}
                  >
                    {formatHour(h)}
                  </span>
                );
              })}
            </div>

            {/* Grid, sessions and classes */}
            <div
              ref={grid}
              className="relative flex-1 cursor-pointer select-none"
              onPointerDown={(e) => {
                // With a mouse or pen, press and drag to draw the session. Touch screens scroll the
                // day instead, so there a tap opens the panel (see onClick) and the block's handles
                // adjust it.
                if (e.button !== 0 || e.pointerType === "touch") return;
                if ((e.target as HTMLElement).closest("[data-block], [data-composer]")) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = {mode: "create", anchor: minutesAt(e.clientY), moved: false};
                setHover(null);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (d?.mode === "create") {
                  const at = minutesAt(e.clientY);
                  if (at !== d.anchor) d.moved = true;
                  if (d.moved) {
                    setCreating(true);
                    createFrom(d.anchor, at);
                  }
                  return;
                }
                if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("[data-block], [data-composer]")) return setHover(null);
                setHover(minutesAt(e.clientY));
              }}
              onPointerUp={() => {
                const d = drag.current;
                if (d?.mode !== "create") return;
                drag.current = null;
                skipClick.current = true;
                if (d.moved) {
                  setCreating(false);
                  setComposerKey((k) => k + 1);
                } else {
                  openComposer(d.anchor);
                }
              }}
              onClick={(e) => {
                if (skipClick.current) {
                  skipClick.current = false;
                  return;
                }
                if ((e.target as HTMLElement).closest("[data-block], [data-composer]")) return;
                openComposer(minutesAt(e.clientY));
              }}
              onPointerLeave={() => setHover(null)}
            >
              {hours.map((h) => {
                const isNow = now !== null && Math.floor(now / 60) === h;
                return (
                  <div
                    key={h}
                    className={`absolute inset-x-0 border-t border-white/15 ${isNow ? "bg-white/[0.04]" : ""}`}
                    style={{top: top(h * 60), height: HOUR_PX}}
                  >
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/[0.07]" />
                  </div>
                );
              })}
              <div className="absolute inset-x-0 border-t border-white/15" style={{top: top(lastHour * 60)}} />

              {/* Where a click would add a session */}
              {hover !== null && !draft && (
                <div
                  className="pointer-events-none absolute inset-x-1 flex items-center rounded-md border border-dashed border-scene/50 bg-scene/[0.06] px-2.5 text-[11px] text-scene-soft/90 tabular-nums"
                  style={{top: top(hover) + 1, height: 2 * SNAP * PX_PER_MIN - 2}}
                  aria-hidden
                >
                  + {formatTime(fromMinutes(hover))}
                </div>
              )}

              {blocks.map(({entry, start, end, lane, lanes}) => {
                const isCurrent = now !== null && start <= now && now < end;
                const isPast = now !== null && end <= now;
                const height = Math.max((end - start) * PX_PER_MIN, 22);
                const compact = height < 44;
                const place = {
                  top: top(start) + 1,
                  height: height - 2,
                  left: `calc(${(lane / lanes) * 100}% + 4px)`,
                  width: `calc(${100 / lanes}% - 6px)`,
                };

                if (entry.kind === "class") {
                  const {meeting} = entry;
                  return (
                    <div
                      key={entry.id}
                      data-block
                      data-state={isCurrent ? "current" : isPast ? "past" : undefined}
                      title={meeting.title || undefined}
                      className={`sf-class-block absolute z-[2] flex cursor-default overflow-hidden rounded-md border border-l-4 px-2.5 backdrop-blur-sm ${
                        compact ? "items-center gap-2 py-0.5" : "flex-col py-1.5"
                      }`}
                      style={place}
                    >
                      <span className="block truncate text-sm font-semibold">
                        {entry.label}
                        <span className="ml-2 text-[10px] font-normal uppercase tracking-[0.2em] opacity-70">Class</span>
                      </span>
                      <span className="block truncate text-[11px] tabular-nums opacity-80">
                        {formatTime(meeting.start)} – {formatTime(meeting.end)}
                        {meeting.location && ` · ${meeting.location}`}
                      </span>
                    </div>
                  );
                }

                const {session} = entry;
                const done = completed.includes(session.id);
                // The focus timer runs today's sessions.
                const canStart = isToday && !done && !session.isBreak;
                return (
                  <div
                    key={session.id}
                    data-block
                    className={`group absolute z-[2] overflow-hidden rounded-md border backdrop-blur-sm transition hover:brightness-125 ${
                      done
                        ? "border-scene/40 bg-scene/15"
                        : session.isBreak
                          ? "border-dashed border-white/35 bg-white/[0.04]"
                          : isCurrent
                            ? "sf-block-current border-scene shadow-[0_0_18px_var(--accent-glow)]"
                            : isPast
                              ? "border-white/20 bg-white/[0.05]"
                              : "border-white/35 bg-slate-900/40"
                    }`}
                    style={place}
                  >
                    {/* The part of the current session already gone, as a soft fill rather than
                        the now line cutting through the block and its Start button. */}
                    {isCurrent && (
                      <span
                        className="sf-block-elapsed pointer-events-none absolute inset-x-0 top-0"
                        style={{height: Math.min((now - start) * PX_PER_MIN, height)}}
                        aria-hidden
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(session.id)}
                      aria-pressed={done}
                      aria-label={`${session.subject}, ${formatTime(session.start)} to ${formatTime(session.end)}${done ? ", done" : ""}`}
                      className={`relative flex h-full w-full min-w-0 px-2.5 text-left ${
                        compact ? "items-center gap-2 py-0.5" : "flex-col py-1.5"
                      } ${canStart ? "pr-[6.5rem]" : "pr-9"}`}
                    >
                      <span
                        className={`block truncate text-sm ${
                          done ? "text-white/55 line-through" : session.isBreak || isPast ? "text-white/65" : "text-white"
                        }`}
                      >
                        {session.subject}
                      </span>
                      <span
                        className={`block truncate text-[11px] tabular-nums ${done || isPast ? "text-white/45" : "text-scene-soft/90"}`}
                      >
                        {formatTime(session.start)} – {formatTime(session.end)}
                      </span>
                    </button>
                    {/* Remove: shown on hover with a mouse, always on touch screens (no hover there). */}
                    <button
                      type="button"
                      onClick={() => removeSession(session.id)}
                      aria-label={`Remove ${session.subject}`}
                      title="Remove"
                      className={`absolute right-1 flex h-6 w-6 items-center justify-center rounded text-base leading-none text-white/50 transition hover:bg-white/10 hover:text-rose-300 focus-visible:opacity-100 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 ${
                        compact ? "top-1/2 -translate-y-1/2" : "top-1"
                      }`}
                    >
                      ×
                    </button>
                    {canStart && (
                      <StartButton
                        session={session}
                        className={`absolute right-8 rounded border border-scene/60 bg-slate-950/75 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-scene-ink transition hover:bg-scene/20 ${
                          compact ? "top-1/2 -translate-y-1/2" : "top-1.5"
                        }`}
                      />
                    )}
                  </div>
                );
              })}

              {/* The session being added. Drag its body to move it, or its top and bottom edges to
                  change when it starts and ends. */}
              {draftValid && (
                <div
                  ref={ghost}
                  data-composer
                  data-drag="move"
                  onPointerDown={creating ? undefined : grab}
                  onPointerMove={pull}
                  onPointerUp={letGo}
                  onPointerCancel={letGo}
                  className={`absolute inset-x-1 z-[5] touch-none rounded-md border-2 border-dashed border-scene bg-scene/10 px-2.5 py-1 shadow-[0_0_18px_var(--accent-glow)] ${
                    creating ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"
                  } ${editing ? "" : "overflow-hidden"}`}
                  style={{top: top(draftStart) + 1, height: Math.max((draftEnd - draftStart) * PX_PER_MIN, 22) - 2}}
                >
                  {editing ? (
                    <BlockComposer
                      key={composerKey}
                      day={day}
                      start={draft!.start}
                      end={draft!.end}
                      overlaps={overlaps.map((e) => e.label)}
                      oneLine={draftEnd - draftStart < 45}
                      onTimesChange={updateDraft}
                      onClose={closeComposer}
                    />
                  ) : (
                    <div aria-hidden>
                      <span className="block truncate text-sm text-scene-ink">New session</span>
                      <span className="block truncate text-[11px] text-scene-soft/90 tabular-nums">
                        {formatTime(draft!.start)} – {formatTime(draft!.end)} · {formatMinutes(draftEnd - draftStart)}
                      </span>
                    </div>
                  )}
                  {!creating &&
                    (["start", "end"] as const).map((edge) => (
                      <span
                        key={edge}
                        data-drag={edge}
                        onPointerDown={grab}
                        onPointerMove={pull}
                        onPointerUp={letGo}
                        onPointerCancel={letGo}
                        aria-hidden
                        // Just the grip while editing, so the edge doesn't cover the name box.
                        className={`absolute flex h-3 cursor-ns-resize touch-none justify-center ${
                          editing ? "left-1/2 w-14 -translate-x-1/2" : "inset-x-0"
                        } ${edge === "start" ? "-top-0.5 items-start" : "-bottom-0.5 items-end"}`}
                      >
                        <span className="my-0.5 h-1 w-8 rounded-full bg-scene/80 shadow-[0_0_6px_var(--accent-glow)]" />
                      </span>
                    ))}
                </div>
              )}

              {/* Current time. It runs behind the blocks (they sit above it), so it never
                  crosses a session's text or buttons. */}
              {now !== null && (
                <div
                  ref={nowLine}
                  className="pointer-events-none absolute inset-x-0 z-[1] -translate-y-1/2"
                  style={{top: top(now)}}
                  aria-hidden
                >
                  <div className="h-[2px] bg-scene shadow-[0_0_10px_var(--accent-glow)]" />
                  <div className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-scene-soft shadow-[0_0_10px_var(--accent-glow)]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phones: the add panel is a sheet along the bottom, clear of the keyboard and the
          day's own scrolling. */}
      {draft && !wide && (
        <div
          role="dialog"
          aria-label="Add a session"
          className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeComposer();
          }}
        >
          <div className="sf-panel sf-sheet mx-auto max-w-3xl rounded-2xl border p-4 [text-shadow:none]">
            <ComposerHeading day={day} isToday={isToday} overlaps={overlaps.map((e) => e.label)} />
            <SessionForm
              key={composerKey}
              day={day}
              start={draft.start}
              end={draft.end}
              autoFocus
              onAdded={closeComposer}
              onCancel={closeComposer}
              onTimesChange={updateDraft}
            />
          </div>
        </div>
      )}
    </section>
  );
}
