"use client";

import {createContext, useContext, useEffect, useState, type ReactNode} from "react";
import Backdrop from "../components/Backdrop";
import {fetchWeather, timeOfDay, TIMES, WEATHERS, type SunTimes, type TimeOfDay, type Weather} from "./weather";

export type SceneStatus = "locating" | "live" | "denied" | "error";

const WEATHER_OVERRIDE_KEY = "studyflow:weather-override";
const TIME_OVERRIDE_KEY = "studyflow:time-override";
const REFRESH_MS = 30 * 60 * 1000;

type Scene = {
  weather: Weather; // what's showing: the override if set, else live weather
  time: TimeOfDay;
  live: Weather | null; // weather at the visitor's location, once known
  status: SceneStatus;
  weatherOverride: Weather | null; // null = automatic
  timeOverride: TimeOfDay | null;
  chooseWeather: (weather: Weather | null) => void;
  chooseTime: (time: TimeOfDay | null) => void;
};

const SceneContext = createContext<Scene | null>(null);

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
    // Not persisted; the choice still applies for this page view.
  }
}

// Works out the scene (live weather + time of day, or the visitor's chosen overrides), draws the
// backdrop, and shares the scene with the rest of the app so menus can match it and change it.
export function SceneProvider({children}: {children: ReactNode}) {
  const [live, setLive] = useState<{weather: Weather; sun: SunTimes | null} | null>(null);
  const [status, setStatus] = useState<SceneStatus>("locating");
  const [weatherOverride, setWeatherOverride] = useState<Weather | null>(null);
  const [timeOverride, setTimeOverride] = useState<TimeOfDay | null>(null);
  // Null until mounted: the server can't know the visitor's local time, so the scene
  // stays hidden until the client picks the right sky, then fades in.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the client clock and saved settings once mounted
    setNow(new Date());
    setWeatherOverride(readOverride(WEATHER_OVERRIDE_KEY, WEATHERS));
    setTimeOverride(readOverride(TIME_OVERRIDE_KEY, TIMES));
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

  // Expose the scene on <html> so CSS can theme panels and menus to match the sky.
  useEffect(() => {
    document.documentElement.dataset.weather = weather;
    document.documentElement.dataset.time = time;
  }, [weather, time]);

  const chooseWeather = (w: Weather | null) => {
    setWeatherOverride(w);
    writeOverride(WEATHER_OVERRIDE_KEY, w);
  };
  const chooseTime = (t: TimeOfDay | null) => {
    setTimeOverride(t);
    writeOverride(TIME_OVERRIDE_KEY, t);
  };

  return (
    <SceneContext
      value={{
        weather,
        time,
        live: live?.weather ?? null,
        status,
        weatherOverride,
        timeOverride,
        chooseWeather,
        chooseTime,
      }}
    >
      <Backdrop weather={weather} time={time} visible={now !== null} />
      {children}
    </SceneContext>
  );
}

export function useScene() {
  const scene = useContext(SceneContext);
  if (!scene) throw new Error("useScene must be used inside <SceneProvider>");
  return scene;
}
