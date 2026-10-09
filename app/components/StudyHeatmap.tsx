"use client";

import Link from "next/link";
import {useState} from "react";
import {addDays, formatDay, weekDays, weekStart} from "../lib/days";
import {intensity, totalOn, type History} from "../lib/history";
import {formatMinutes} from "../lib/time";

const WEEKS = 26; // about six months
const PHONE_WEEKS = 15; // phones show the most recent weeks only

const LEVEL_CLASS = [
  "bg-white/[0.06]",
  "bg-scene/25",
  "bg-scene/45",
  "bg-scene/70",
  "bg-scene shadow-[0_0_8px_var(--accent-glow)]",
];

const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function describe(history: History, day: string) {
  const t = totalOn(history, day);
  const date = formatDay(day, {weekday: "short", month: "short", day: "numeric"});
  if (!t.sessions) return `${date} · Nothing planned`;
  return `${date} · ${formatMinutes(t.done)} of ${formatMinutes(t.planned)} · ${t.sessionsDone} of ${t.sessions} ${
    t.sessions === 1 ? "session" : "sessions"
  }`;
}

// A GitHub-style grid of the last six months, one square per day (weeks run left to right,
// Monday at the top), shaded by how much studying got done. Hover or tap a day for its totals.
export default function StudyHeatmap({history, today}: {history: History; today: string}) {
  const [picked, setPicked] = useState<string | null>(null);
  const first = addDays(weekStart(today), -7 * (WEEKS - 1));
  const weeks = Array.from({length: WEEKS}, (_, w) => weekDays(addDays(first, 7 * w)));
  const studiedDays = weeks.flat().filter((d) => d <= today && totalOn(history, d).done > 0).length;

  return (
    <div>
      <div
        role="img"
        aria-label={`Study history: you studied on ${studiedDays} ${studiedDays === 1 ? "day" : "days"} in the last ${WEEKS} weeks.`}
        className="flex gap-[3px] sm:gap-1"
        onPointerLeave={(e) => e.pointerType === "mouse" && setPicked(null)}
      >
        {/* Stretches to the height of the week columns, so each label shares a row with its squares. */}
        <div className="flex w-7 shrink-0 flex-col gap-[3px] sm:gap-1">
          <span className="h-4" />
          {ROW_LABELS.map((label, i) => (
            <span key={i} className="flex flex-1 items-center text-[9px] uppercase tracking-wider text-white/50">
              {label}
            </span>
          ))}
        </div>
        {weeks.map((days, w) => {
          const newMonth = days.find((d) => d.endsWith("-01"));
          return (
            <div
              key={days[0]}
              className={`flex min-w-0 flex-1 flex-col gap-[3px] sm:gap-1 ${w < WEEKS - PHONE_WEEKS ? "max-sm:hidden" : ""}`}
            >
              <span className="h-4 overflow-visible whitespace-nowrap text-[10px] uppercase tracking-wider text-white/60">
                {newMonth ? formatDay(newMonth, {month: "short"}) : ""}
              </span>
              {days.map((day) => {
                if (day > today) return <span key={day} className="aspect-square" />;
                const t = totalOn(history, day);
                const level = intensity(t.done);
                // Planned but nothing done gets an outline, so those days read differently from empty ones.
                const missed = level === 0 && t.sessions > 0;
                return (
                  <span
                    key={day}
                    onPointerEnter={() => setPicked(day)}
                    onClick={() => setPicked(day)}
                    className={`aspect-square rounded-[3px] transition ${LEVEL_CLASS[level]} ${
                      missed ? "ring-1 ring-inset ring-white/30" : ""
                    } ${day === today ? "outline outline-1 outline-offset-1 outline-white/80" : ""} ${
                      picked === day ? "scale-125" : ""
                    }`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex min-h-5 flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
        <p aria-live="polite" className="text-white/75 tabular-nums">
          {picked ? (
            <>
              {describe(history, picked)}{" "}
              <Link
                href={`/calendar?day=${picked}`}
                className="ml-1 whitespace-nowrap text-scene-soft underline decoration-scene/40 underline-offset-4 transition hover:text-scene-ink"
              >
                Open day
              </Link>
            </>
          ) : (
            <span className="text-white/55">Hover or tap a day for details.</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 text-white/55" aria-hidden>
          Less
          {LEVEL_CLASS.map((c, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
