"use client";

import {useEffect, useRef, useState} from "react";
import {DEFAULT_SOUND, type SoundSettings} from "./audio/engine";
import {useScene} from "./scene";
import {useSound} from "./sound";
import {createClient} from "./supabase/client";
import {THEME_IDS, type Theme} from "./themes";
import {TIMES, WEATHERS, type TimeOfDay, type Weather} from "./weather";

type Row = {
  theme: string | null;
  weather_override: string | null;
  time_override: string | null;
  sound: Partial<SoundSettings> | null;
};

const SAVE_DELAY_MS = 800;

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]) =>
  value && allowed.includes(value as T) ? (value as T) : null;

// Keeps the theme, scene and sound settings in the logged-in user's account, so they follow
// them between devices. The browser still keeps its own copy, so pages open with the right
// scene before the account has answered. Renders nothing.
export function SettingsSync({userId}: {userId: string}) {
  const {theme, weatherOverride, timeOverride, chooseTheme, chooseWeather, chooseTime} = useScene();
  const {settings, update} = useSound();
  const [ready, setReady] = useState(false);
  const skipNextSave = useRef(false);

  // Bring in the account's settings once. An account without any yet keeps this browser's.
  useEffect(() => {
    let current = true;
    createClient()
      .from("user_settings")
      .select("theme, weather_override, time_override, sound")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({data, error}) => {
        if (!current || error) return; // offline or failed: carry on with this browser's settings
        const row = data as Row | null;
        // Sound is always saved alongside the rest, so a row without it (e.g. one created just
        // to remember a dismissed prompt) has no settings in it yet.
        if (row?.sound) {
          chooseTheme(oneOf<Theme>(row.theme, THEME_IDS) ?? "ocean");
          chooseWeather(oneOf<Weather>(row.weather_override, WEATHERS));
          chooseTime(oneOf<TimeOfDay>(row.time_override, TIMES));
          update({...DEFAULT_SOUND, ...row.sound});
          skipNextSave.current = true; // what was just loaded doesn't need saving back
        }
        setReady(true);
      });
    return () => {
      current = false;
    };
    // Load once per account; the choose functions change identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Save changes, waiting for a pause so dragging a volume slider doesn't send every step.
  useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const id = setTimeout(() => {
      createClient()
        .from("user_settings")
        .upsert({
          user_id: userId,
          theme,
          weather_override: weatherOverride,
          time_override: timeOverride,
          sound: settings,
          updated_at: new Date().toISOString(),
        })
        .then(() => {
          // A failed save is retried by the next change; the setting still applies here.
        });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [ready, userId, theme, weatherOverride, timeOverride, settings]);

  return null;
}
