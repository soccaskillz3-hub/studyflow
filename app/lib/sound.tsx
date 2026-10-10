"use client";

import {createContext, useContext, useEffect, useState, type ReactNode} from "react";
import {audio, DEFAULT_SOUND, type SoundSettings} from "./audio/engine";
import {describe, soundscape} from "./audio/soundscape";
import {useScene} from "./scene";

// v2: the defaults were lowered, and every earlier visit had saved the old (louder) ones.
const STORAGE_KEY = "studyflow:sound-v2";
const OLD_KEYS = ["studyflow:sound"];

type Sound = {
  settings: SoundSettings;
  update: (change: Partial<SoundSettings>) => void;
  // False until the first click or key press: browsers don't allow audio before then.
  unlocked: boolean;
  // What's audible in the current scene, e.g. ["Rustling leaves", "Birdsong"].
  nowPlaying: string[];
};

const SoundContext = createContext<Sound | null>(null);

function load(): SoundSettings {
  try {
    // From older saves keep only whether sound was on (someone who muted stays muted); their
    // volumes were the old, louder defaults.
    let carried: Partial<SoundSettings> = {};
    for (const key of OLD_KEYS) {
      const old = JSON.parse(localStorage.getItem(key) ?? "null");
      if (old && typeof old.enabled === "boolean") carried = {enabled: old.enabled};
      localStorage.removeItem(key);
    }
    return {...DEFAULT_SOUND, ...carried, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")};
  } catch {
    return DEFAULT_SOUND;
  }
}

// Plays the scene's soundscape and holds the visitor's sound settings.
export function SoundProvider({children}: {children: ReactNode}) {
  const {theme, time, weather} = useScene();
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SOUND);
  const [loaded, setLoaded] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved settings once mounted
    setSettings(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    audio.configure(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Not persisted; the settings still apply for this visit.
    }
  }, [settings, loaded]);

  // Start audio on the first interaction anywhere on the page.
  useEffect(() => {
    const start = () => {
      audio.unlock();
      setUnlocked(true);
    };
    window.addEventListener("pointerdown", start, {once: true});
    window.addEventListener("keydown", start, {once: true});
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, []);

  useEffect(() => {
    soundscape.set({theme, time, weather});
  }, [theme, time, weather]);

  // In development, expose the mixer for poking at from the browser console.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") Object.assign(window, {__zefloSound: {audio, soundscape}});
  }, []);

  const update = (change: Partial<SoundSettings>) => setSettings((s) => ({...s, ...change}));

  return (
    <SoundContext value={{settings, update, unlocked, nowPlaying: describe({theme, time, weather})}}>
      {children}
    </SoundContext>
  );
}

export function useSound() {
  const sound = useContext(SoundContext);
  if (!sound) throw new Error("useSound must be used inside <SoundProvider>");
  return sound;
}
