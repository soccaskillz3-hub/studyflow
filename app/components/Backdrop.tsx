import type {CSSProperties} from "react";
import type {Weather} from "../lib/weather";

// Quiet dusk-over-water scene rendered behind the whole app, varied by weather.
// Purely decorative: fixed, non-interactive and hidden from assistive tech.

// Deterministic pseudo-random so the scene is identical on server and client.
// Rounded so tiny floating-point differences between JS engines can't cause hydration mismatches.
function rand(i: number, n: number) {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
}

const STARS = Array.from({length: 60}, (_, i) => ({
  left: rand(i, 1) * 100,
  top: rand(i, 2) * 52,
  size: rand(i, 3) < 0.85 ? 1 : 2,
  opacity: 0.2 + rand(i, 4) * 0.45,
  delay: rand(i, 5) * -10,
  duration: 5 + rand(i, 6) * 7,
}));

const SNOWFLAKES = Array.from({length: 90}, (_, i) => ({
  left: rand(i, 7) * 100,
  size: 1.5 + rand(i, 8) * 2.5,
  opacity: 0.35 + rand(i, 9) * 0.5,
  delay: rand(i, 10) * -20,
  duration: 12 + rand(i, 11) * 14,
  sway: 10 + rand(i, 12) * 30,
}));

const CLOUDS = [
  {top: 9, width: 46, height: 7, opacity: 0.55, duration: 260, delay: -40},
  {top: 18, width: 34, height: 5, opacity: 0.4, duration: 220, delay: -150},
  {top: 30, width: 58, height: 8, opacity: 0.35, duration: 320, delay: -90},
  {top: 42, width: 40, height: 5, opacity: 0.3, duration: 280, delay: -210},
  {top: 52, width: 64, height: 6, opacity: 0.45, duration: 360, delay: -20},
];

// Heavier cloud cover layered on for overcast weather.
const OVERCAST = [
  {top: -4, width: 90, height: 22, duration: 300, delay: -60},
  {top: 6, width: 75, height: 18, duration: 260, delay: -200},
  {top: 18, width: 100, height: 20, duration: 340, delay: -120},
  {top: 30, width: 80, height: 16, duration: 290, delay: -250},
  {top: 42, width: 95, height: 15, duration: 380, delay: -30},
  {top: 52, width: 70, height: 12, duration: 320, delay: -170},
];

const RIPPLES = [
  {bottom: 84, opacity: 0.16, duration: 34, scale: 0.8},
  {bottom: 68, opacity: 0.12, duration: 46, scale: 1.1},
  {bottom: 48, opacity: 0.1, duration: 60, scale: 1.5},
  {bottom: 26, opacity: 0.08, duration: 78, scale: 2},
  {bottom: 6, opacity: 0.06, duration: 96, scale: 2.6},
];

const FOG_BANDS = [
  {top: 50, height: 22, opacity: 0.9, duration: 140, delay: -30},
  {top: 62, height: 18, opacity: 1, duration: 110, delay: -80},
  {top: 74, height: 20, opacity: 0.8, duration: 170, delay: -10},
];

// How strongly each shared layer shows for a given weather (0–1; ripples is a multiplier).
const SCENES: Record<
  Weather,
  {stars: number; moon: number; moonBlur: number; clouds: number; overcast: number; haze: number; reflection: number; ripples: number}
> = {
  clear: {stars: 1, moon: 1, moonBlur: 0, clouds: 1, overcast: 0, haze: 1, reflection: 1, ripples: 1},
  cloudy: {stars: 0.2, moon: 0.3, moonBlur: 8, clouds: 1, overcast: 0.75, haze: 0.5, reflection: 0.3, ripples: 0.8},
  rain: {stars: 0, moon: 0, moonBlur: 12, clouds: 0.6, overcast: 1, haze: 0.25, reflection: 0, ripples: 1.6},
  storm: {stars: 0, moon: 0, moonBlur: 12, clouds: 0.4, overcast: 1, haze: 0.15, reflection: 0, ripples: 2},
  snow: {stars: 0.1, moon: 0.2, moonBlur: 10, clouds: 0.8, overcast: 0.7, haze: 0.6, reflection: 0.15, ripples: 0.5},
  fog: {stars: 0.05, moon: 0.35, moonBlur: 14, clouds: 0.3, overcast: 0.3, haze: 0.2, reflection: 0.2, ripples: 0.4},
};

const fade = "transition-opacity duration-[1800ms] ease-in-out";

export default function Backdrop({weather}: {weather: Weather}) {
  const scene = SCENES[weather];
  const raining = weather === "rain" || weather === "storm";

  return (
    <div aria-hidden data-weather={weather} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* One sky per weather, cross-faded so switching is smooth. */}
      {(Object.keys(SCENES) as Weather[]).map((w) => (
        <div key={w} className={`sf-sky-${w} absolute inset-0 ${fade}`} style={{opacity: w === weather ? 1 : 0}} />
      ))}

      <div className={`absolute inset-0 ${fade}`} style={{opacity: scene.stars}}>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="sf-star absolute rounded-full bg-slate-100"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Behind cloud or fog the moon becomes a soft glow rather than a dimmed disc. */}
      <div
        className="absolute inset-0 transition-[opacity,filter] duration-[1800ms] ease-in-out"
        style={{opacity: scene.moon, filter: `blur(${scene.moonBlur}px)`}}
      >
        <div className="sf-moon absolute" />
      </div>

      <div className={`absolute inset-0 ${fade}`} style={{opacity: scene.clouds}}>
        {CLOUDS.map((c, i) => (
          <div
            key={i}
            className="sf-cloud absolute"
            style={{
              top: `${c.top}%`,
              width: `${c.width}vw`,
              height: `${c.height}vh`,
              opacity: c.opacity,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      <div className={`absolute inset-0 ${fade}`} style={{opacity: scene.overcast}}>
        {OVERCAST.map((c, i) => (
          <div
            key={i}
            className="sf-cloud sf-cloud-dense absolute"
            style={{
              top: `${c.top}%`,
              width: `${c.width}vw`,
              height: `${c.height}vh`,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      <div className={`sf-haze absolute inset-x-0 ${fade}`} style={{opacity: scene.haze}} />

      <div className="sf-water absolute inset-x-0 bottom-0">
        <div className="sf-horizon absolute inset-x-0 top-0" />
        <div className={`absolute inset-0 ${fade}`} style={{opacity: scene.reflection}}>
          <div className="sf-reflection absolute top-0" />
        </div>
        {RIPPLES.map((r, i) => (
          <div
            key={i}
            className={`sf-ripple absolute inset-x-0 ${fade}`}
            style={{
              bottom: `${r.bottom}%`,
              opacity: Math.min(1, r.opacity * scene.ripples),
              animationDuration: `${r.duration / (raining ? 2 : 1)}s`,
              backgroundSize: `${240 * r.scale}px ${10 * r.scale}px`,
              height: `${10 * r.scale}px`,
              maskPosition: `${i * 173}px 0, 0 0`,
            }}
          />
        ))}
      </div>

      {weather === "fog" && (
        <div className="sf-enter absolute inset-0">
          <div className="sf-fog-veil absolute inset-0" />
          {FOG_BANDS.map((b, i) => (
            <div
              key={i}
              className="sf-fog absolute"
              style={{
                top: `${b.top}%`,
                height: `${b.height}vh`,
                opacity: b.opacity,
                animationDuration: `${b.duration}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {raining && (
        <div className="sf-enter absolute inset-0">
          <div className="sf-rain sf-rain-far absolute inset-0" />
          <div className="sf-rain sf-rain-near absolute inset-0" />
          {weather === "storm" && <div className="sf-rain sf-rain-heavy absolute inset-0" />}
        </div>
      )}

      {weather === "storm" && <div className="sf-lightning absolute inset-0" />}

      {weather === "snow" && (
        <div className="sf-enter absolute inset-0">
          {SNOWFLAKES.map((f, i) => (
            <span
              key={i}
              className="sf-flake absolute -top-4 rounded-full bg-slate-100"
              style={
                {
                  left: `${f.left}%`,
                  width: f.size,
                  height: f.size,
                  opacity: f.opacity,
                  filter: f.size > 3 ? "blur(1px)" : undefined,
                  animationDuration: `${f.duration}s`,
                  animationDelay: `${f.delay}s`,
                  "--sway": `${f.sway}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div className="sf-grain absolute inset-0" />
      <div className="sf-vignette absolute inset-0" />
    </div>
  );
}
