"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {use, useEffect, useRef, useState} from "react";
import CalendarNav from "../../../components/CalendarNav";
import SectionLabel from "../../../components/SectionLabel";
import {classesOn, useClasses} from "../../../lib/classes";
import {dayEntries, hourRange, layoutBlocks} from "../../../lib/dayLayout";
import {addDays, formatDay, isDayKey, weekDays, weekStart} from "../../../lib/days";
import {useSchedule} from "../../../lib/schedule";
import {formatHour, formatMinutes, formatShortTime, formatTime, nowMinutes, toMinutes} from "../../../lib/time";

const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;

// The whole week (Monday to Sunday) at a glance: classes and study sessions side by side.
// This week by default, or the week of any day as /calendar/week?week=2026-10-14.
export default function WeekPage({searchParams}: PageProps<"/calendar/week">) {
  const {week: requested} = use(searchParams);
  const {today} = useSchedule();
  if (!today) return null;
  return <WeekView start={weekStart(isDayKey(requested) ? requested : today)} today={today} />;
}

function WeekView({start, today}: {start: string; today: string}) {
  const router = useRouter();
  const swipeArea = useRef<HTMLElement>(null);
  const {sessionsOn, isLoaded, loadDays, completed} = useSchedule();
  const {classes} = useClasses();
  const [clock, setClock] = useState<number | null>(null);
  const days = weekDays(start);
  const end = days[6];
  const thisWeek = start === weekStart(today);
  const now = days.includes(today) ? clock : null;

  useEffect(() => {
    loadDays(start, end);
  }, [start, end, loadDays]);

  useEffect(() => {
    const tick = () => setClock(nowMinutes());
    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const columns = days.map((day) => {
    const dayClasses = classesOn(classes, day);
    const entries = dayEntries(sessionsOn(day), dayClasses);
    return {day, entries, blocks: layoutBlocks(entries), classCount: dayClasses.length};
  });
  const loaded = days.every(isLoaded);

  const {first: firstHour, last: lastHour} = hourRange(
    columns.flatMap((c) => c.entries),
    now,
  );
  const hours = Array.from({length: lastHour - firstHour}, (_, i) => firstHour + i);
  const top = (minutes: number) => (minutes - firstHour * 60) * PX_PER_MIN;

  const studyMinutes = days
    .flatMap((d) => sessionsOn(d))
    .filter((s) => !s.isBreak)
    .reduce((sum, s) => sum + toMinutes(s.end) - toMinutes(s.start), 0);
  const classCount = columns.reduce((sum, c) => sum + c.classCount, 0);
  const summary = loaded
    ? [
        studyMinutes ? `${formatMinutes(studyMinutes)} of study planned` : "No study planned",
        classCount ? `${classCount} ${classCount === 1 ? "class" : "classes"}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : " ";

  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const range = `${formatDay(start, {month: "short", day: "numeric"})} – ${formatDay(
    end,
    sameMonth ? {day: "numeric"} : {month: "short", day: "numeric"},
  )}`;

  return (
    <section ref={swipeArea} className="mt-12">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SectionLabel>{thisWeek ? "This week" : `Week of ${formatDay(start, {month: "short", day: "numeric"})}`}</SectionLabel>
        </div>
        <CalendarNav
          prev={`/calendar/week?week=${addDays(start, -7)}`}
          next={`/calendar/week?week=${addDays(start, 7)}`}
          home="/calendar/week"
          homeLabel="This week"
          atHome={thisWeek}
          prevLabel="Previous week"
          nextLabel="Next week"
          swipeArea={swipeArea}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{range}</p>
        <p className="text-sm text-scene-soft">{summary}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/65">
        <span className="flex items-center gap-2">
          <span className="sf-class-block h-3 w-3 rounded-[3px] border border-l-[3px]" aria-hidden />
          Class
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] border border-white/40 bg-slate-900/40" aria-hidden />
          Study session
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] border border-scene/50 bg-scene/20" aria-hidden />
          Done
        </span>
        <span className="text-white/45">Pick a day to plan it.</span>
      </div>

      {/* Seven columns don't fit a phone, so the week scrolls sideways there. */}
      <div className="-mx-5 mt-6 overflow-x-auto px-5 pb-2 sm:mx-0 sm:mt-8 sm:px-0">
        <div className="min-w-[40rem]">
          <div className="flex pb-2 pl-12 sm:pl-14">
            {days.map((day) => {
              const isToday = day === today;
              return (
                <Link
                  key={day}
                  href={`/calendar?day=${day}`}
                  aria-label={`Open ${formatDay(day, {weekday: "long", month: "long", day: "numeric"})}`}
                  className={`flex flex-1 flex-col items-center rounded-md py-1.5 transition hover:bg-white/[0.06] ${
                    isToday ? "text-scene-ink" : "text-white/75"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-[0.25em]">{formatDay(day, {weekday: "short"})}</span>
                  <span
                    className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums ${
                      isToday ? "bg-scene font-semibold text-slate-900 [text-shadow:none]" : ""
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="relative flex" style={{height: hours.length * HOUR_PX}}>
            {/* Hour labels */}
            <div className="relative w-12 shrink-0 sm:w-14">
              {[...hours, lastHour].map((h) => (
                <span
                  key={h}
                  className="absolute -translate-y-1/2 text-[10px] tabular-nums text-white/55"
                  style={{top: top(h * 60)}}
                >
                  {formatHour(h)}
                </span>
              ))}
            </div>

            {columns.map(({day, blocks}) => {
              const isToday = day === today;
              return (
                <div
                  key={day}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a")) router.push(`/calendar?day=${day}`);
                  }}
                  className={`relative flex-1 cursor-pointer border-l border-white/10 transition-colors hover:bg-white/[0.03] ${
                    isToday ? "bg-white/[0.04]" : ""
                  }`}
                >
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-white/12" style={{top: top(h * 60)}} />
                  ))}
                  <div className="absolute inset-x-0 border-t border-white/12" style={{top: top(lastHour * 60)}} />

                  {blocks.map(({entry, start, end, lane, lanes}) => {
                    const height = Math.max((end - start) * PX_PER_MIN, 16);
                    const tall = height >= 34;
                    const isPast = day < today || (isToday && now !== null && end <= now);
                    const isCurrent = isToday && now !== null && start <= now && now < end;
                    const place = {
                      top: top(start) + 1,
                      height: height - 2,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 3px)`,
                    };
                    const title = `${entry.label}, ${formatTime(entry.start)} – ${formatTime(entry.end)}`;

                    if (entry.kind === "class") {
                      return (
                        <Link
                          key={entry.id}
                          href={`/calendar?day=${day}`}
                          title={entry.meeting.location ? `${title} · ${entry.meeting.location}` : title}
                          data-state={isCurrent ? "current" : isPast ? "past" : undefined}
                          className="sf-class-block absolute z-[2] overflow-hidden rounded-[5px] border border-l-[3px] px-1.5 py-0.5 leading-tight"
                          style={place}
                        >
                          <span className="block truncate text-[11px] font-semibold tracking-tight">{entry.meeting.code}</span>
                          {tall && (
                            <span className="block truncate text-[10px] tabular-nums opacity-80">
                              {[entry.meeting.component, formatShortTime(entry.start)].filter(Boolean).join(" ")}
                            </span>
                          )}
                        </Link>
                      );
                    }

                    const {session} = entry;
                    const done = completed.includes(session.id);
                    return (
                      <Link
                        key={entry.id}
                        href={`/calendar?day=${day}`}
                        title={title}
                        className={`absolute z-[2] overflow-hidden rounded-[5px] border px-1.5 py-0.5 leading-tight backdrop-blur-sm transition hover:brightness-125 ${
                          done
                            ? "border-scene/40 bg-scene/20 text-white/60"
                            : session.isBreak
                              ? "border-dashed border-white/35 bg-white/[0.04] text-white/65"
                              : isCurrent
                                ? "sf-block-current border-scene text-white"
                                : isPast
                                  ? "border-white/20 bg-white/[0.05] text-white/65"
                                  : "border-white/40 bg-slate-900/45 text-white"
                        }`}
                        style={place}
                      >
                        <span className={`block truncate text-[11px] ${done ? "line-through" : ""}`}>{session.subject}</span>
                        {tall && (
                          <span className="block truncate text-[10px] tabular-nums text-scene-soft/90">{formatShortTime(session.start)}</span>
                        )}
                      </Link>
                    );
                  })}

                  {isToday && now !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-[1] -translate-y-1/2"
                      style={{top: top(now)}}
                      aria-hidden
                    >
                      <div className="h-[2px] bg-scene shadow-[0_0_10px_var(--accent-glow)]" />
                      <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-scene-soft" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
