"use client";

import {useEffect, useState} from "react";
import Backdrop from "./Backdrop";
import {fetchWeather, WEATHERS, type Weather} from "../lib/weather";

type Status = "locating" | "live" | "denied" | "error";

const OVERRIDE_KEY = "studyflow:weather-override";
const REFRESH_MS = 30 * 60 * 1000;

const LABELS: Record<Weather, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rain: "Rain",
  storm: "Storm",
  snow: "Snow",
  fog: "Fog",
};

const STATUS_TEXT: Record<Status, string> = {
  locating: "finding your location…",
  live: "from your location",
  denied: "location blocked, using clear",
  error: "weather unavailable, using clear",
};

export default function WeatherBackdrop() {
  const [live, setLive] = useState<Weather | null>(null);
  const [status, setStatus] = useState<Status>("locating");
  const [override, setOverride] = useState<Weather | null>(null);

  // Dev-only override survives reloads so you can tweak a scene while editing CSS.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const saved = localStorage.getItem(OVERRIDE_KEY) as Weather | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
      if (saved && WEATHERS.includes(saved)) setOverride(saved);
    } catch {
      // Storage unavailable; start on live weather.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const update = () =>
      navigator.geolocation.getCurrentPosition(
        async ({coords}) => {
          try {
            const weather = await fetchWeather(coords.latitude, coords.longitude, controller.signal);
            if (cancelled) return;
            setLive(weather);
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

  const choose = (weather: Weather | null) => {
    setOverride(weather);
    try {
      if (weather) localStorage.setItem(OVERRIDE_KEY, weather);
      else localStorage.removeItem(OVERRIDE_KEY);
    } catch {
      // Not persisted; the override still applies for this page view.
    }
  };

  const weather = override ?? live ?? "clear";

  return (
    <>
      <Backdrop weather={weather} />

      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-5rem)] rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300 shadow-lg backdrop-blur-md">
          <p className="px-1 pb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Weather · dev
            <span className="ml-2 normal-case tracking-normal text-slate-400">
              {override
                ? `forced ${LABELS[override].toLowerCase()}`
                : live
                  ? `${LABELS[live].toLowerCase()} ${STATUS_TEXT.live}`
                  : STATUS_TEXT[status]}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => choose(null)}
              aria-pressed={override === null}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                override === null ? "bg-sky-200 text-slate-900" : "bg-white/5 hover:bg-white/10"
              }`}
            >
              Auto
            </button>
            {WEATHERS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => choose(w)}
                aria-pressed={override === w}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  override === w ? "bg-sky-200 text-slate-900" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                {LABELS[w]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
