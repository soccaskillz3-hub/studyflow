import {useState, type CSSProperties} from "react";
import {rand} from "../../lib/random";
import type {Weather} from "../../lib/weather";

// Rain, lightning, snow and fog, drawn over whichever theme is showing. They live outside the
// themes so switching theme doesn't restart them, which keeps thunder (timed from when the storm
// started, in app/lib/audio/soundscape.ts) in step with the lightning.

const SNOWFLAKES = Array.from({length: 90}, (_, i) => ({
  left: rand(i, 7) * 100,
  size: 1.5 + rand(i, 8) * 2.5,
  opacity: 0.35 + rand(i, 9) * 0.5,
  delay: rand(i, 10) * -20,
  duration: 12 + rand(i, 11) * 14,
  sway: 10 + rand(i, 12) * 30,
}));

const FOG_BANDS = [
  {top: 50, height: 22, opacity: 0.9, duration: 140, delay: -30},
  {top: 62, height: 18, opacity: 1, duration: 110, delay: -80},
  {top: 74, height: 20, opacity: 0.8, duration: 170, delay: -10},
];

// Rain and storms darken everything a little.
const DARK: Record<Weather, number> = {clear: 0, cloudy: 0, rain: 0.15, storm: 0.35, snow: 0, fog: 0};

// Snowfall that starts as it would outside: a few flakes, then more, over about half a minute.
// `gradual` is read once, when the snow begins; on a fresh page it's already falling in full.
function Snowfall({gradual}: {gradual: boolean}) {
  const [build] = useState(gradual);
  return (
    <div className={build ? "absolute inset-0" : "sf-enter absolute inset-0"}>
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
              // Building up: each flake starts falling from the top after its own wait.
              animationDelay: build ? `${(i / SNOWFLAKES.length) * 30 + f.delay * -0.4}s` : `${f.delay}s`,
              "--sway": `${f.sway}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function WeatherLayers({weather, gradual}: {weather: Weather; gradual: boolean}) {
  const raining = weather === "rain" || weather === "storm";

  return (
    <>
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

      <div
        className="absolute inset-0 bg-[#02040a] transition-opacity duration-[1800ms] ease-in-out"
        style={{opacity: DARK[weather]}}
      />

      {weather === "storm" && <div className="sf-lightning absolute inset-0" />}

      {weather === "snow" && <Snowfall gradual={gradual} />}
    </>
  );
}
