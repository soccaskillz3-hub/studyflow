import type {CSSProperties} from "react";
import ForestWildlife from "./ForestWildlife";
import Rainbow from "./Rainbow";
import {CANOPY, NEAR, TREE_BANDS, UNDERGROWTH} from "./forestShapes";
import {rand} from "../../lib/random";
import type {TimeOfDay, Weather} from "../../lib/weather";

// The forest theme: layered trees under an overhanging canopy, with light falling through the
// gaps. Time of day sets the palette (data-time on .sf-forest in globals.css) and the angle and
// warmth of the light; weather dims it, and fog makes the beams stand out. Animals come and go
// in <ForestWildlife>.

const STARS = Array.from({length: 40}, (_, i) => ({
  left: rand(i, 61) * 100,
  top: rand(i, 62) * 42,
  size: rand(i, 63) < 0.85 ? 1 : 2,
  opacity: 0.25 + rand(i, 64) * 0.5,
  delay: rand(i, 65) * -10,
  duration: 5 + rand(i, 66) * 7,
}));

// Beams of light within the rotated ray box (left and width in % of the box).
const RAYS = Array.from({length: 8}, (_, i) => ({
  left: 6 + i * 11.5 + rand(i, 71) * 6,
  width: 3 + rand(i, 72) * 7,
  opacity: 0.45 + rand(i, 73) * 0.55,
  duration: 7 + rand(i, 74) * 7,
  delay: rand(i, 75) * -12,
}));

// Dust and pollen drifting through the light.
const MOTES = Array.from({length: 34}, (_, i) => ({
  left: 38 + rand(i, 81) * 60,
  top: 12 + rand(i, 82) * 70,
  size: 1.5 + rand(i, 83) * 2,
  duration: 14 + rand(i, 84) * 16,
  delay: rand(i, 85) * -30,
  drift: 20 + rand(i, 86) * 50,
}));

const FIREFLIES = Array.from({length: 26}, (_, i) => ({
  left: 3 + rand(i, 91) * 94,
  top: 48 + rand(i, 92) * 44,
  dx: (rand(i, 93) - 0.5) * 120,
  dy: (rand(i, 94) - 0.5) * 70,
  drift: 9 + rand(i, 95) * 10,
  blink: 2.5 + rand(i, 96) * 4,
  delay: rand(i, 97) * -12,
}));

const MIST = [
  {top: 58, height: 14, opacity: 0.8, duration: 90, delay: -20},
  {top: 70, height: 16, opacity: 1, duration: 120, delay: -70},
  {top: 82, height: 14, opacity: 0.7, duration: 100, delay: -40},
];

// Light at each time of day: how strong the beams are and their angle (degrees from vertical).
const TIMES: Record<TimeOfDay, {rays: number; angle: number; motes: number; fireflies: number; mist: number; stars: number}> = {
  sunrise: {rays: 1, angle: 44, motes: 0.8, fireflies: 0, mist: 1, stars: 0},
  day: {rays: 0.75, angle: 22, motes: 1, fireflies: 0, mist: 0.25, stars: 0},
  dusk: {rays: 0.6, angle: 54, motes: 0.5, fireflies: 0.7, mist: 0.5, stars: 0.35},
  night: {rays: 0.35, angle: 26, motes: 0, fireflies: 1, mist: 0.6, stars: 1},
};

// What weather does to that light (0–1, except mist, which fog thickens).
const WEATHER: Record<
  Weather,
  {rays: number; rayBlur: number; glow: number; motes: number; fireflies: number; mist: number; stars: number; veil: number}
> = {
  clear: {rays: 1, rayBlur: 5, glow: 1, motes: 1, fireflies: 1, mist: 1, stars: 1, veil: 0},
  cloudy: {rays: 0.3, rayBlur: 10, glow: 0.4, motes: 0.3, fireflies: 0.8, mist: 1, stars: 0.15, veil: 0.35},
  rain: {rays: 0.05, rayBlur: 12, glow: 0.15, motes: 0, fireflies: 0, mist: 1.3, stars: 0, veil: 0.55},
  storm: {rays: 0, rayBlur: 12, glow: 0, motes: 0, fireflies: 0, mist: 0.8, stars: 0, veil: 0.7},
  snow: {rays: 0.35, rayBlur: 9, glow: 0.5, motes: 0, fireflies: 0, mist: 0.6, stars: 0.1, veil: 0.35},
  // Fog is when light shafts are most visible.
  fog: {rays: 1, rayBlur: 14, glow: 0.6, motes: 0.6, fireflies: 0.5, mist: 1.8, stars: 0, veil: 0.4},
};

const fade = "transition-opacity duration-[1800ms] ease-in-out";

// How much snow has settled, 0–1: --snow-depth on the backdrop builds up slowly while it
// snows and melts when it stops (see .sf-backdrop in globals.css).
const settled = (amount: number) => `calc(var(--snow-depth) * ${amount})`;

// One band of trees, with snow on it as it settles (fainter on farther, hazier bands).
function TreeBand({shape, tone}: {shape: {d: string; snow: string}; tone: number}) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice">
      <path d={shape.d} style={{fill: `var(--tree-${tone})`}} />
      <path d={shape.snow} className="sf-snow-cap" style={{opacity: settled(1.1 - tone * 0.15)}} />
    </svg>
  );
}

export default function ForestScene({weather, time, rainbow}: {weather: Weather; time: TimeOfDay; rainbow: number | null}) {
  const t = TIMES[time];
  const w = WEATHER[weather];
  const rays = Math.min(1, t.rays * w.rays);

  return (
    <div data-time={time} data-weather={weather} className="sf-forest absolute inset-0 overflow-hidden">
      {(Object.keys(TIMES) as TimeOfDay[]).map((k) => (
        <div key={k} className={`sf-fsky-${k} absolute inset-0 ${fade}`} style={{opacity: k === time ? 1 : 0}} />
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

      {rainbow !== null && <Rainbow key={rainbow} time={time} />}

      {/* The sun or moon itself is hidden by the canopy; its glow shows where the light comes from. */}
      <div className={`sf-forest-glow absolute inset-0 ${fade}`} style={{opacity: w.glow}} />

      <TreeBand shape={TREE_BANDS[0]} tone={4} />
      <div className={`absolute inset-0 ${fade}`} style={{opacity: Math.min(1, t.mist * w.mist) * 0.6}}>
        <div className="sf-forest-haze absolute inset-x-0" />
      </div>
      <TreeBand shape={TREE_BANDS[1]} tone={3} />
      <div className={`sf-forest-veil absolute inset-0 ${fade}`} style={{opacity: w.veil}} />

      {/* Light shafts, in a box rotated to the light's angle so they fall from the upper right. */}
      <div
        className={`sf-rays absolute ${fade}`}
        style={{opacity: rays, "--ray-angle": `${t.angle}deg`, "--ray-blur": `${w.rayBlur}px`} as CSSProperties}
      >
        {RAYS.map((r, i) => (
          <div
            key={i}
            className="sf-ray absolute top-0 h-full"
            style={{
              left: `${r.left}%`,
              width: `${r.width}%`,
              opacity: r.opacity,
              animationDuration: `${r.duration}s`,
              animationDelay: `${r.delay}s`,
            }}
          />
        ))}
      </div>

      <div className={`absolute inset-0 ${fade}`} style={{opacity: t.motes * w.motes * Math.max(rays, 0.3)}}>
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="sf-mote absolute rounded-full"
            style={
              {
                left: `${m.left}%`,
                top: `${m.top}%`,
                width: m.size,
                height: m.size,
                animationDuration: `${m.duration}s, ${m.duration / 3}s`,
                animationDelay: `${m.delay}s, ${m.delay}s`,
                "--drift": `${m.drift}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <TreeBand shape={TREE_BANDS[2]} tone={2} />
      <div className="sf-forest-floor absolute inset-x-0 bottom-0" />
      <div className="sf-snow-cover absolute inset-x-0 bottom-0" />

      <div className={`absolute inset-0 ${fade}`} style={{opacity: Math.min(1, t.mist * w.mist)}}>
        {MIST.map((m, i) => (
          <div
            key={i}
            className="sf-mist absolute"
            style={{
              top: `${m.top}%`,
              height: `${m.height}vh`,
              opacity: m.opacity,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
            }}
          />
        ))}
      </div>

      <ForestWildlife time={time} weather={weather} />
      {/* In snow, a drift in front of the animals hides their feet, so they stand in it. */}
      <div className="sf-snow-front absolute inset-x-0 bottom-0" />

      {(["left", "right"] as const).map((side) => (
        <svg
          key={side}
          className={`sf-near sf-near-${side} absolute bottom-0 h-full ${side === "left" ? "left-0" : "right-0"}`}
          viewBox="0 0 400 1000"
          preserveAspectRatio={side === "left" ? "xMinYMax slice" : "xMaxYMax slice"}
        >
          <path d={NEAR[side].trunks} />
          <path d={NEAR[side].limb} className="sf-limb" />
          <path d={NEAR[side].snow} className="sf-limb sf-snow-cap" style={{opacity: settled(0.85)}} />
        </svg>
      ))}

      <svg className="sf-canopy absolute inset-x-0 top-0 w-full" viewBox="0 0 1600 320" preserveAspectRatio="xMidYMin slice">
        <path d={CANOPY} />
      </svg>

      <div className={`absolute inset-0 ${fade}`} style={{opacity: t.fireflies * w.fireflies}}>
        {FIREFLIES.map((f, i) => (
          <span
            key={i}
            className="sf-firefly absolute rounded-full"
            style={
              {
                left: `${f.left}%`,
                top: `${f.top}%`,
                animationDuration: `${f.drift}s, ${f.blink}s`,
                animationDelay: `${f.delay}s, ${f.delay}s`,
                "--dx": `${f.dx}px`,
                "--dy": `${f.dy}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {UNDERGROWTH.map((d, i) => (
        <svg
          key={i}
          className={`sf-undergrowth sf-undergrowth-${i} absolute inset-x-0 bottom-0 w-full`}
          viewBox="0 0 1600 200"
          preserveAspectRatio="xMidYMax slice"
        >
          <path d={d} />
        </svg>
      ))}

      <div className="sf-scrim absolute inset-0" />
    </div>
  );
}
