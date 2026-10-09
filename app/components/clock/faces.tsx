"use client";

import type {CSSProperties} from "react";
import type {SunTimes} from "../../lib/weather";
import {formatMinutes} from "../../lib/time";

// Each face gets the time (updated every second) and draws itself in the theme's display font.
// The second hand and seconds ring sweep smoothly with a CSS animation started at the right
// point (a negative delay), so React only re-renders once a second. With reduced motion they
// tick instead.
export type FaceProps = {now: Date; smooth: boolean};

const pad = (n: number) => String(n).padStart(2, "0");
const hour12 = (d: Date) => (d.getHours() % 12 === 0 ? 12 : d.getHours() % 12);
const meridiem = (d: Date) => (d.getHours() >= 12 ? "PM" : "AM");
const secondsIntoMinute = (d: Date) => d.getSeconds() + d.getMilliseconds() / 1000;

const longDate = (d: Date) => d.toLocaleDateString(undefined, {weekday: "long", month: "long", day: "numeric"});

// A rotation that keeps turning once a minute from where the second hand is now.
function sweep(now: Date, smooth: boolean): CSSProperties {
  if (!smooth) return {transform: `rotate(${now.getSeconds() * 6}deg)`};
  return {animation: "sf-clock-spin 60s linear infinite", animationDelay: `-${secondsIntoMinute(now)}s`};
}

// Fixed-width cells per digit (sized per theme, as on the focus timer) so the time never jitters.
function Digits({text}: {text: string}) {
  return (
    <>
      {[...text].map((ch, i) =>
        ch === ":" ? (
          <span key={i} className="sf-clock-colon inline-block w-[var(--timer-colon)] text-center">
            :
          </span>
        ) : (
          <span key={i} className="inline-block w-[var(--timer-digit)] text-center">
            {ch}
          </span>
        ),
      )}
    </>
  );
}

const caption = "text-[11px] uppercase tracking-[0.35em] text-white/70 sm:text-xs";

// ---------- Classic: big, quiet numbers ----------

export function ClassicFace({now, smooth}: FaceProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="sf-clock-glow font-display text-[clamp(5rem,22vw,15rem)] leading-none whitespace-nowrap">
        <Digits text={`${hour12(now)}:${pad(now.getMinutes())}`} />
        <span className="ml-[0.12em] align-top text-[0.16em] tracking-[0.2em] text-scene-soft">{meridiem(now)}</span>
      </p>
      {/* The seconds as a line that fills across each minute. */}
      <div className="mt-6 h-px w-[min(26rem,70vw)] overflow-hidden bg-white/15">
        <div
          className="h-px origin-left bg-scene shadow-[0_0_10px_var(--accent-glow)]"
          style={
            smooth
              ? {animation: "sf-clock-fill 60s linear infinite", animationDelay: `-${secondsIntoMinute(now)}s`}
              : {transform: `scaleX(${now.getSeconds() / 60})`}
          }
        />
      </div>
      <p className={`mt-6 ${caption}`}>{longDate(now)}</p>
    </div>
  );
}

// ---------- Analog: a dial with a sweeping second hand ----------

const NUMERALS = [
  {at: 0, text: "XII"},
  {at: 3, text: "III"},
  {at: 6, text: "VI"},
  {at: 9, text: "IX"},
];

export function AnalogFace({now, smooth}: FaceProps) {
  const s = secondsIntoMinute(now);
  const minuteAngle = (now.getMinutes() + s / 60) * 6;
  const hourAngle = ((now.getHours() % 12) + now.getMinutes() / 60) * 30;
  const day = now.toLocaleDateString(undefined, {weekday: "short", day: "numeric"});

  return (
    <svg viewBox="0 0 200 200" className="sf-clock-dial h-[min(70vmin,34rem)] w-[min(70vmin,34rem)]" role="img" aria-label="Analog clock">
      <defs>
        <radialGradient id="dial-glass" cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.09)" />
          <stop offset="70%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="97" fill="url(#dial-glass)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="92.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />

      {Array.from({length: 60}, (_, i) => {
        const hour = i % 5 === 0;
        return (
          <line
            key={i}
            x1="100"
            y1={hour ? 9 : 10.5}
            x2="100"
            y2={hour ? 17 : 13}
            stroke={hour ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)"}
            strokeWidth={hour ? 1.4 : 0.5}
            strokeLinecap="round"
            transform={`rotate(${i * 6} 100 100)`}
          />
        );
      })}
      {NUMERALS.map(({at, text}) => {
        const a = (at * 30 * Math.PI) / 180;
        return (
          <text
            key={text}
            x={100 + Math.sin(a) * 70}
            y={100 - Math.cos(a) * 70}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-white/80 font-display"
            fontSize="12"
            letterSpacing="0.5"
          >
            {text}
          </text>
        );
      })}

      <text x="100" y="134" textAnchor="middle" className="fill-scene-soft font-mono uppercase" fontSize="5.5" letterSpacing="1.6">
        {day}
      </text>

      {/* Hour and minute hands: tapered, with a soft glow. */}
      <g className="sf-clock-hand" transform={`rotate(${hourAngle} 100 100)`}>
        <path d="M97.6 104 L98.8 52 Q100 48 101.2 52 L102.4 104 Z" fill="white" />
      </g>
      <g className="sf-clock-hand" transform={`rotate(${minuteAngle} 100 100)`}>
        <path d="M98.6 106 L99.4 24 Q100 21 100.6 24 L101.4 106 Z" fill="white" />
      </g>
      <g className="sf-clock-second" style={sweep(now, smooth)}>
        <line x1="100" y1="122" x2="100" y2="16" className="stroke-scene" strokeWidth="0.7" strokeLinecap="round" />
        <circle cx="100" cy="118" r="2.6" className="fill-scene" />
      </g>
      <circle cx="100" cy="100" r="3.4" className="fill-scene" />
      <circle cx="100" cy="100" r="1.3" fill="#0b1220" />
    </svg>
  );
}

// ---------- Words: the time, written out ----------

const NUMBER_WORDS = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];
const PAST: Record<number, string> = {5: "five past", 10: "ten past", 15: "quarter past", 20: "twenty past", 25: "twenty-five past", 30: "half past"};
const TO: Record<number, string> = {35: "twenty-five to", 40: "twenty to", 45: "quarter to", 50: "ten to", 55: "five to"};

export function timeInWords(now: Date) {
  const m = now.getMinutes();
  const rounded = Math.round(m / 5) * 5;
  const hours = now.getHours() + (rounded >= 35 ? 1 : 0);
  const lead = m === rounded % 60 || m === rounded ? "It's" : m < rounded ? "It's almost" : "It's just after";
  const h24 = hours % 24;
  const hourWord = NUMBER_WORDS[h24 % 12];
  const minute = rounded % 60;

  let phrase: string;
  let hour: string;
  if (minute === 0 && (h24 === 12 || h24 === 0)) {
    phrase = "";
    hour = h24 === 12 ? "noon" : "midnight";
  } else if (minute === 0) {
    phrase = "";
    hour = `${hourWord} o'clock`;
  } else {
    phrase = PAST[minute] ?? TO[minute];
    hour = h24 === 12 ? "noon" : h24 === 0 ? "midnight" : hourWord;
  }
  const part =
    hour === "noon" || hour === "midnight"
      ? ""
      : h24 >= 5 && h24 < 12
        ? "in the morning"
        : h24 >= 12 && h24 < 17
          ? "in the afternoon"
          : h24 >= 17 && h24 < 21
            ? "in the evening"
            : "at night";
  return {lead, phrase, hour, part};
}

export function WordsFace({now}: FaceProps) {
  const {lead, phrase, hour, part} = timeInWords(now);
  const key = `${lead}${phrase}${hour}`;

  return (
    <div className="flex max-w-[min(56rem,92vw)] flex-col items-center text-center">
      <p key={`${key}-lead`} className={`sf-rise ${caption} text-scene-soft`}>
        {lead}
      </p>
      <h2 key={key} className="sf-rise sf-clock-glow mt-5 font-display text-[clamp(3rem,10vw,7.5rem)] leading-[0.95]" style={{animationDelay: "0.08s"}}>
        {phrase && <span className="block">{phrase}</span>}
        <span className="block text-scene-ink">{hour}</span>
      </h2>
      {part && <p className={`mt-6 ${caption}`}>{part}</p>}
      <p className="mt-8 text-xs text-white/45 tabular-nums">
        {hour12(now)}:{pad(now.getMinutes())} {meridiem(now)}
      </p>
    </div>
  );
}

// ---------- Orbit: rings for hours, minutes and seconds ----------

const RINGS = {seconds: 92, minutes: 80, hours: 68};
const circumference = (r: number) => 2 * Math.PI * r;

function Ring({r, fraction, width, opacity, style}: {r: number; fraction: number; width: number; opacity: number; style?: CSSProperties}) {
  const c = circumference(r);
  return (
    <>
      <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={width} />
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        className="stroke-scene"
        strokeOpacity={opacity}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        style={{filter: "drop-shadow(0 0 3px var(--accent-glow))", ...style}}
      />
    </>
  );
}

export function OrbitFace({now, smooth}: FaceProps) {
  const s = secondsIntoMinute(now);
  const minutes = (now.getMinutes() + s / 60) / 60;
  const hours = ((now.getHours() % 12) + now.getMinutes() / 60) / 12;
  const c = circumference(RINGS.seconds);

  return (
    <div className="relative h-[min(72vmin,34rem)] w-[min(72vmin,34rem)]">
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <Ring r={RINGS.hours} fraction={hours} width={5} opacity={1} />
        <Ring r={RINGS.minutes} fraction={minutes} width={3} opacity={0.75} />
        <Ring
          r={RINGS.seconds}
          fraction={smooth ? 0 : now.getSeconds() / 60}
          width={1.2}
          opacity={0.55}
          style={
            smooth
              ? ({
                  "--ring": `${c}px`,
                  animation: "sf-clock-ring 60s linear infinite",
                  animationDelay: `-${s}s`,
                } as CSSProperties)
              : undefined
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="sf-clock-glow font-display text-[clamp(3rem,11vmin,6rem)] leading-none whitespace-nowrap">
          <Digits text={`${hour12(now)}:${pad(now.getMinutes())}`} />
        </p>
        <p className={`mt-3 ${caption} text-scene-soft`}>
          {meridiem(now)} · {now.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"})}
        </p>
      </div>
    </div>
  );
}

// ---------- Sun path: the sun (or moon) along its arc across the sky ----------

const DAY = 24 * 60 * 60 * 1000;

// Today's sunrise and sunset, or 6:30 AM and 7:00 PM without a location (as the scene assumes).
function sunTimes(now: Date, sun: SunTimes | null) {
  return sun ?? {sunrise: new Date(now).setHours(6, 30, 0, 0), sunset: new Date(now).setHours(19, 0, 0, 0)};
}

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"});

export function SunFace({now, sun}: FaceProps & {sun: SunTimes | null}) {
  const {sunrise, sunset} = sunTimes(now, sun);
  const t = now.getTime();
  const daytime = t >= sunrise && t < sunset;
  // At night, the moon crosses from the last sunset to the next sunrise.
  const [from, to] = daytime ? [sunrise, sunset] : t >= sunset ? [sunset, sunrise + DAY] : [sunset - DAY, sunrise];
  const p = Math.min(1, Math.max(0, (t - from) / (to - from)));

  // A half ellipse from the left end of the horizon to the right.
  const cx = 200;
  const rx = 165;
  const ry = 120;
  const base = 160;
  const angle = Math.PI * (1 - p);
  const x = cx + rx * Math.cos(angle);
  const y = base - ry * Math.sin(angle);
  const arc = `M ${cx - rx} ${base} A ${rx} ${ry} 0 0 1 ${cx + rx} ${base}`;
  const travelled = `M ${cx - rx} ${base} A ${rx} ${ry} 0 0 1 ${x} ${y}`;
  const left = Math.max(0, to - t);
  const next = daytime ? "Sunset" : "Sunrise";

  return (
    <div className="flex w-[min(44rem,92vw)] flex-col items-center text-center">
      <svg viewBox="0 0 400 186" className="w-full overflow-visible" aria-hidden>
        <path d={arc} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" strokeDasharray="2 4" />
        <path d={travelled} fill="none" className="stroke-scene" strokeWidth="1.4" strokeLinecap="round" style={{filter: "drop-shadow(0 0 4px var(--accent-glow))"}} />
        <line x1="10" y1={base} x2="390" y2={base} stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
        {daytime ? (
          <g style={{filter: "drop-shadow(0 0 10px rgba(255,214,140,0.9)) drop-shadow(0 0 28px rgba(255,190,110,0.5))"}}>
            <circle cx={x} cy={y} r="18" fill="rgba(255,214,140,0.16)" />
            <circle cx={x} cy={y} r="9" fill="#ffe2a3" />
          </g>
        ) : (
          <g style={{filter: "drop-shadow(0 0 10px rgba(220,230,255,0.75))"}}>
            <circle cx={x} cy={y} r="16" fill="rgba(220,230,255,0.08)" />
            <circle cx={x} cy={y} r="8" fill="#eef2ff" />
            <circle cx={x + 3.6} cy={y - 2.4} r="7" fill="#1a2238" opacity="0.88" />
          </g>
        )}
        <text x={cx - rx} y={base + 18} textAnchor="middle" className="fill-white/60 font-mono" fontSize="9" letterSpacing="1.5">
          {daytime ? `↑ ${clockTime(from)}` : `↓ ${clockTime(from)}`}
        </text>
        <text x={cx + rx} y={base + 18} textAnchor="middle" className="fill-white/60 font-mono" fontSize="9" letterSpacing="1.5">
          {daytime ? `↓ ${clockTime(to)}` : `↑ ${clockTime(to)}`}
        </text>
      </svg>
      <p className="sf-clock-glow mt-4 font-display text-[clamp(3.5rem,12vw,7rem)] leading-none whitespace-nowrap">
        <Digits text={`${hour12(now)}:${pad(now.getMinutes())}`} />
        <span className="ml-[0.12em] align-top text-[0.2em] tracking-[0.2em] text-scene-soft">{meridiem(now)}</span>
      </p>
      <p className={`mt-5 ${caption} text-scene-soft`}>
        {next} in {formatMinutes(Math.max(1, Math.round(left / 60000)))}
      </p>
      {!sun && <p className="mt-3 text-[11px] text-white/40">Approximate. Allow location for your real sunrise and sunset.</p>}
    </div>
  );
}
