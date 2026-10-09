import {formatDay} from "../lib/days";
import type {DayTotal} from "../lib/history";
import {formatMinutes} from "../lib/time";

// One bar per day, Monday to Sunday: the outline is what was planned, the fill what got done.
// Future days with plans get a dashed outline. With `labels`, each bar shows its done time on top.
export default function WeekBars({
  totals,
  today,
  height,
  labels = true,
}: {
  totals: (DayTotal & {day: string})[];
  today: string;
  height: number;
  labels?: boolean;
}) {
  // Bars share one scale, with an hour as the smallest top so a light week doesn't look full.
  const scale = Math.max(60, ...totals.map((t) => Math.max(t.planned, t.done)));

  return (
    <div className="flex items-end gap-2 sm:gap-4" style={{height: height + (labels ? 44 : 26)}}>
      {totals.map((t) => {
        const future = t.day > today;
        return (
          <div key={t.day} className="flex h-full flex-1 flex-col items-center justify-end">
            {labels && (
              <span className="mb-1.5 text-[10px] text-white/70 tabular-nums">{t.done > 0 && formatMinutes(t.done)}</span>
            )}
            <div
              className={`relative w-full max-w-12 overflow-hidden rounded-t-md ${
                t.planned
                  ? `border border-b-0 ${future ? "border-dashed border-white/30" : "border-white/35"} bg-white/[0.05]`
                  : ""
              }`}
              style={{height: (Math.max(t.planned, t.done) / scale) * height}}
              title={
                t.planned
                  ? `${formatDay(t.day, {weekday: "long"})}: ${formatMinutes(t.done)} of ${formatMinutes(t.planned)} done`
                  : undefined
              }
            >
              <div
                className="absolute inset-x-0 bottom-0 bg-scene shadow-[0_0_14px_var(--accent-glow)] transition-[height] duration-700 ease-out"
                style={{height: `${(t.done / Math.max(t.planned, t.done, 1)) * 100}%`}}
              />
            </div>
            <span className="h-px w-full bg-white/30" />
            <span
              className={`mt-2 text-[10px] uppercase tracking-[0.2em] ${
                t.day === today ? "text-scene-ink" : "text-white/60"
              }`}
            >
              <span className="sm:hidden">{formatDay(t.day, {weekday: "narrow"})}</span>
              <span className="max-sm:hidden">{formatDay(t.day, {weekday: "short"})}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
