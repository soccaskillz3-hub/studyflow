"use client";

import Link from "next/link";
import {useCallback, useEffect, useRef, useState} from "react";
import SectionLabel from "../../components/SectionLabel";
import SessionForm from "../../components/SessionForm";
import {useSchedule, type Session} from "../../lib/schedule";
import {formatHour, formatMinutes, formatTime, fromMinutes, nowMinutes, toMinutes} from "../../lib/time";

const HOUR_PX = 72;
const PX_PER_MIN = HOUR_PX / 60;
const SNAP = 15; // minutes; clicked times round down to this
const LATEST_START = 24 * 60 - 5 - SNAP; // 11:40 PM, so a new session still fits before 11:55 PM

type Block = {session: Session; start: number; end: number; lane: number; lanes: number};

// Place sessions in side-by-side lanes so overlapping ones don't cover each other.
// Sessions that overlap (directly or through a chain) form a cluster and share its lane count.
function layoutBlocks(sessions: Session[]): Block[] {
  const blocks: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = Math.max(...cluster.map((b) => b.lane)) + 1;
    cluster.forEach((b) => (b.lanes = lanes));
  };

  for (const session of sessions) {
    const start = toMinutes(session.start);
    const end = toMinutes(session.end);
    if (cluster.length && start >= clusterEnd) {
      closeCluster();
      cluster = [];
      laneEnds = [];
    }
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;

    const block = {session, start, end, lane, lanes: 1};
    cluster.push(block);
    blocks.push(block);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) closeCluster();
  return blocks;
}

export default function CalendarPage() {
  const {sessions, completed, loaded, toggle} = useSchedule();
  // Null until mounted: the server doesn't know the visitor's local time.
  const [now, setNow] = useState<number | null>(null);
  const nowLine = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  // The session being added from the calendar, previewed as a dashed block while the panel is open.
  const [draft, setDraft] = useState<{start: string; end: string} | null>(null);
  const [composerKey, setComposerKey] = useState(0); // bumped to reset the form for each new slot
  const [hover, setHover] = useState<number | null>(null); // minutes under the mouse, on open space

  useEffect(() => {
    const tick = () => setNow(nowMinutes());
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

  // Scroll the new block into view when the add panel opens.
  useEffect(() => {
    if (composerKey > 0) ghost.current?.scrollIntoView({block: "center", behavior: "smooth"});
  }, [composerKey]);

  const updateDraft = useCallback((start: string, end: string) => setDraft({start, end}), []);
  const closeComposer = () => setDraft(null);

  // Show a normal waking day, stretched to fit every session, the draft and the current time.
  const spans = draft ? [...sessions, draft] : sessions;
  const starts = spans.filter((s) => s.start).map((s) => toMinutes(s.start));
  const ends = spans.filter((s) => s.end).map((s) => toMinutes(s.end));
  const firstHour = Math.min(8, ...starts.map((m) => Math.floor(m / 60)), ...(now === null ? [] : [Math.floor(now / 60)]));
  const lastHour = Math.max(22, ...ends.map((m) => Math.ceil(m / 60)), ...(now === null ? [] : [Math.floor(now / 60) + 1]));
  const hours = Array.from({length: lastHour - firstHour}, (_, i) => firstHour + i);
  const top = (minutes: number) => (minutes - firstHour * 60) * PX_PER_MIN;

  const blocks = layoutBlocks(sessions);
  const current = now === null ? undefined : blocks.find((b) => b.start <= now && now < b.end);
  const upcoming = now === null ? undefined : blocks.find((b) => b.start > now);

  // Time under a point on the grid, rounded down to the snap and kept inside the day.
  const minutesAt = (clientY: number) => {
    const rect = grid.current!.getBoundingClientRect();
    const minutes = firstHour * 60 + (clientY - rect.top) / PX_PER_MIN;
    const latest = Math.min(lastHour * 60 - SNAP, LATEST_START);
    return Math.min(Math.max(Math.floor(minutes / SNAP) * SNAP, firstHour * 60), latest);
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
  const overlaps = draftValid
    ? sessions.filter((s) => toMinutes(s.start) < draftEnd && draftStart < toMinutes(s.end))
    : [];

  let status = "";
  if (now !== null) {
    if (current) status = `${current.session.subject} · ${formatMinutes(current.end - now)} left`;
    else if (upcoming) status = `Free · ${upcoming.session.subject} in ${formatMinutes(upcoming.start - now)}`;
    else status = sessions.length ? "Nothing else scheduled today" : "Nothing scheduled today";
  }

  return (
    <section className="mt-12">
      <SectionLabel>Your day</SectionLabel>
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {now === null ? " " : formatTime(fromMinutes(now))}
        </p>
        <p className="text-sm text-cyan-200">{status}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm text-white/60">
          {loaded && sessions.length === 0 ? "Your day is open. " : ""}Pick an open time to add a session.
        </p>
        <button
          type="button"
          onClick={() => openComposer(now === null ? 9 * 60 : Math.ceil((now + 1) / SNAP) * SNAP)}
          className="border border-cyan-300/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100 transition hover:bg-cyan-300/15 active:scale-[0.98]"
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
                    className={`absolute -translate-y-1/2 text-[11px] tabular-nums ${isNow ? "text-cyan-200" : "text-white/55"}`}
                    style={{top: top(h * 60)}}
                  >
                    {formatHour(h)}
                  </span>
                );
              })}
            </div>

            {/* Grid and sessions */}
            <div
              ref={grid}
              className="relative flex-1 cursor-pointer"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-block]")) return;
                openComposer(minutesAt(e.clientY));
              }}
              onPointerMove={(e) => {
                if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("[data-block]")) return setHover(null);
                setHover(minutesAt(e.clientY));
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
              {hover !== null && (
                <div
                  className="pointer-events-none absolute inset-x-1 flex items-center rounded-md border border-dashed border-cyan-300/50 bg-cyan-300/[0.06] px-2.5 text-[11px] text-cyan-200/90 tabular-nums"
                  style={{top: top(hover) + 1, height: 2 * SNAP * PX_PER_MIN - 2}}
                  aria-hidden
                >
                  + {formatTime(fromMinutes(hover))}
                </div>
              )}

              {blocks.map(({session, start, end, lane, lanes}) => {
                const done = completed.includes(session.id);
                const isCurrent = now !== null && start <= now && now < end;
                const isPast = now !== null && end <= now;
                const height = Math.max((end - start) * PX_PER_MIN, 22);
                const compact = height < 44;
                const canStart = !done && !session.isBreak;
                return (
                  <div
                    key={session.id}
                    data-block
                    className={`group absolute overflow-hidden rounded-md border backdrop-blur-sm transition hover:brightness-125 ${
                      done
                        ? "border-cyan-300/40 bg-cyan-300/15"
                        : session.isBreak
                          ? "border-dashed border-white/35 bg-white/[0.04]"
                          : isCurrent
                            ? "border-cyan-300 bg-cyan-300/20 shadow-[0_0_18px_rgba(103,232,249,0.35)]"
                            : isPast
                              ? "border-white/20 bg-white/[0.05]"
                              : "border-white/35 bg-slate-900/40"
                    }`}
                    style={{
                      top: top(start) + 1,
                      height: height - 2,
                      left: `calc(${(lane / lanes) * 100}% + 4px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(session.id)}
                      aria-pressed={done}
                      aria-label={`${session.subject}, ${formatTime(session.start)} to ${formatTime(session.end)}${done ? ", done" : ""}`}
                      className={`flex h-full w-full min-w-0 px-2.5 text-left ${
                        compact ? "items-center gap-2 py-0.5" : "flex-col py-1.5"
                      } ${canStart ? "pr-[4.75rem]" : ""}`}
                    >
                      <span
                        className={`block truncate text-sm ${
                          done ? "text-white/55 line-through" : session.isBreak || isPast ? "text-white/65" : "text-white"
                        }`}
                      >
                        {session.subject}
                      </span>
                      <span
                        className={`block truncate text-[11px] tabular-nums ${done || isPast ? "text-white/45" : "text-cyan-200/90"}`}
                      >
                        {formatTime(session.start)} – {formatTime(session.end)}
                      </span>
                    </button>
                    {canStart && (
                      <Link
                        href={`/focus/${session.id}`}
                        aria-label={`Start a focus timer for ${session.subject}`}
                        className={`absolute right-1.5 rounded border border-cyan-300/60 bg-slate-950/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-300/20 ${
                          compact ? "top-1/2 -translate-y-1/2" : "top-1.5"
                        }`}
                      >
                        Start?
                      </Link>
                    )}
                  </div>
                );
              })}

              {/* The session being added */}
              {draftValid && (
                <div
                  ref={ghost}
                  className="pointer-events-none absolute inset-x-1 z-[5] overflow-hidden rounded-md border-2 border-dashed border-cyan-300 bg-cyan-300/10 px-2.5 py-1 shadow-[0_0_18px_rgba(103,232,249,0.3)]"
                  style={{top: top(draftStart) + 1, height: Math.max((draftEnd - draftStart) * PX_PER_MIN, 22) - 2}}
                  aria-hidden
                >
                  <span className="block truncate text-sm text-cyan-100">New session</span>
                  <span className="block truncate text-[11px] text-cyan-200/90 tabular-nums">
                    {formatTime(draft!.start)} – {formatTime(draft!.end)}
                  </span>
                </div>
              )}

              {/* Current time */}
              {now !== null && (
                <div
                  ref={nowLine}
                  className="pointer-events-none absolute inset-x-0 z-10 -translate-y-1/2"
                  style={{top: top(now)}}
                  aria-hidden
                >
                  <div className="h-[2px] bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
                  <div className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {draft && (
        <div
          role="dialog"
          aria-label="Add a session"
          className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-8 sm:pb-6"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeComposer();
          }}
        >
          <div className="sf-panel sf-sheet mx-auto max-w-3xl rounded-2xl border p-4 [text-shadow:none] sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/80">New session</p>
              {overlaps.length > 0 && (
                <p className="text-xs text-amber-200">Overlaps {overlaps.map((s) => s.subject).join(", ")}</p>
              )}
            </div>
            <SessionForm
              key={composerKey}
              initialStart={draft.start}
              initialEnd={draft.end}
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
