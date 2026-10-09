"use client";

import {use, useRef} from "react";
import CalendarNav from "../../components/CalendarNav";
import SectionLabel from "../../components/SectionLabel";
import Flame from "../../components/Flame";
import StudyHeatmap from "../../components/StudyHeatmap";
import WeekBars from "../../components/WeekBars";
import {addDays, daysBetween, formatDay, isDayKey, weekStart} from "../../lib/days";
import {streaks, totalOn, useStudyHistory, useWeek, type History} from "../../lib/history";
import {useSchedule} from "../../lib/schedule";
import {formatMinutes} from "../../lib/time";

const BAR_PX = 128;

// How you've been doing: your streak, six months of study days, and a closer look at one week
// (this week by default, or any week as /progress?week=2026-10-06).
export default function ProgressPage({searchParams}: PageProps<"/progress">) {
  const {week: requested} = use(searchParams);
  const {today} = useSchedule();
  const {history, error} = useStudyHistory();
  if (!today) return null;
  const start = weekStart(isDayKey(requested) ? requested : today);

  return (
    <>
      {error ? (
        <p className="mt-12 text-sm text-white/75">
          Couldn&apos;t load your study history. Check your connection and reload the page.
        </p>
      ) : history ? (
        <>
          <StreakSection history={history} today={today} />
          <section className="mt-16">
            <SectionLabel>Last six months</SectionLabel>
            <div className="mt-6">
              <StudyHeatmap history={history} today={today} />
            </div>
          </section>
        </>
      ) : (
        <div className="mt-12 h-72" aria-busy />
      )}
      <WeekSection start={start} today={today} />
    </>
  );
}

function StreakSection({history, today}: {history: History; today: string}) {
  const {current, best, studiedToday} = streaks(history, today);
  const month = daysBetween(addDays(today, -29), today).map((d) => totalOn(history, d));
  const monthDays = month.filter((t) => t.done > 0).length;
  const monthMinutes = month.reduce((sum, t) => sum + t.done, 0);

  const nudge = studiedToday
    ? "Today counts. See you tomorrow."
    : current
      ? "Finish a session today to keep it going"
      : best
        ? "Finish a session today to start a new one"
        : "Finish a session today to start one";

  return (
    <section className="mt-12">
      <SectionLabel>Streak</SectionLabel>
      <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="flex items-center gap-3 text-6xl font-semibold leading-none tracking-tight tabular-nums sm:text-7xl">
          <Flame lit={studiedToday} className="h-10 w-10 sm:h-12 sm:w-12" />
          {current}
        </p>
        <p className="pb-1.5 text-sm text-scene-soft tabular-nums">
          {current === 1 ? "day" : "days"} in a row · best {best}
        </p>
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-[0.3em] text-scene-soft">{nudge}</p>
      <p className="mt-6 text-sm text-white/75 tabular-nums">
        Last 30 days: studied on {monthDays} {monthDays === 1 ? "day" : "days"}
        {monthMinutes > 0 && `, ${formatMinutes(monthMinutes)} in all`}
      </p>
    </section>
  );
}

function WeekSection({start, today}: {start: string; today: string}) {
  const {totals, loaded, planned, done, studiedDays, subjects} = useWeek(start);
  const swipeArea = useRef<HTMLElement>(null);
  const thisWeek = start === weekStart(today);
  const subjectScale = Math.max(...subjects.map((t) => t.planned), 1);

  return (
    <section ref={swipeArea} className="mt-16">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SectionLabel>{thisWeek ? "This week" : `Week of ${formatDay(start, {month: "short", day: "numeric"})}`}</SectionLabel>
        </div>
        <CalendarNav
          prev={`/progress?week=${addDays(start, -7)}`}
          next={`/progress?week=${addDays(start, 7)}`}
          home="/progress"
          homeLabel="This week"
          atHome={thisWeek}
          prevLabel="Previous week"
          nextLabel="Next week"
          swipeArea={swipeArea}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{loaded ? formatMinutes(done) : " "}</p>
        <p className="text-sm text-scene-soft tabular-nums">
          {loaded &&
            (planned
              ? `of ${formatMinutes(planned)} planned · studied on ${studiedDays} of 7 days`
              : "Nothing planned this week")}
        </p>
      </div>

      <div className="mt-8">
        <WeekBars totals={totals} today={today} height={BAR_PX} />
      </div>

      {subjects.length > 0 && (
        <div className="mt-10">
          <h3 className="text-[11px] uppercase tracking-[0.3em] text-white/70">By subject</h3>
          <ul className="mt-5 space-y-5">
            {subjects.map((t) => (
              <li key={t.subject}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-sm">{t.subject}</span>
                  {/* Fixed-width columns either side of the slash, so the slashes line up row to row. */}
                  <span className="grid shrink-0 grid-cols-[4rem_auto_4rem] gap-2 text-xs tabular-nums">
                    <span className="text-right text-white/85">{formatMinutes(t.done)}</span>
                    <span className="text-white/35">/</span>
                    <span className="text-white/50">{formatMinutes(t.planned)}</span>
                  </span>
                </div>
                <div className="relative mt-2 h-1.5 rounded-full bg-white/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                    style={{width: `${(t.planned / subjectScale) * 100}%`}}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-scene shadow-[0_0_10px_var(--accent-glow)]"
                    style={{width: `${(t.done / subjectScale) * 100}%`}}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
