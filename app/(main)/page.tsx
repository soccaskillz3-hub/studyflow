"use client";

import Link from "next/link";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import SectionLabel from "../components/SectionLabel";
import SessionList from "../components/SessionList";
import Flame from "../components/Flame";
import WeekBars from "../components/WeekBars";
import {takeCelebration, type Celebration} from "../lib/celebrate";
import {weekStart} from "../lib/days";
import {streaks, useStudyHistory, useWeek} from "../lib/history";
import {sessionMinutes, useSchedule} from "../lib/schedule";
import {formatMinutes, formatTime} from "../lib/time";

// Hour ticks along the progress line: every hour, or every two for long days.
function hourTicks(planned: number) {
  if (planned === 0) return [0];
  const step = planned <= 300 ? 60 : 120;
  const ticks: number[] = [];
  for (let t = 0; t < planned; t += step) ticks.push(t);
  // Keep the end label from colliding with the last hour tick (which matters most on narrow screens).
  if (ticks.length > 1 && (planned - ticks[ticks.length - 1]) / planned < 0.18) ticks.pop();
  return [...ticks, planned];
}

// Eases a number toward `target` whenever it changes, so totals count up instead of jumping.
// With `instant`, it jumps there instead (e.g. resetting to a starting point).
function useAnimatedNumber(target: number, duration: number, instant = false) {
  const [value, setValue] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (instant || start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setValue(target);
      return;
    }
    const began = performance.now();
    let frame = requestAnimationFrame(function step(t) {
      const k = Math.min(1, (t - began) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const next = start + (target - start) * eased;
      from.current = next;
      setValue(next);
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration, instant]);

  return value;
}

function ProgressLine({
  done,
  planned,
  gain,
  instant,
}: {
  done: number;
  planned: number;
  gain: number | null;
  instant: boolean; // jump without animating
}) {
  const pct = planned === 0 ? 0 : (done / planned) * 100;
  const speed = instant ? "duration-0" : gain ? "duration-[1400ms]" : "duration-700";
  return (
    <div className="relative mt-10 h-14">
      <div className="absolute inset-x-0 top-5 h-px bg-white/30" />
      <div
        className={`absolute left-0 top-[19px] h-[3px] rounded-full bg-scene shadow-[0_0_14px_var(--accent-glow)] transition-all ${speed} ease-out ${
          gain ? "sf-bar-boost" : ""
        }`}
        style={{width: `${pct}%`}}
      />
      <div
        className={`absolute top-0 flex -translate-x-1/2 flex-col items-center transition-all ${speed} ease-out`}
        style={{left: `${pct}%`}}
      >
        {gain !== null && (
          <span className="sf-gain absolute -top-7 left-1/2 whitespace-nowrap rounded-full border border-scene/60 bg-scene/15 px-2 py-0.5 text-[11px] text-scene-ink tabular-nums">
            +{formatMinutes(gain)}
          </span>
        )}
        <span className="text-[10px] tracking-[0.2em] text-scene-soft">{Math.round(pct)}%</span>
        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-scene-soft shadow-[0_0_10px_var(--accent-glow)]" />
      </div>
      {hourTicks(planned).map((t, i, all) => {
        const left = planned === 0 ? 0 : (t / planned) * 100;
        // First and last labels align inward so they never spill past the line's ends.
        const align =
          i === 0
            ? "items-start"
            : i === all.length - 1
              ? "-translate-x-full items-end"
              : "-translate-x-1/2 items-center";
        return (
          <div
            key={t}
            className={`absolute top-[17px] flex flex-col whitespace-nowrap ${align}`}
            style={{left: `${left}%`}}
          >
            <span className="h-[7px] w-px bg-white/40" />
            <span className="mt-2 text-[11px] text-white/60 tabular-nums">{formatMinutes(t)}</span>
          </div>
        );
      })}
    </div>
  );
}

const linkClass = "text-scene-soft underline decoration-scene/40 underline-offset-4 transition hover:text-scene-ink";

// The week at a glance: time studied against planned, the streak, and a bar for each day.
function WeekSummary({
  today,
  shownDone,
  planned,
  studiedDays,
  totals,
  loaded,
}: {
  today: string;
  shownDone: number;
  planned: number;
  studiedDays: number;
  totals: ReturnType<typeof useWeek>["totals"];
  loaded: boolean;
}) {
  const {history} = useStudyHistory();
  const streak = history && streaks(history, today);

  return (
    <section className="mt-12">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <SectionLabel>This week</SectionLabel>
        </div>
        <Link href="/progress" className={`text-[11px] uppercase tracking-[0.3em] ${linkClass}`}>
          All progress
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
        <div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-5xl font-semibold leading-none tracking-tight tabular-nums sm:text-6xl">
              {loaded ? formatMinutes(Math.round(shownDone)) : " "}
            </p>
            {loaded && (
              <p className="pb-1 text-sm text-scene-soft tabular-nums">
                {planned ? `of ${formatMinutes(planned)} planned` : "studied"}
              </p>
            )}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-white/65">
            {!loaded ? (
              " "
            ) : planned ? (
              `Studied on ${studiedDays} of 7 days`
            ) : (
              <Link href="/calendar/week" className={linkClass}>
                Plan your week
              </Link>
            )}
          </p>
        </div>

        {/* Kept the same size while it loads, so nothing jumps. */}
        <div className={`flex items-center gap-3 ${streak ? "" : "invisible"}`}>
          <Flame lit={streak?.studiedToday ?? false} className="h-8 w-8" />
          <div>
            <p className="text-3xl font-semibold leading-none tabular-nums">
              {streak?.current ?? 0}
              <span className="ml-2 text-sm font-normal text-scene-soft">
                day streak
              </span>
            </p>
            <p className="mt-2 text-[11px] text-white/60">
              {!streak
                ? " "
                : streak.studiedToday
                  ? "Today counts. Nice work."
                  : streak.current
                    ? "Finish a session today to keep it"
                    : "Finish a session today to start one"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <WeekBars totals={totals} today={today} height={56} labels={false} />
      </div>
    </section>
  );
}

// The dashboard: the week first, then today (progress, what's next, and today's sessions).
export default function Dashboard() {
  const {today} = useSchedule();
  if (!today) return null;
  return <DashboardView today={today} />;
}

function DashboardView({today}: {today: string}) {
  const {sessions, completed} = useSchedule();
  // Coming back from a finished focus session: start at the old total, then animate up.
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [settled, setSettled] = useState(false);

  // A layout effect runs before the first paint, so the new total never flashes before the animation.
  // Only ever set, never cleared: React's dev-mode double effects would otherwise read it, then wipe it.
  useLayoutEffect(() => {
    const handoff = takeCelebration();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pick up the hand-off from the focus page once
    if (handoff) setCelebration(handoff);
  }, []);

  useEffect(() => {
    if (!celebration) return;
    const id = setTimeout(() => setSettled(true), 450);
    return () => clearTimeout(id);
  }, [celebration]);

  const studySessions = sessions.filter((s) => !s.isBreak);
  const plannedMinutes = studySessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const doneMinutes = studySessions
    .filter((s) => completed.includes(s.id))
    .reduce((sum, s) => sum + sessionMinutes(s), 0);
  // Before settling, snap back to the total from before the session; then animate up to the new one.
  const resetting = celebration !== null && !settled;
  const targetDone = resetting ? Math.max(0, doneMinutes - celebration.minutes) : doneMinutes;
  const shownDone = useAnimatedNumber(targetDone, celebration ? 1400 : 700, resetting);
  const percent = plannedMinutes === 0 ? 0 : Math.round((shownDone / plannedMinutes) * 100);
  const week = useWeek(weekStart(today));
  const weekTarget = resetting ? Math.max(0, week.done - celebration.minutes) : week.done;
  const shownWeek = useAnimatedNumber(weekTarget, celebration ? 1400 : 700, resetting);
  const nextSession = studySessions.find((s) => !completed.includes(s.id));
  const doneCount = studySessions.filter((s) => completed.includes(s.id)).length;

  return (
    <>
      <WeekSummary
        today={today}
        shownDone={shownWeek}
        planned={week.planned}
        studiedDays={week.studiedDays}
        totals={week.totals}
        loaded={week.loaded}
      />

      <section className="mt-16">
        <SectionLabel>Today</SectionLabel>
        <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-2">
          <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl">
            {formatMinutes(Math.round(shownDone))}
          </p>
          <p className="pb-1.5 text-sm text-scene-soft tabular-nums">of {formatMinutes(plannedMinutes)} planned</p>
        </div>
        <ProgressLine
          done={targetDone}
          planned={plannedMinutes}
          gain={celebration && settled ? celebration.minutes : null}
          instant={resetting}
        />
        <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-scene-soft">
          {studySessions.length === 0
            ? "No study sessions yet"
            : `${doneCount} of ${studySessions.length} sessions done · ${percent}%`}
        </p>
      </section>

      <section className="mt-16">
        <SectionLabel>Next up</SectionLabel>
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          {nextSession ? (
            <>
              <p className="text-3xl font-semibold tracking-tight">{nextSession.subject}</p>
              <div className="flex items-center gap-4">
                <p className="text-sm text-scene-soft tabular-nums">
                  {formatTime(nextSession.start)} – {formatTime(nextSession.end)}
                </p>
                <Link
                  href={`/focus/${nextSession.id}`}
                  className="border border-scene/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15 active:scale-[0.98]"
                >
                  Start?
                </Link>
              </div>
            </>
          ) : studySessions.length > 0 ? (
            <>
              <p className="text-3xl font-semibold tracking-tight">All done</p>
              <p className="text-sm text-white/70">Nothing left today. Rest well.</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-semibold tracking-tight text-white/85">Nothing planned</p>
              <Link href="/calendar/schedule" className={`text-sm ${linkClass}`}>
                Plan your day
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="mt-16">
        <SectionLabel>Today&apos;s sessions</SectionLabel>
        <div className="mt-6">
          <SessionList
            empty={
              <>
                Nothing scheduled yet.{" "}
                <Link href="/calendar/schedule" className={linkClass}>
                  Add sessions
                </Link>
              </>
            }
          />
        </div>
        {sessions.length > 0 && (
          <p className="mt-4 text-right text-xs uppercase tracking-[0.2em]">
            <Link href="/calendar/schedule" className={linkClass}>
              Edit schedule
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
