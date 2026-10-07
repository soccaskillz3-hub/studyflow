"use client";

import {useEffect, useRef, useState, type CSSProperties} from "react";
import {LIMBS_FIT, OWL_PERCH} from "./forestShapes";
import {flockPass, footsteps, owlHoot} from "../../lib/audio/sfx";
import {between, pick} from "../../lib/random";
import type {TimeOfDay, Weather} from "../../lib/weather";

// Animals that visit the forest now and then, depending on the time of day and weather: birds
// and a rabbit by day, deer at dawn and dusk, bats at dusk, an owl and a fox at night. Each
// visit runs through timed phases (walk in, graze, walk out…), and the animals you can see
// make their own sounds.

type Kind = "birds" | "deer" | "rabbit" | "butterflies" | "bats" | "owl" | "fox";
type Side = "left" | "right";
type Visit = {id: number; kind: Kind; side: Side; phase: string; seconds: number; y: number};

type Step = {phase: string; seconds: number; sound?: (visit: Visit, seconds: number) => void};

const panFor = (side: Side, amount = 0.6) => (side === "left" ? -amount : amount);

type Species = {
  times: TimeOfDay[];
  weather: Weather[];
  every: [number, number]; // seconds between visits
  first: [number, number]; // seconds before the first visit once conditions suit
  steps: Step[];
};

const FAIR: Weather[] = ["clear", "cloudy", "fog"];

const SPECIES: Record<Kind, Species> = {
  birds: {
    times: ["sunrise", "day"],
    weather: [...FAIR, "snow"],
    every: [18, 40],
    first: [3, 8],
    steps: [{phase: "fly", seconds: 16, sound: (v, s) => flockPass(s, v.side === "left")}],
  },
  deer: {
    times: ["sunrise", "day", "dusk"],
    weather: [...FAIR, "snow"],
    every: [60, 120],
    first: [8, 20],
    steps: [
      {phase: "in", seconds: 9, sound: (v, s) => footsteps("deer", s, panFor(v.side))},
      {phase: "graze", seconds: 14},
      {phase: "out", seconds: 9, sound: (v, s) => footsteps("deer", s, panFor(v.side, 0.85))},
    ],
  },
  rabbit: {
    times: ["sunrise", "day"],
    weather: FAIR,
    every: [70, 140],
    first: [25, 50],
    steps: [
      {phase: "in", seconds: 4, sound: (v, s) => footsteps("rabbit", s, panFor(v.side))},
      {phase: "sit", seconds: 9},
      {phase: "out", seconds: 4, sound: (v, s) => footsteps("rabbit", s, panFor(v.side))},
    ],
  },
  butterflies: {
    times: ["day"],
    weather: ["clear", "cloudy"],
    every: [50, 90],
    first: [10, 25],
    steps: [{phase: "flit", seconds: 18}],
  },
  bats: {
    times: ["dusk", "night"],
    weather: FAIR,
    every: [25, 50],
    first: [5, 12],
    steps: [{phase: "fly", seconds: 9}], // their calls are too high for us to hear
  },
  owl: {
    times: ["dusk", "night"],
    weather: [...FAIR, "rain", "snow"],
    every: [50, 90],
    first: [6, 14],
    steps: [
      {phase: "arrive", seconds: 2.5},
      {phase: "perch", seconds: 26, sound: (v) => [2, 14].forEach((at) => owlHoot({pan: panFor(v.side, 0.75), distance: 0.15, delay: at}))},
      {phase: "leave", seconds: 2.5},
    ],
  },
  fox: {
    times: ["dusk", "night"],
    weather: [...FAIR, "snow"],
    every: [80, 150],
    first: [20, 40],
    steps: [{phase: "trot", seconds: 13, sound: (v, s) => footsteps("fox", s, 0)}],
  },
};

const KINDS = Object.keys(SPECIES) as Kind[];

// ---------- Figures (drawn facing right) ----------

function Deer() {
  return (
    <svg viewBox="0 0 140 110" className="sf-deer-figure block h-auto w-full overflow-visible">
      <g className="sf-leg sf-leg-a" style={{transformOrigin: "40px 58px"}}><path d="M37 56 L42 56 L41 80 L43 103 L39 103 L36 80 Z" /></g>
      <g className="sf-leg sf-leg-b" style={{transformOrigin: "86px 58px"}}><path d="M83 56 L88 56 L88 80 L90 103 L86 103 L84 80 Z" /></g>
      <path d="M22 52 C22 38 40 34 60 35 C76 36 92 36 96 46 C99 56 92 64 80 65 C64 67 44 67 32 64 C25 62 22 58 22 52 Z" />
      <path d="M24 46 C18 44 16 40 18 38 C21 40 24 42 26 44 Z" />
      <g className="sf-leg sf-leg-b" style={{transformOrigin: "33px 58px"}}><path d="M29 56 L35 56 L35 80 L37 103 L33 103 L30 80 Z" /></g>
      <g className="sf-leg sf-leg-a" style={{transformOrigin: "92px 58px"}}><path d="M89 56 L94 56 L95 80 L97 103 L93 103 L91 80 Z" /></g>
      <g className="sf-deer-head" style={{transformOrigin: "88px 48px"}}>
        <path d="M84 50 C86 38 90 26 96 16 L104 18 C100 30 98 42 96 52 Z" />
        <path d="M95 14 C100 9 110 10 117 15 C120 18 118 22 112 22 C106 23 99 22 95 20 Z" />
        <path d="M97 13 C94 6 95 1 99 0 C101 4 101 9 100 13 Z" />
        <path d="M102 12 C104 5 108 2 111 3 C110 7 107 11 104 14 Z" />
      </g>
    </svg>
  );
}

function Fox() {
  return (
    <svg viewBox="0 0 120 60" className="sf-fox-figure block h-auto w-full overflow-visible">
      <g className="sf-leg sf-leg-a" style={{transformOrigin: "40px 34px"}}><path d="M37 32 L42 32 L42 56 L38 56 Z" /></g>
      <g className="sf-leg sf-leg-b" style={{transformOrigin: "74px 34px"}}><path d="M71 32 L76 32 L77 56 L73 56 Z" /></g>
      <path className="sf-fox-tail" style={{transformOrigin: "34px 30px"}} d="M36 30 C24 24 10 26 2 36 C0 40 4 42 8 40 C16 36 26 36 36 38 Z" />
      <path d="M32 30 C34 22 48 20 62 21 C74 22 84 22 86 30 C88 38 80 42 68 42 C54 43 40 42 34 39 C31 37 31 34 32 30 Z" />
      <g className="sf-leg sf-leg-b" style={{transformOrigin: "46px 34px"}}><path d="M43 32 L48 32 L48 56 L44 56 Z" /></g>
      <g className="sf-leg sf-leg-a" style={{transformOrigin: "80px 34px"}}><path d="M77 32 L82 32 L84 56 L80 56 Z" /></g>
      <path d="M80 26 C84 18 92 14 98 16 L112 24 C114 26 112 28 108 28 L96 30 C90 32 84 31 80 28 Z" />
      <path d="M92 16 L94 5 L99 15 Z" />
      <path d="M97 16 L101 6 L104 17 Z" />
    </svg>
  );
}

function Rabbit() {
  return (
    <svg viewBox="0 0 60 50" className="sf-rabbit-figure block h-auto w-full overflow-visible">
      <ellipse cx="27" cy="35" rx="16" ry="11" />
      <circle cx="12" cy="33" r="4" />
      <circle cx="43" cy="25" r="7.5" />
      <path className="sf-rabbit-ear" style={{transformOrigin: "42px 20px"}} d="M39 20 C36 10 36 2 39 1 C42 2 43 10 43 19 Z" />
      <path className="sf-rabbit-ear" style={{transformOrigin: "45px 20px"}} d="M43 20 C43 11 46 3 49 4 C51 6 49 13 46 21 Z" />
      <path d="M32 42 L44 42 L46 46 L30 46 Z" />
    </svg>
  );
}

function Owl() {
  return (
    <g>
      <path d="M-15 -4 C-20 -22 -18 -46 -10 -54 L-12 -64 L-4 -56 C-2 -57 2 -57 4 -56 L12 -64 L10 -54 C18 -46 20 -22 15 -4 C10 1 -10 1 -15 -4 Z" />
      <path d="M-8 0 L-6 4 L-4 0 M4 0 L6 4 L8 0" stroke="currentColor" strokeWidth="2" />
      <g className="sf-owl-eyes">
        <circle cx="-6" cy="-42" r="4.2" className="sf-owl-eye" />
        <circle cx="6" cy="-42" r="4.2" className="sf-owl-eye" />
        <circle cx="-5.4" cy="-42" r="1.7" className="sf-owl-pupil" />
        <circle cx="6.6" cy="-42" r="1.7" className="sf-owl-pupil" />
        <rect x="-12" y="-48" width="24" height="12" className="sf-owl-lids" style={{transformOrigin: "0 -48px"}} />
      </g>
      <path d="M-1.6 -37 L0 -33 L1.6 -37 Z" className="sf-owl-beak" />
    </g>
  );
}

function Bird() {
  return (
    <svg viewBox="0 0 40 20" className="sf-bird h-auto w-full overflow-visible">
      <path d="M2 10 Q11 2 20 10 Q29 2 38 10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function Bat() {
  return (
    <svg viewBox="0 0 40 20" className="sf-bat h-auto w-full overflow-visible">
      <path d="M20 9 C16 5 9 3 1 6 C5 8 5 10 3 13 C7 11 11 12 13 15 C15 12 17 12 20 14 C23 12 25 12 27 15 C29 12 33 11 37 13 C35 10 35 8 39 6 C31 3 24 5 20 9 Z" />
    </svg>
  );
}

function Butterfly({hue}: {hue: number}) {
  return (
    <svg viewBox="0 0 30 24" className="sf-butterfly h-auto w-full overflow-visible" style={{color: `hsl(${hue} 85% 82%)`}}>
      <g className="sf-wing-l" style={{transformOrigin: "15px 12px"}}>
        <path d="M15 12 C10 2 2 1 2 7 C2 11 8 13 15 12 Z M15 12 C9 13 4 17 7 21 C10 23 14 18 15 12 Z" fill="currentColor" />
      </g>
      <g className="sf-wing-r" style={{transformOrigin: "15px 12px"}}>
        <path d="M15 12 C20 2 28 1 28 7 C28 11 22 13 15 12 Z M15 12 C21 13 26 17 23 21 C20 23 16 18 15 12 Z" fill="currentColor" />
      </g>
    </svg>
  );
}

// ---------- One visit ----------

function VisitView({visit}: {visit: Visit}) {
  const {kind, side, phase, seconds, y} = visit;
  const dir = side === "left" ? 1 : -1; // which way it enters
  // Each phase's CSS animation lasts exactly as long as the phase.
  const base = {"--dir": dir, animationDuration: `${seconds}s`} as CSSProperties;

  switch (kind) {
    case "deer":
    case "rabbit": {
      // Wanders in from its side, stops a little way in, then turns and goes back.
      const facing = phase === "out" ? -dir : dir;
      return (
        <div className={`sf-ground sf-${kind} sf-phase-${phase} absolute`} style={{...base, [side]: kind === "deer" ? "clamp(4%, 13vw, 18%)" : "clamp(6%, 20vw, 26%)"}}>
          <span className="sf-shadow" />
          <div className="sf-walker" style={{transform: `scaleX(${facing})`}}>
            {kind === "deer" ? <Deer /> : <Rabbit />}
          </div>
        </div>
      );
    }
    case "fox":
      return (
        <div className={`sf-ground sf-fox sf-crossing absolute left-0`} style={base}>
          <span className="sf-shadow" />
          <div className="sf-walker" style={{transform: `scaleX(${dir})`}}>
            <Fox />
          </div>
        </div>
      );
    case "birds":
      return (
        <div className="sf-flock sf-crossing absolute left-0" style={{...base, top: `${y}%`}}>
          {[0, 1, 2, 3, 4].slice(0, 3 + (visit.id % 3)).map((i) => (
            <div key={i} className="sf-flock-bird absolute" style={{left: `${i * 34 - (i % 2) * 12}px`, top: `${(i % 3) * 14 - (i === 1 ? 10 : 0)}px`, animationDelay: `${i * -0.13}s`}}>
              <Bird />
            </div>
          ))}
        </div>
      );
    case "bats":
      return (
        <div className="sf-bats sf-crossing absolute left-0" style={{...base, top: `${y}%`}}>
          {[0, 1].map((i) => (
            <div key={i} className="sf-bat-flier absolute" style={{left: `${i * 46}px`, top: `${i * 22}px`, animationDelay: `${i * -0.7}s`}}>
              <Bat />
            </div>
          ))}
        </div>
      );
    case "butterflies":
      return (
        <div className="sf-butterflies absolute" style={{[side]: "clamp(2%, 9vw, 14%)", bottom: `${y}vh`}}>
          {[0, 1].map((i) => (
            <div key={i} className="sf-butterfly-flier absolute" style={{animationDelay: `${i * -4}s`, left: `${i * 40}px`}}>
              <Butterfly hue={i === 0 ? 48 : 200} />
            </div>
          ))}
        </div>
      );
    case "owl": {
      const perch = OWL_PERCH[side];
      return (
        <svg
          className={`sf-owl sf-near sf-phase-${phase} absolute bottom-0 h-full ${side === "left" ? "left-0" : "right-0"}`}
          viewBox="0 0 400 1000"
          preserveAspectRatio={side === "left" ? "xMinYMax slice" : "xMaxYMax slice"}
        >
          <g transform={`translate(${perch.x} ${perch.y})`}>
            <Owl />
          </g>
        </svg>
      );
    }
  }
}

// ---------- Scheduling ----------

export default function ForestWildlife({time, weather}: {time: TimeOfDay; weather: Weather}) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const busy = useRef(new Set<Kind>());
  const visitTimers = useRef(new Set<number>());
  const nextId = useRef(1);

  // Clear any visit still in progress when the forest goes away.
  useEffect(() => {
    const timers = visitTimers.current;
    return () => timers.forEach((id) => clearTimeout(id));
  }, []);

  // (Re)plan visits whenever the scene changes. Animals already out finish their visit.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const planning = new Set<number>();

    const later = (set: Set<number>, seconds: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        set.delete(id);
        fn();
      }, seconds * 1000);
      set.add(id);
    };

    const visit = (kind: Kind) => {
      const species = SPECIES[kind];
      const id = nextId.current++;
      const side: Side = pick(["left", "right"]);
      const y = kind === "birds" ? between(34, 48) : kind === "bats" ? between(32, 50) : kind === "butterflies" ? between(12, 22) : 0;
      busy.current.add(kind);

      let elapsed = 0;
      species.steps.forEach((step, i) => {
        later(visitTimers.current, elapsed, () => {
          const current: Visit = {id, kind, side, phase: step.phase, seconds: step.seconds, y};
          setVisits((all) => (i === 0 ? [...all, current] : all.map((v) => (v.id === id ? current : v))));
          step.sound?.(current, step.seconds);
        });
        elapsed += step.seconds;
      });
      later(visitTimers.current, elapsed, () => {
        setVisits((all) => all.filter((v) => v.id !== id));
        busy.current.delete(kind);
      });
    };

    for (const kind of KINDS) {
      const species = SPECIES[kind];
      if (!species.times.includes(time) || !species.weather.includes(weather)) continue;
      const plan = (first: boolean) =>
        later(planning, between(...(first ? species.first : species.every)), () => {
          // Owls perch on limbs, which narrow or tall screens crop away.
          const fits = kind !== "owl" || window.matchMedia(LIMBS_FIT).matches;
          if (!document.hidden && !busy.current.has(kind) && fits) visit(kind);
          plan(false);
        });
      plan(true);
    }
    return () => planning.forEach((id) => clearTimeout(id));
  }, [time, weather]);

  return (
    <div className="sf-wildlife absolute inset-0">
      {visits.map((v) => (
        <VisitView key={v.id} visit={v} />
      ))}
    </div>
  );
}
