import {audio, lfo, noiseSource} from "./engine";
import * as sfx from "./sfx";
import {between} from "../random";
import type {Theme} from "../themes";
import {LIGHTNING, type TimeOfDay, type Weather} from "../weather";

// The scene's ambience: continuous "beds" (waves, wind, rain, leaves, crickets) mixed for the
// current theme, time and weather, plus occasional unseen calls (distant birds, gulls, a
// foghorn) and thunder timed to the lightning. Animals you can see make their own sounds
// (see ForestWildlife); this covers everything else.

export type SoundScene = {theme: Theme; time: TimeOfDay; weather: Weather};

type Bed = "surf" | "undertow" | "wind" | "leaves" | "rain" | "downpour" | "canopyRain" | "crickets";
type Call = "birds" | "woodpecker" | "owl" | "frogs" | "gulls" | "foghorn" | "bell";

const BEDS: Bed[] = ["surf", "undertow", "wind", "leaves", "rain", "downpour", "canopyRain", "crickets"];
const CALLS: Call[] = ["birds", "woodpecker", "owl", "frogs", "gulls", "foghorn", "bell"];

const LABELS: Record<Bed | Call | "thunder", string> = {
  surf: "Waves",
  undertow: "Swell",
  wind: "Wind",
  leaves: "Rustling leaves",
  rain: "Rain",
  downpour: "Downpour",
  canopyRain: "Rain on leaves",
  crickets: "Crickets",
  birds: "Birdsong",
  woodpecker: "Woodpecker",
  owl: "Owls",
  frogs: "Frogs",
  gulls: "Gulls",
  foghorn: "Foghorn",
  bell: "Buoy bell",
  thunder: "Thunder",
};

type Levels = Partial<Record<Weather, number>>;
const by = (levels: Levels, weather: Weather) => levels[weather] ?? 0;

// How loud each bed is for a scene (0–1).
function bedLevels({theme, time, weather}: SoundScene): Partial<Record<Bed, number>> {
  const rainy = {rain: by({rain: 0.7, storm: 0.6}, weather), downpour: by({rain: 0.15, storm: 0.7}, weather)};
  if (theme === "ocean") {
    const calm = time === "night" ? 0.75 : 1;
    return {
      surf: by({clear: 0.55, cloudy: 0.55, rain: 0.42, storm: 0.6, snow: 0.32, fog: 0.4}, weather) * calm,
      undertow: by({clear: 0.35, cloudy: 0.38, rain: 0.35, storm: 0.55, snow: 0.28, fog: 0.35}, weather),
      wind: by({clear: 0.15, cloudy: 0.3, rain: 0.25, storm: 0.6, snow: 0.5, fog: 0.2}, weather),
      ...rainy,
    };
  }
  const evening = {sunrise: 1, day: 1, dusk: 0.8, night: 0.6}[time];
  const insects = {sunrise: 0, day: 0, dusk: 0.5, night: 1}[time];
  return {
    leaves: by({clear: 0.4, cloudy: 0.48, rain: 0.25, storm: 0.55, snow: 0.15, fog: 0.22}, weather) * evening,
    wind: by({clear: 0.15, cloudy: 0.35, rain: 0.25, storm: 0.75, snow: 0.8, fog: 0.2}, weather),
    canopyRain: by({rain: 0.8, storm: 0.7}, weather),
    crickets: insects * by({clear: 1, cloudy: 0.9, fog: 0.7, rain: 0.15}, weather),
    ...rainy,
  };
}

// Seconds between unseen calls, by time of day, and how weather stretches that out (a missing
// weather means the call stops). E.g. a dawn chorus that thins through the day and goes quiet in rain.
type Range = [number, number];
type Pattern = {times: Partial<Record<TimeOfDay, Range>>; weather: Levels};

const FOREST_CALLS: Partial<Record<Call, Pattern>> = {
  birds: {times: {sunrise: [0.6, 2.2], day: [2, 6], dusk: [8, 20]}, weather: {clear: 1, cloudy: 1.3, fog: 1.8, snow: 3}},
  woodpecker: {times: {sunrise: [60, 140], day: [45, 100]}, weather: {clear: 1, cloudy: 1.2, fog: 1.5}},
  owl: {times: {dusk: [90, 180], night: [40, 90]}, weather: {clear: 1, cloudy: 1, fog: 1, rain: 1.5, snow: 1.2}},
  frogs: {times: {dusk: [10, 25], night: [8, 20]}, weather: {clear: 1, cloudy: 1, fog: 1.2, rain: 0.6}},
};

const OCEAN_CALLS: Partial<Record<Call, Pattern>> = {
  gulls: {times: {sunrise: [20, 55], day: [20, 55]}, weather: {clear: 1, cloudy: 1.3, fog: 2}},
  foghorn: {times: {sunrise: [40, 80], day: [40, 80], dusk: [40, 80], night: [40, 80]}, weather: {fog: 1}},
  bell: {times: {dusk: [30, 70], night: [30, 70]}, weather: {clear: 1, cloudy: 1, fog: 1}},
};

function callEvery(call: Call, {theme, time, weather}: SoundScene): Range | null {
  const pattern = (theme === "forest" ? FOREST_CALLS : OCEAN_CALLS)[call];
  const range = pattern?.times[time];
  const factor = pattern?.weather[weather];
  return range && factor ? [range[0] * factor, range[1] * factor] : null;
}

const PLAY: Record<Call, () => void> = {
  birds: () => sfx.birdCall({distance: between(0.2, 0.75)}),
  woodpecker: () => sfx.woodpecker(),
  owl: () => sfx.owlHoot({pan: between(-0.9, 0.9), distance: between(0.5, 0.9)}),
  frogs: () => sfx.frogs(),
  gulls: () => sfx.gull(),
  foghorn: () => sfx.foghorn(),
  bell: () => sfx.buoyBell(),
};

// What a scene sounds like, for the settings menu.
export function describe(scene: SoundScene) {
  const levels = bedLevels(scene);
  const names = BEDS.filter((b) => (levels[b] ?? 0) > 0.05 && b !== "undertow").map((b) => LABELS[b]);
  names.push(...CALLS.filter((c) => callEvery(c, scene)).map((c) => LABELS[c]));
  if (scene.weather === "storm") names.push(LABELS.thunder);
  return names;
}

type Layer = {gain: GainNode; stop: () => void; level: number; retune?: (scene: SoundScene) => void};

// ---------- Bed builders ----------

// Builds a bed into `out` and returns its sources (to stop later), plus optionally a way to
// adjust it when the scene changes without rebuilding it.
type Built = AudioScheduledSourceNode[] | {sources: AudioScheduledSourceNode[]; retune: (scene: SoundScene) => void};
type Builder = (ctx: AudioContext, out: AudioNode) => Built;

// Seconds per wave: quick, choppy sets by day; the long, heavy swell of night.
const WAVE_SECONDS: Record<TimeOfDay, number> = {sunrise: 7, day: 5.5, dusk: 9, night: 12};

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

function amp(ctx: AudioContext, value: number) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

const BUILDERS: Record<Bed, Builder> = {
  // Breaking waves: the same slow swell opens the filter and raises the level, so each wave
  // brightens as it builds and darkens as it draws back. A hiss of foam rides on top.
  surf: (ctx, out) => {
    const src = noiseSource(ctx, "pink");
    const tone = filter(ctx, "lowpass", 650, 0.4);
    const body = amp(ctx, 0.45);
    src.connect(tone).connect(body).connect(out);
    const foamSrc = noiseSource(ctx, "white");
    const foam = amp(ctx, 0.08);
    foamSrc.connect(filter(ctx, "bandpass", 2600, 0.6)).connect(foam).connect(out);

    const swell = ctx.createOscillator();
    swell.frequency.value = 1 / WAVE_SECONDS.night;
    for (const [param, depth] of [[tone.frequency, 420], [body.gain, 0.38], [foam.gain, 0.07]] as const) {
      const g = amp(ctx, depth);
      swell.connect(g).connect(param);
    }
    swell.start();
    // A second, slower swell so the sets aren't perfectly regular.
    const sources = [src, foamSrc, swell, lfo(ctx, body.gain, 0.031, 0.12), lfo(ctx, tone.frequency, 0.047, 150)];
    const variation = between(0.92, 1.08);
    return {
      sources,
      retune: ({time}) => swell.frequency.setTargetAtTime(variation / WAVE_SECONDS[time], ctx.currentTime, 3),
    };
  },
  undertow: (ctx, out) => {
    const src = noiseSource(ctx, "brown");
    const body = amp(ctx, 0.7);
    src.connect(filter(ctx, "highpass", 28)).connect(filter(ctx, "lowpass", 220)).connect(body).connect(out);
    return [src, lfo(ctx, body.gain, 0.06, 0.25)];
  },
  wind: (ctx, out) => {
    const src = noiseSource(ctx, "pink");
    const band = filter(ctx, "bandpass", 480, 0.8);
    const body = amp(ctx, 0.4);
    src.connect(band).connect(body).connect(out);
    return [src, lfo(ctx, band.frequency, 0.045, 240), lfo(ctx, band.frequency, 0.11, 80), lfo(ctx, body.gain, 0.07, 0.24), lfo(ctx, body.gain, 0.023, 0.12)];
  },
  // Leaves: a soft rustle in gusts, from three unrelated wobbles.
  leaves: (ctx, out) => {
    // Pink noise in a mid band: a soft rustle rather than a bright hiss.
    const src = noiseSource(ctx, "pink");
    const body = amp(ctx, 0.3);
    src.connect(filter(ctx, "highpass", 700)).connect(filter(ctx, "lowpass", 3200)).connect(body).connect(out);
    return [src, lfo(ctx, body.gain, 0.19, 0.15), lfo(ctx, body.gain, 0.11, 0.1), lfo(ctx, body.gain, 0.41, 0.04)];
  },
  rain: (ctx, out) => {
    const src = noiseSource(ctx, "pink");
    src.connect(filter(ctx, "highpass", 600)).connect(filter(ctx, "lowpass", 7000)).connect(amp(ctx, 0.5)).connect(out);
    const patter = noiseSource(ctx, "white");
    patter.connect(filter(ctx, "bandpass", 3600, 0.8)).connect(amp(ctx, 0.05)).connect(out);
    return [src, patter];
  },
  downpour: (ctx, out) => {
    const low = noiseSource(ctx, "brown");
    low.connect(filter(ctx, "highpass", 30)).connect(filter(ctx, "lowpass", 700)).connect(amp(ctx, 0.55)).connect(out);
    const wash = noiseSource(ctx, "pink");
    wash.connect(filter(ctx, "highpass", 250)).connect(filter(ctx, "lowpass", 5000)).connect(amp(ctx, 0.4)).connect(out);
    return [low, wash];
  },
  canopyRain: (ctx, out) => {
    const src = noiseSource(ctx, "white");
    const body = amp(ctx, 0.045);
    src.connect(filter(ctx, "bandpass", 3800, 1.4)).connect(body).connect(out);
    return [src, lfo(ctx, body.gain, 0.3, 0.015)];
  },
  // Three crickets at slightly different pitches and tempos, spread across the stereo field.
  crickets: (ctx, out) => {
    const buffer = cricketChirps(ctx);
    return (
      [
        [0.93, -0.7, 0.2],
        [1.0, 0.15, 0.14],
        [1.07, 0.65, 0.17],
      ] as const
    ).map(([rate, pan, level]) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.playbackRate.value = rate * between(0.98, 1.02);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      src.connect(amp(ctx, level)).connect(panner).connect(out);
      src.start(0, Math.random() * 2.4);
      return src;
    });
  },
};

// 2.4 s of cricket: four chirps, each three quick pulses of a ~4.4 kHz tone.
let cricketCache: AudioBuffer | null = null;
function cricketChirps(ctx: AudioContext) {
  if (cricketCache) return cricketCache;
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * 2.4), rate);
  const data = buffer.getChannelData(0);
  for (const start of [0.05, 0.65, 1.25, 1.85]) {
    for (let p = 0; p < 3; p++) {
      const from = Math.floor((start + p * 0.032) * rate);
      const length = Math.floor(0.018 * rate);
      for (let i = 0; i < length; i++) {
        const t = (from + i) / rate;
        data[from + i] += Math.sin((Math.PI * i) / length) * Math.sin(2 * Math.PI * 4400 * t) * 0.8;
      }
    }
  }
  cricketCache = buffer;
  return buffer;
}

// ---------- The mixer ----------

class Soundscape {
  private scene: SoundScene | null = null;
  private layers = new Map<Bed, Layer>();
  private callTimers = new Map<Call, number>();
  private stopTimers = new Map<Bed, number>();
  private stormSince: number | null = null;
  private thunderTimer: number | null = null;

  constructor() {
    if (typeof window !== "undefined") audio.onReady(() => this.refresh());
  }

  set(scene: SoundScene) {
    if (scene.weather === "storm" && this.scene?.weather !== "storm") this.stormSince = performance.now();
    if (scene.weather !== "storm") this.stormSince = null;
    this.scene = scene;
    this.refresh();
  }

  private refresh() {
    const ctx = audio.context;
    const out = audio.bus("ambience");
    const scene = this.scene;
    if (!ctx || !out || !scene) return;

    const levels = bedLevels(scene);
    for (const bed of BEDS) {
      const level = levels[bed] ?? 0;
      let layer = this.layers.get(bed);
      if (!layer && level > 0) layer = this.start(ctx, out, bed);
      if (!layer) continue;
      layer.level = level;
      layer.gain.gain.setTargetAtTime(level, ctx.currentTime, 1.2);
      layer.retune?.(scene);

      // Silent beds are torn down after their fade so they cost nothing; returning ones restart.
      clearTimeout(this.stopTimers.get(bed));
      if (level === 0) {
        this.stopTimers.set(
          bed,
          window.setTimeout(() => {
            const current = this.layers.get(bed);
            if (current && current.level === 0) {
              current.stop();
              this.layers.delete(bed);
            }
          }, 8000),
        );
      }
    }

    for (const call of CALLS) {
      if (callEvery(call, scene) && !this.callTimers.has(call)) this.scheduleCall(call, true);
    }
    this.scheduleThunder();
  }

  private start(ctx: AudioContext, out: AudioNode, bed: Bed): Layer {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    const built = BUILDERS[bed](ctx, gain);
    const sources = Array.isArray(built) ? built : built.sources;
    const layer: Layer = {
      gain,
      level: 0,
      retune: Array.isArray(built) ? undefined : built.retune,
      stop: () => {
        sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            // Already stopped.
          }
        });
        gain.disconnect();
      },
    };
    this.layers.set(bed, layer);
    return layer;
  }

  private scheduleCall(call: Call, first: boolean) {
    const range = this.scene && callEvery(call, this.scene);
    if (!range) {
      this.callTimers.delete(call);
      return;
    }
    // The first call comes sooner, so a new scene is heard straight away.
    const seconds = first ? between(range[0] * 0.2, range[0]) : between(range[0], range[1]);
    this.callTimers.set(
      call,
      window.setTimeout(() => {
        if (this.scene && callEvery(call, this.scene)) PLAY[call]();
        this.scheduleCall(call, false);
      }, seconds * 1000),
    );
  }

  // Thunder follows each lightning flash after a delay that depends on how far away it struck.
  private scheduleThunder() {
    if (this.thunderTimer !== null) clearTimeout(this.thunderTimer);
    this.thunderTimer = null;
    const since = this.stormSince;
    if (since === null) return;

    const firstFlash = since + LIGHTNING.delayMs + LIGHTNING.flashAt * LIGHTNING.cycleMs;
    const now = performance.now();
    const next = now <= firstFlash ? firstFlash : firstFlash + Math.ceil((now - firstFlash) / LIGHTNING.cycleMs) * LIGHTNING.cycleMs;
    const distance = between(0.15, 0.85);
    const delay = 300 + distance * 2500; // sound travels ~1 km in 3 s
    this.thunderTimer = window.setTimeout(() => {
      if (this.stormSince === since) sfx.thunder({distance});
      this.scheduleThunder();
    }, next - now + delay);
  }
}

export const soundscape = new Soundscape();
