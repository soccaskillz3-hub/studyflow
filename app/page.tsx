"use client";

import Link from "next/link";
import SectionLabel from "./components/SectionLabel";
import SessionList from "./components/SessionList";
import {sessionMinutes, useSchedule} from "./lib/schedule";
import {formatMinutes, formatTime} from "./lib/time";

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

function ProgressLine({done, planned}: {done: number; planned: number}) {
  const pct = planned === 0 ? 0 : (done / planned) * 100;
  return (
    <div className="relative mt-10 h-14">
      <div className="absolute inset-x-0 top-5 h-px bg-white/30" />
      <div
        className="absolute left-0 top-[19px] h-[3px] rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.7)] transition-all duration-700 ease-out"
        style={{width: `${pct}%`}}
      />
      <div
        className="absolute top-0 flex -translate-x-1/2 flex-col items-center transition-all duration-700 ease-out"
        style={{left: `${pct}%`}}
      >
        <span className="text-[10px] tracking-[0.2em] text-cyan-200">{Math.round(pct)}%</span>
        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
      </div>
      {hourTicks(planned).map((t, i, all) => {
        const left = planned === 0 ? 0 : (t / planned) * 100;
        // First and last labels align inward so they never spill past the line's ends.
        const align =
          i === 0 ? "items-start" : i === all.length - 1 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center";
        return (
          <div key={t} className={`absolute top-[17px] flex flex-col whitespace-nowrap ${align}`} style={{left: `${left}%`}}>
            <span className="h-[7px] w-px bg-white/40" />
            <span className="mt-2 text-[11px] text-white/60 tabular-nums">{formatMinutes(t)}</span>
          </div>
        );
      })}
    </div>
  );
}

const linkClass = "text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100";

export default function Today() {
  const {sessions, completed} = useSchedule();

  const studySessions = sessions.filter((s) => !s.isBreak);
  const plannedMinutes = studySessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const doneMinutes = studySessions
    .filter((s) => completed.includes(s.id))
    .reduce((sum, s) => sum + sessionMinutes(s), 0);
  const percent = plannedMinutes === 0 ? 0 : Math.round((doneMinutes / plannedMinutes) * 100);
  const nextSession = studySessions.find((s) => !completed.includes(s.id));
  const doneCount = studySessions.filter((s) => completed.includes(s.id)).length;

  return (
    <>
      <section className="mt-12">
        <SectionLabel>Today&apos;s progress</SectionLabel>
        <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-2">
          <p className="text-6xl font-semibold leading-none tracking-tight tabular-nums sm:text-7xl">
            {formatMinutes(doneMinutes)}
          </p>
          <p className="pb-1.5 text-sm text-cyan-200 tabular-nums">of {formatMinutes(plannedMinutes)} planned</p>
        </div>
        <ProgressLine done={doneMinutes} planned={plannedMinutes} />
        <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-cyan-200">
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
              <p className="text-sm text-cyan-200 tabular-nums">
                {formatTime(nextSession.start)} – {formatTime(nextSession.end)}
              </p>
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
