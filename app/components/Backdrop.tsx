import type {CSSProperties} from "react";
import type {TimeOfDay, Weather} from "../lib/weather";

// Sky-over-water scene rendered behind the whole app, varied by time of day and weather.
// Time of day sets the palette (CSS variables keyed off data-time in globals.css);
// weather layers cloud, veil, rain, snow or fog on top.
// Purely decorative: fixed, non-interactive and hidden from assistive tech.

// Deterministic pseudo-random so the scene is identical on server and client.
// Rounded so tiny floating-point differences between JS engines can't cause hydration mismatches.
function rand(i: number, n: number) {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
}

const STARS = Array.from({length: 70}, (_, i) => ({
  left: rand(i, 1) * 100,
  top: rand(i, 2) * 60,
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

// Wave bands from the horizon forward: nearer bands have taller, longer, faster waves.
const WAVES = [
  {top: 0, height: 10, periods: 18, duration: 70, bob: 7, tone: 1},
  {top: 14, height: 16, periods: 12, duration: 48, bob: 6, tone: 2},
  {top: 38, height: 24, periods: 8, duration: 34, bob: 5, tone: 3},
  {top: 66, height: 34, periods: 5, duration: 26, bob: 4.5, tone: 4},
];

// One SVG tile holds two identical wave runs so translating it by -50% loops seamlessly.
function wavePath(periods: number, height: number) {
  const width = 2400;
  const wavelength = width / (periods * 2);
  const amp = height * 0.45;
  let d = `M0 ${amp}`;
  for (let x = 0; x < width; x += wavelength) {
    d += ` Q${x + wavelength / 4} 0 ${x + wavelength / 2} ${amp} T${x + wavelength} ${amp}`;
  }
  return `${d} L${width} ${height} L0 ${height} Z`;
}

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

// How visible each light source is at each time of day (0–1).
const TIMES: Record<TimeOfDay, {stars: number; sun: number; moon: number}> = {
  sunrise: {stars: 0.1, sun: 1, moon: 0},
  day: {stars: 0, sun: 1, moon: 0},
  dusk: {stars: 0.6, sun: 0, moon: 1},
  night: {stars: 1, sun: 0, moon: 1},
};

// How strongly each layer shows for a given weather (0–1; ripples is a multiplier).
// "body" is whichever of the sun or moon is up.
const WEATHER: Record<
  Weather,
  {
    stars: number;
    body: number;
    bodyBlur: number;
    clouds: number;
    overcast: number;
    veil: number;
    haze: number;
    reflection: number;
    ripples: number;
    dark: number;
  }
> = {
  clear: {stars: 1, body: 1, bodyBlur: 0, clouds: 1, overcast: 0, veil: 0, haze: 1, reflection: 1, ripples: 1, dark: 0},
  cloudy: {stars: 0.2, body: 0.35, bodyBlur: 8, clouds: 1, overcast: 0.75, veil: 0.45, haze: 0.5, reflection: 0.3, ripples: 0.8, dark: 0},
  rain: {stars: 0, body: 0, bodyBlur: 12, clouds: 0.6, overcast: 1, veil: 0.65, haze: 0.25, reflection: 0, ripples: 1.6, dark: 0.15},
  storm: {stars: 0, body: 0, bodyBlur: 12, clouds: 0.4, overcast: 1, veil: 0.8, haze: 0.15, reflection: 0, ripples: 2, dark: 0.35},
  snow: {stars: 0.1, body: 0.25, bodyBlur: 10, clouds: 0.8, overcast: 0.7, veil: 0.5, haze: 0.6, reflection: 0.15, ripples: 0.5, dark: 0},
  fog: {stars: 0.05, body: 0.35, bodyBlur: 14, clouds: 0.3, overcast: 0.3, veil: 0.55, haze: 0.2, reflection: 0.2, ripples: 0.4, dark: 0},
};

const fade = "transition-opacity duration-[1800ms] ease-in-out";

export default function Backdrop({weather, time, visible}: {weather: Weather; time: TimeOfDay; visible: boolean}) {
  const w = WEATHER[weather];
  const t = TIMES[time];
  const raining = weather === "rain" || weather === "storm";

  return (
    <div
      aria-hidden
      data-weather={weather}
      data-time={time}
      className="sf-scene pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-700"
      style={{opacity: visible ? 1 : 0}}
    >
      {/* One sky per time of day, cross-faded so changes are smooth. */}
      {(Object.keys(TIMES) as TimeOfDay[]).map((k) => (
        <div key={k} className={`sf-sky-${k} absolute inset-0 ${fade}`} style={{opacity: k === time ? 1 : 0}} />
      ))}

      <div className={`absolute inset-0 ${fade}`} style={{opacity: t.stars * w.stars}}>
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

      {/* Behind cloud or fog the sun or moon becomes a soft glow rather than a dimmed disc. */}
      <div
        className="absolute inset-0 transition-[opacity,filter] duration-[1800ms] ease-in-out"
        style={{opacity: w.body, filter: `blur(${w.bodyBlur}px)`}}
      >
        <div className={`sf-sun absolute ${fade}`} style={{opacity: t.sun}} />
        <div className={`sf-moon absolute ${fade}`} style={{opacity: t.moon}} />
      </div>

      <div className={`sf-veil absolute inset-0 ${fade}`} style={{opacity: w.veil}} />

      <div className={`absolute inset-0 ${fade}`} style={{opacity: w.clouds}}>
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

      <div className={`absolute inset-0 ${fade}`} style={{opacity: w.overcast}}>
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

      <div className={`sf-haze absolute inset-x-0 ${fade}`} style={{opacity: w.haze}} />

      <div className="sf-water absolute inset-x-0 bottom-0">
        {WAVES.map((wave, i) => (
          <div key={i} className={`sf-wave-band sf-tone-${wave.tone} absolute inset-x-0 bottom-0`} style={{top: `${wave.top}%`}}>
            <div
              className="sf-wave-bob absolute inset-x-0"
              style={{top: -wave.height + 1, height: wave.height, animationDuration: `${wave.bob}s`, animationDelay: `${i * -1.3}s`}}
            >
              <svg
                className="sf-wave absolute left-0 top-0 h-full"
                viewBox={`0 0 2400 ${wave.height}`}
                preserveAspectRatio="none"
                style={{animationDuration: `${wave.duration}s`}}
              >
                <path d={wavePath(wave.periods, wave.height)} />
              </svg>
            </div>
          </div>
        ))}

        <div className={`absolute inset-0 ${fade}`} style={{opacity: w.reflection}}>
          <div className="sf-reflection absolute top-0" />
        </div>
        {RIPPLES.map((r, i) => (
          <div
            key={i}
            className={`sf-ripple absolute inset-x-0 ${fade}`}
            style={{
              bottom: `${r.bottom}%`,
              opacity: Math.min(1, r.opacity * w.ripples),
              animationDuration: `${r.duration / (raining ? 2 : 1)}s`,
              backgroundSize: `${240 * r.scale}px ${10 * r.scale}px`,
              height: `${10 * r.scale}px`,
              maskPosition: `${i * 173}px 0, 0 0`,
            }}
          />
        ))}
        <div className={`sf-water-veil absolute inset-0 ${fade}`} style={{opacity: w.veil * 0.4}} />
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

      <div className={`absolute inset-0 bg-[#02040a] ${fade}`} style={{opacity: w.dark}} />

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

      {/* Gentle darkening behind the content column so floating text stays readable on bright skies. */}
      <div className="sf-scrim absolute inset-0" />
      <div className="sf-grain absolute inset-0" />
      <div className="sf-vignette absolute inset-0" />
    </div>
  );
}
