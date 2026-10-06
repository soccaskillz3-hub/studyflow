"use client";

import {useEffect, useState} from "react";
import Backdrop from "./Backdrop";
import {
  fetchWeather,
  timeOfDay,
  TIMES,
  WEATHERS,
  type SunTimes,
  type TimeOfDay,
  type Weather,
} from "../lib/weather";

type Status = "locating" | "live" | "denied" | "error";

const WEATHER_OVERRIDE_KEY = "studyflow:weather-override";
const TIME_OVERRIDE_KEY = "studyflow:time-override";
const REFRESH_MS = 30 * 60 * 1000;

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

const STATUS_TEXT: Record<Status, string> = {
  locating: "finding your location…",
  live: "from your location",
  denied: "location blocked, using clear + clock",
  error: "weather unavailable, using clear + clock",
};

function readOverride<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const saved = localStorage.getItem(key) as T | null;
    return saved && allowed.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function writeOverride(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Not persisted; the override still applies for this page view.
  }
}

export default function SceneBackdrop() {
  const [live, setLive] = useState<{weather: Weather; sun: SunTimes | null} | null>(null);
  const [status, setStatus] = useState<Status>("locating");
  const [weatherOverride, setWeatherOverride] = useState<Weather | null>(null);
  const [timeOverride, setTimeOverride] = useState<TimeOfDay | null>(null);
  // Null until mounted: the server can't know the visitor's local time, so the scene
  // stays hidden until the client picks the right sky, then fades in.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the client clock once mounted
    setNow(new Date());
    if (process.env.NODE_ENV === "development") {
      // Dev-only overrides survive reloads so you can tweak a scene while editing CSS.
      setWeatherOverride(readOverride(WEATHER_OVERRIDE_KEY, WEATHERS));
      setTimeOverride(readOverride(TIME_OVERRIDE_KEY, TIMES));
    }
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const update = () =>
      navigator.geolocation.getCurrentPosition(
        async ({coords}) => {
          try {
            const result = await fetchWeather(coords.latitude, coords.longitude, controller.signal);
            if (cancelled) return;
            setLive(result);
            setStatus("live");
          } catch {
            if (!cancelled) setStatus("error");
          }
        },
        (err) => {
          if (!cancelled) setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
        },
        {maximumAge: REFRESH_MS, timeout: 15000},
      );

    update();
    const id = setInterval(update, REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  const weather = weatherOverride ?? live?.weather ?? "clear";
  const time = timeOverride ?? (now ? timeOfDay(now, live?.sun) : "night");

  const chooseWeather = (w: Weather | null) => {
    setWeatherOverride(w);
    writeOverride(WEATHER_OVERRIDE_KEY, w);
  };
  const chooseTime = (t: TimeOfDay | null) => {
    setTimeOverride(t);
    writeOverride(TIME_OVERRIDE_KEY, t);
  };

  const pill = (active: boolean) =>
    `rounded-lg px-2.5 py-1.5 transition ${active ? "bg-sky-200 text-slate-900" : "bg-white/5 hover:bg-white/10"}`;

  return (
    <>
      <Backdrop weather={weather} time={time} visible={now !== null} />

      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-5rem)] space-y-2 rounded-2xl border border-white/10 bg-slate-950/75 p-3 font-sans text-xs text-slate-300 shadow-lg backdrop-blur-md">
          <p className="px-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Scene · dev
            <span className="ml-2 normal-case tracking-normal text-slate-400">
              {weatherOverride
                ? `forced ${LABELS[weatherOverride].toLowerCase()}`
                : live
                  ? `${LABELS[live.weather].toLowerCase()} ${STATUS_TEXT.live}`
                  : STATUS_TEXT[status]}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => chooseWeather(null)} aria-pressed={weatherOverride === null} className={pill(weatherOverride === null)}>
              Auto
            </button>
            {WEATHERS.map((w) => (
              <button key={w} type="button" onClick={() => chooseWeather(w)} aria-pressed={weatherOverride === w} className={pill(weatherOverride === w)}>
                {LABELS[w]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => chooseTime(null)} aria-pressed={timeOverride === null} className={pill(timeOverride === null)}>
              Auto
            </button>
            {TIMES.map((t) => (
              <button key={t} type="button" onClick={() => chooseTime(t)} aria-pressed={timeOverride === t} className={pill(timeOverride === t)}>
                {LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
