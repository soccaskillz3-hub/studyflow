"use client";

import {useEffect, useState} from "react";
import ForestScene from "./ForestScene";
import OceanScene from "./OceanScene";
import WeatherLayers from "./WeatherLayers";
import type {Theme} from "../../lib/themes";
import type {TimeOfDay, Weather} from "../../lib/weather";

type Props = {theme: Theme; weather: Weather; time: TimeOfDay; visible: boolean};
type SceneProps = {theme: Theme; weather: Weather; time: TimeOfDay; rainbow: number | null};

const RAINBOW_MS = 42_000;

function SceneFor({theme, ...rest}: SceneProps) {
  return theme === "forest" ? <ForestScene {...rest} /> : <OceanScene {...rest} />;
}

// The scene behind the whole app: the chosen theme, with shared weather, grain and vignette on top.
// Purely decorative: fixed, non-interactive and hidden from assistive tech.
export default function Backdrop({theme, weather, time, visible}: Props) {
  // When the theme changes, keep the old one underneath for a moment and fade the new one in.
  // (Not on the first appearance, when the saved theme loads just as the scene fades in.)
  const [shown, setShown] = useState(theme);
  const [leaving, setLeaving] = useState<Theme | null>(null);
  const [appeared, setAppeared] = useState(visible);
  if (theme !== shown) {
    if (appeared) setLeaving(shown);
    setShown(theme);
  }
  if (visible && !appeared) setAppeared(true);
  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(() => setLeaving(null), 1900);
    return () => clearTimeout(id);
  }, [leaving]);

  // A rainbow, now and then: when rain or a storm clears to a clear sky. `rainbow` counts them,
  // so each gets a fresh element (and animation).
  const [lastWeather, setLastWeather] = useState(weather);
  const [rainbow, setRainbow] = useState<number | null>(null);
  if (weather !== lastWeather) {
    if (appeared && (lastWeather === "rain" || lastWeather === "storm") && weather === "clear") setRainbow((n) => (n ?? 0) + 1);
    if (weather !== "clear") setRainbow(null);
    setLastWeather(weather);
  }
  useEffect(() => {
    if (rainbow === null) return;
    const id = setTimeout(() => setRainbow(null), RAINBOW_MS);
    return () => clearTimeout(id);
  }, [rainbow]);

  // For a moment after the scene first appears, weather is shown as it already is (snow already
  // settled, snow already falling) rather than arriving gradually as it does when it changes.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!visible || settled) return;
    const id = setTimeout(() => setSettled(true), 400);
    return () => clearTimeout(id);
  }, [visible, settled]);

  return (
    <div
      aria-hidden
      data-theme={theme}
      data-time={time}
      data-weather={weather}
      className={`sf-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-700 ${settled ? "" : "sf-instant"}`}
      style={{opacity: visible ? 1 : 0}}
    >
      {leaving && leaving !== shown && (
        <div key={leaving} className="absolute inset-0">
          <SceneFor theme={leaving} weather={weather} time={time} rainbow={rainbow} />
        </div>
      )}
      <div key={shown} className={`absolute inset-0 ${leaving ? "sf-enter" : ""}`}>
        <SceneFor theme={shown} weather={weather} time={time} rainbow={rainbow} />
      </div>

      <WeatherLayers weather={weather} gradual={settled} />
      <div className="sf-grain absolute inset-0" />
      <div className="sf-vignette absolute inset-0" />
    </div>
  );
}
