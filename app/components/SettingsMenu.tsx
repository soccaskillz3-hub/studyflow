"use client";

import {useCallback, useRef, useState, type CSSProperties, type KeyboardEvent} from "react";
import {useFormStatus} from "react-dom";
import {forgetThisBrowser, useAccount} from "../lib/account";
import {logOut} from "../lib/auth";
import {useScene, type SceneStatus} from "../lib/scene";
import {useSound} from "../lib/sound";
import {THEMES, type Theme} from "../lib/themes";
import {useDismiss} from "../lib/useDismiss";
import {TIMES, WEATHERS, type TimeOfDay, type Weather} from "../lib/weather";
import type {SoundSettings} from "../lib/audio/engine";

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

const TABS = [
  {id: "theme", label: "Theme & scene"},
  {id: "sound", label: "Sound"},
] as const;
type Tab = (typeof TABS)[number]["id"];

const pill = (active: boolean) =>
  `rounded-md px-2.5 py-1.5 text-[11px] uppercase tracking-[0.15em] transition ${
    active ? "sf-panel-active text-white" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
  }`;

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

// A miniature of each theme at the current time of day, for the theme cards.
function ThemePreview({theme, time}: {theme: Theme; time: TimeOfDay}) {
  return (
    <span className="relative block h-14 overflow-hidden rounded-md border border-white/10">
      {theme === "ocean" ? (
        <>
          <span className={`sf-sky-${time} absolute inset-0`} />
          <span className="sf-scene absolute inset-x-0 bottom-0 h-[30%]" data-time={time}>
            <span className="absolute inset-0" style={{background: "linear-gradient(var(--water-1), var(--water-4))"}} />
          </span>
          <span className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-[#f8f1df] shadow-[0_0_10px_rgba(255,240,210,0.7)]" />
        </>
      ) : (
        <span className="sf-forest absolute inset-0" data-time={time}>
          <span className={`sf-fsky-${time} absolute inset-0`} />
          <svg viewBox="0 0 120 56" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
            <path d="M0 40 L8 22 L16 40 Z M14 42 L24 14 L34 42 Z M30 40 L38 24 L46 40 Z M74 42 L84 16 L94 42 Z M90 40 L98 22 L106 40 Z M104 42 L114 18 L124 42 Z" style={{fill: "var(--tree-3)"}} />
            <path d="M0 44 H120 V56 H0 Z M-4 56 L6 10 L16 56 Z M100 56 L112 4 L124 56 Z" style={{fill: "var(--tree-1)"}} />
            <path d="M96 0 L70 56 L80 56 L104 0 Z" style={{fill: "var(--ray)"}} />
          </svg>
        </span>
      )}
    </span>
  );
}

// Theme cards, with the scene (weather and time of day) in a dropdown underneath.
function ThemeTab() {
  const {theme, time, weather, weatherOverride, timeOverride, chooseTheme} = useScene();
  const [sceneOpen, setSceneOpen] = useState(false);
  const auto = weatherOverride === null && timeOverride === null;
  const summary = `${auto ? "Auto" : "Custom"}: ${LABELS[weather].toLowerCase()} · ${LABELS[time].toLowerCase()}`;

  return (
    <div>
      <ThemeCards theme={theme} time={time} chooseTheme={chooseTheme} />
      <div className="mt-3 rounded-lg bg-white/[0.04]">
        <button
          type="button"
          aria-expanded={sceneOpen}
          aria-controls="settings-scene"
          onClick={() => setSceneOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
        >
          <span>
            <span className="block text-xs uppercase tracking-[0.25em] text-white">Weather &amp; time of day</span>
            <span className="mt-1 block text-[11px] text-white/55">{summary}</span>
          </span>
          <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 text-white/60 transition-transform ${sceneOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {sceneOpen && (
          <div id="settings-scene" className="sf-pop px-3 pb-3 pt-1">
            <SceneTab />
          </div>
        )}
      </div>
    </div>
  );
}

function ThemeCards({theme, time, chooseTheme}: {theme: Theme; time: TimeOfDay; chooseTheme: (t: Theme) => void}) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => chooseTheme(t.id)}
            className={`rounded-lg p-2 text-left transition ${active ? "sf-panel-active" : "bg-white/[0.05] hover:bg-white/[0.1]"}`}
          >
            <ThemePreview theme={t.id} time={time} />
            <span className="mt-2 block text-xs uppercase tracking-[0.25em] text-white">{t.label}</span>
            <span className="mt-1 block text-[11px] leading-snug text-white/60">{t.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function SceneTab() {
  const {live, status, time, weatherOverride, timeOverride, chooseWeather, chooseTime} = useScene();
  const weatherHint =
    status === "live" && live ? `Auto: ${LABELS[live].toLowerCase()} at your location` : STATUS_TEXT[status === "live" ? "locating" : status];
  const timeHint = timeOverride ? `Showing ${LABELS[time].toLowerCase()}` : `Auto: ${LABELS[time].toLowerCase()}, from your clock`;
  return (
    <div className="space-y-5">
      <Choices label="Weather" hint={weatherHint} options={WEATHERS} value={weatherOverride} onChange={chooseWeather} />
      <Choices label="Time of day" hint={timeHint} options={TIMES} value={timeOverride} onChange={chooseTime} />
    </div>
  );
}

const VOLUMES: {key: Exclude<keyof SoundSettings, "enabled">; label: string; hint: string}[] = [
  {key: "master", label: "Master", hint: "Everything"},
  {key: "ambience", label: "Ambience", hint: "Waves, wind, rain, leaves and crickets"},
  {key: "wildlife", label: "Wildlife", hint: "Birds, owls, deer, gulls and other calls"},
  {key: "interface", label: "Timer chimes", hint: "Focus and break alerts, finishing a session"},
];

function SoundTab() {
  const {settings, update, unlocked, nowPlaying} = useSound();
  const {enabled} = settings;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-white">Sound</p>
          <p className="mt-1 text-xs text-white/55">
            {!enabled ? "Muted" : unlocked ? "Playing the scene around you" : "Starts after your first click"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Sound"
          onClick={() => update({enabled: !enabled})}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-scene/80" : "bg-white/15"}`}
        >
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? "left-6" : "left-1"}`} />
        </button>
      </div>

      {VOLUMES.map(({key, label, hint}) => {
        const value = Math.round(settings[key] * 100);
        return (
          <label key={key} className="block">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-white/90">{label}</span>
              <span className="text-[11px] tabular-nums text-white/60">{value}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              disabled={!enabled}
              aria-label={`${label} volume`}
              aria-describedby={`volume-${key}`}
              onChange={(e) => update({[key]: Number(e.target.value) / 100})}
              className="sf-range mt-1"
              style={{"--fill": `${value}%`} as CSSProperties}
            />
            <span id={`volume-${key}`} className="block text-[11px] text-white/45">
              {hint}
            </span>
          </label>
        );
      })}

      <div className="border-t border-dashed border-white/15 pt-3">
        <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Now playing</p>
        <p className="mt-1 text-xs leading-relaxed text-white/75">{enabled ? nowPlaying.join(" · ") || "Silence" : "Nothing, sound is off"}</p>
      </div>
    </div>
  );
}

function LogOutButton() {
  const {pending} = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.15em] text-white/80 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-60"
    >
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}

// Who's logged in, and the way out. Logging out also clears what StudyFlow kept in this browser.
function AccountFooter() {
  const account = useAccount();
  if (!account) return null;
  return (
    <form
      action={logOut}
      onSubmit={forgetThisBrowser}
      className="mt-4 flex items-center justify-between gap-3 border-t border-dashed border-white/15 pt-3"
    >
      <p className="min-w-0">
        <span className="block text-[11px] uppercase tracking-[0.25em] text-white/60">Logged in as</span>
        <span className="mt-0.5 block truncate text-xs text-white/85">{account.email}</span>
      </p>
      <LogOutButton />
    </form>
  );
}

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("theme");
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  // Arrow keys move between tabs, as in any tab list.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    root.current?.querySelector<HTMLElement>(`#settings-tab-${next}`)?.focus();
  };

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
          className="sf-panel sf-pop absolute right-0 top-full z-40 mt-3 w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border p-4 [text-shadow:none]"
        >
          <div role="tablist" aria-label="Settings sections" onKeyDown={onTabKey} className="flex gap-1 rounded-lg bg-black/20 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`settings-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`settings-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-md py-1.5 text-[11px] uppercase tracking-[0.2em] transition ${
                  tab === t.id ? "sf-panel-active text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div id={`settings-panel-${tab}`} role="tabpanel" aria-labelledby={`settings-tab-${tab}`} className="mt-4">
            {tab === "theme" && <ThemeTab />}
            {tab === "sound" && <SoundTab />}
          </div>

          <AccountFooter />
        </div>
      )}
    </div>
  );
}
