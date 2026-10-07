"use client";

import {useCallback, useRef, useState} from "react";
import {useScene, type SceneStatus} from "../lib/scene";
import {useDismiss} from "../lib/useDismiss";
import {TIMES, WEATHERS, type TimeOfDay, type Weather} from "../lib/weather";

const LABELS: Record<Weather | TimeOfDay, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rain: "Rain",
  storm: "Storm",
  snow: "Snow",
  fog: "Fog",
  sunrise: "Sunrise",
  day: "Day",
  dusk: "Dusk",
  night: "Night",
};

const STATUS_TEXT: Record<Exclude<SceneStatus, "live">, string> = {
  locating: "Finding your location…",
  denied: "Location blocked, so auto shows clear skies",
  error: "Weather unavailable, so auto shows clear skies",
};

function Choices<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  const pill = (active: boolean) =>
    `rounded-md px-2.5 py-1.5 text-[11px] uppercase tracking-[0.15em] transition ${
      active ? "sf-panel-active text-white" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
    }`;

  return (
    <fieldset>
      <legend className="text-xs uppercase tracking-[0.25em] text-white">{label}</legend>
      <p className="mt-1 text-xs text-white/55">{hint}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={pill(value === null)}>
          Auto
        </button>
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)} className={pill(value === o)}>
            {LABELS[o as Weather | TimeOfDay]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function SettingsMenu() {
  const {live, status, time, weatherOverride, timeOverride, chooseWeather, chooseTime} = useScene();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  const weatherHint =
    status === "live" && live ? `Auto: ${LABELS[live].toLowerCase()} at your location` : STATUS_TEXT[status === "live" ? "locating" : status];
  const timeHint = timeOverride ? `Showing ${LABELS[time].toLowerCase()}` : `Auto: ${LABELS[time].toLowerCase()}, from your clock`;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`-m-2 flex h-9 w-9 items-center justify-center rounded-md transition ${
          open ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2.5 4h11M2.5 8h11M2.5 12h11" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Settings"
          className="sf-panel sf-pop absolute right-0 top-full z-40 mt-3 w-[min(20rem,calc(100vw-2.5rem))] space-y-5 rounded-xl border p-4 [text-shadow:none]"
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Scene</p>
          <Choices label="Weather" hint={weatherHint} options={WEATHERS} value={weatherOverride} onChange={chooseWeather} />
          <Choices label="Time of day" hint={timeHint} options={TIMES} value={timeOverride} onChange={chooseTime} />
        </div>
      )}
    </div>
  );
}
