"use client";

import Link from "next/link";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import SectionLabel from "../components/SectionLabel";
import SessionList from "../components/SessionList";
import StartButton from "../components/StartButton";
import Flame from "../components/Flame";
import WeekBars from "../components/WeekBars";
import {takeCelebration, type Celebration} from "../lib/celebrate";
import {classesOn, useClasses} from "../lib/classes";
import {weekStart} from "../lib/days";
import {streaks, useStudyHistory, useWeek} from "../lib/history";
import {sessionMinutes, useSchedule} from "../lib/schedule";
import {formatMinutes, formatShortTime, formatTime, nowMinutes, toMinutes} from "../lib/time";

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
const primaryButton =
  "border border-scene/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-scene-ink transition hover:bg-scene/15 active:scale-[0.98]";
const secondaryButton =
  "border border-white/30 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/80 transition hover:border-white/60 hover:text-white active:scale-[0.98]";

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
        {loaded && !planned ? (
          <div className="max-w-sm">
            <p className="font-display text-4xl leading-none sm:text-5xl">A fresh week</p>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Plan a few study sessions and your week fills in here, day by day.
            </p>
            <Link href="/calendar/week" className={`mt-5 inline-block ${primaryButton}`}>
              Plan your week
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="text-5xl font-semibold leading-none tracking-tight tabular-nums sm:text-6xl">
                {loaded ? formatMinutes(Math.round(shownDone)) : " "}
              </p>
              {loaded && (
                <p className="pb-1 text-sm text-scene-soft tabular-nums">
                  of {formatMinutes(planned)} planned
                </p>
              )}
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-white/65">
              {loaded ? `Studied on ${studiedDays} of 7 days` : " "}
            </p>
          </div>
        )}

        {/* Kept the same size while it loads, so nothing jumps. */}
        <div className={`flex items-center gap-3 ${streak ? "" : "invisible"}`}>
          <Flame lit={streak?.studiedToday ?? false} className="h-8 w-8" />
          <div>
            {streak?.current ? (
              <p className="text-3xl font-semibold leading-none tabular-nums">
                {streak.current}
                <span className="ml-2 text-sm font-normal text-scene-soft">day streak</span>
              </p>
            ) : (
              <p className="text-lg leading-none text-white/90">{streak?.best ? "Start a new streak" : "No streak yet"}</p>
            )}
            <p className="mt-2 text-[11px] text-white/60">
              {!streak
                ? " "
                : streak.studiedToday
                  ? "Today counts. Nice work."
                  : streak.current
                    ? "Finish a session today to keep it"
                    : streak.best
                      ? `Your best is ${streak.best} ${streak.best === 1 ? "day" : "days"}`
                      : "One finished session starts it"}
            </p>
          </div>
        </div>
      </div>

      {/* An empty week has nothing to chart yet. */}
      {(!loaded || planned > 0) && (
        <div className="mt-8">
          <WeekBars totals={totals} today={today} height={56} labels={false} />
        </div>
      )}
    </section>
  );
}

// Today's classes in a line, in their own colour; the ones already over are dimmed.
function ClassesToday({today, clock}: {today: string; clock: number}) {
  const {classes} = useClasses();
  const list = classesOn(classes, today);
  if (!list.length) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <span className="text-[11px] uppercase tracking-[0.3em] text-white/60">Classes</span>
      {list.map((c) => (
        <span key={c.id} className={`flex items-center gap-2 ${toMinutes(c.end) <= clock ? "text-white/40" : "text-white/85"}`}>
          <span className="sf-class-block h-2.5 w-2.5 shrink-0 rounded-[2px] border border-l-[3px]" aria-hidden />
          {c.code} {c.component}
          <span className="text-white/50 tabular-nums">{formatShortTime(c.start)}</span>
        </span>
      ))}
    </div>
  );
}

// The time of day in minutes, kept current.
function useClock() {
  const [clock, setClock] = useState(nowMinutes);
  useEffect(() => {
    const id = setInterval(() => setClock(nowMinutes()), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

// The dashboard: the week first, then today (progress, what's next, and today's sessions).
export default function Dashboard() {
  const {today} = useSchedule();
  if (!today) return null;
  return <DashboardView today={today} />;
}

function DashboardView({today}: {today: string}) {
  const {sessions, completed, loaded} = useSchedule();
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
  const clock = useClock();
  const {classes} = useClasses();
  const hasClasses = classesOn(classes, today).length > 0;
  // What to do next: the session on now, or the next one coming up; failing those, one that was
  // missed earlier today.
  const undone = studySessions.filter((s) => !completed.includes(s.id));
  const nextSession = undone.find((s) => toMinutes(s.end) > clock) ?? undone[0];
  const nextState = !nextSession
    ? null
    : toMinutes(nextSession.end) <= clock
      ? "missed"
      : toMinutes(nextSession.start) <= clock
        ? "now"
        : "next";
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

      {!loaded ? (
        // Today's schedule is still loading: hold the space rather than flash "nothing planned".
        <div className="mt-16 h-64" aria-busy />
      ) : sessions.length === 0 ? (
        <section className="mt-16">
          <SectionLabel>Today</SectionLabel>
          <p className="mt-6 text-3xl font-semibold tracking-tight text-white/90">
            {hasClasses ? "No study planned today" : "Nothing planned today"}
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65">
            Add a study session when you&apos;re ready, or just open the clock and enjoy the view.
          </p>
          <ClassesToday today={today} clock={clock} />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/calendar/schedule" className={primaryButton}>
              Add a session
            </Link>
            <Link href="/clock" className={secondaryButton}>
              Open the clock
            </Link>
          </div>
        </section>
      ) : (
        <>
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
            <ClassesToday today={today} clock={clock} />
          </section>

          <section className="mt-16">
            <SectionLabel>{nextState === "now" ? "Now" : nextState === "missed" ? "Still to do" : "Next up"}</SectionLabel>
            <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              {nextSession ? (
                <>
                  <p className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{nextSession.subject}</p>
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-scene-soft tabular-nums">
                      {formatTime(nextSession.start)} – {formatTime(nextSession.end)}
                      {nextState === "now" && (
                        <span className="text-white/55"> · {formatMinutes(toMinutes(nextSession.end) - clock)} left</span>
                      )}
                    </p>
                    <StartButton session={nextSession} className={primaryButton} />
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
      )}
    </>
  );
}
