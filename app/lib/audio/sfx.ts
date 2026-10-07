import {audio, noiseSource, type Bus} from "./engine";
import {between, pick} from "../random";

// One-shot synthesized sounds: animal calls, footsteps, thunder and the app's chimes.
// Each is silent unless audio is unlocked and enabled. `pan` runs from -1 (left) to 1 (right).

type Voice = {ctx: AudioContext; input: GainNode; at: number};

// A gain → panner → bus chain (plus a reverb send) to play one sound through. `wet` is how much
// room the sound gets: distant calls are wetter.
function voice(bus: Bus, {pan = 0, gain = 1, wet = 0.3, delay = 0} = {}): Voice | null {
  const ctx = audio.context;
  const out = audio.bus(bus);
  if (!ctx || !out || !audio.running) return null;
  const input = ctx.createGain();
  input.gain.value = gain;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  input.connect(panner).connect(out);
  const reverb = audio.reverb();
  if (reverb && wet > 0) {
    const send = ctx.createGain();
    send.gain.value = wet;
    panner.connect(send).connect(reverb);
  }
  // Let the graph be collected once the sound is long over.
  setTimeout(() => input.disconnect(), (delay + 15) * 1000);
  return {ctx, input, at: ctx.currentTime + 0.02 + delay};
}

// An oscillator note with a quick attack and exponential release, into `dest`.
function tone(
  ctx: AudioContext,
  dest: AudioNode,
  {at, length, volume, type = "sine", freq, attack = 0.01}: {at: number; length: number; volume: number; type?: OscillatorType; freq: number; attack?: number},
) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(volume, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(dest);
  osc.start(at);
  osc.stop(at + length + 0.05);
  return osc;
}

// A short burst of filtered noise: footsteps, knocks and the crack of thunder.
function burst(
  ctx: AudioContext,
  dest: AudioNode,
  {at, length, volume, freq, q = 1, type = "bandpass", color = "white"}: {at: number; length: number; volume: number; freq: number; q?: number; type?: BiquadFilterType; color?: "white" | "pink" | "brown"},
) {
  const src = ctx.createBufferSource();
  src.buffer = audio.noise(color);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(volume, at + Math.min(0.006, length / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(filter).connect(env).connect(dest);
  src.start(at, Math.random() * 7, length + 0.05);
}

// ---------- Birds ----------

type Song = (ctx: AudioContext, dest: AudioNode, at: number, pitch: number) => number; // returns length

// Quick rising "tweet"s.
const tweets: Song = (ctx, dest, at, pitch) => {
  const count = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const t = at + i * between(0.11, 0.16);
    const osc = tone(ctx, dest, {at: t, length: 0.09, volume: 0.32, freq: 2800 * pitch, attack: 0.008});
    osc.frequency.exponentialRampToValueAtTime(4300 * pitch, t + 0.07);
  }
  return count * 0.15;
};

// A clear two-note "fee-bee" whistle.
const whistle: Song = (ctx, dest, at, pitch) => {
  const a = tone(ctx, dest, {at, length: 0.36, volume: 0.24, freq: 3950 * pitch, attack: 0.04});
  a.frequency.linearRampToValueAtTime(3850 * pitch, at + 0.3);
  const b = tone(ctx, dest, {at: at + 0.42, length: 0.4, volume: 0.2, freq: 3350 * pitch, attack: 0.04});
  b.frequency.linearRampToValueAtTime(3250 * pitch, at + 0.78);
  return 0.85;
};

// A fast warbling trill.
const trill: Song = (ctx, dest, at, pitch) => {
  const length = between(0.5, 0.9);
  const osc = tone(ctx, dest, {at, length, volume: 0.2, freq: 3600 * pitch, attack: 0.05});
  const wobble = ctx.createOscillator();
  wobble.frequency.value = between(28, 40);
  const depth = ctx.createGain();
  depth.gain.value = 420 * pitch;
  wobble.connect(depth).connect(osc.frequency);
  wobble.start(at);
  wobble.stop(at + length + 0.05);
  return length;
};

// A robin-like phrase of varied syllables.
const warble: Song = (ctx, dest, at, pitch) => {
  const syllables = 4 + Math.floor(Math.random() * 5);
  let t = at;
  for (let i = 0; i < syllables; i++) {
    const length = between(0.08, 0.16);
    const from = between(2200, 3800) * pitch;
    const osc = tone(ctx, dest, {at: t, length, volume: 0.22, freq: from, attack: 0.015});
    osc.frequency.linearRampToValueAtTime(from * between(0.8, 1.3), t + length * 0.8);
    t += length + between(0.03, 0.09);
  }
  return t - at;
};

const SONGS = [tweets, whistle, trill, warble];

// One bird calling. Distant birds are quieter and wetter.
export function birdCall({pan = between(-0.8, 0.8), distance = 0.5, delay = 0} = {}) {
  const v = voice("wildlife", {pan, gain: 0.7 * (1 - distance * 0.6), wet: 0.15 + distance * 0.45, delay});
  if (!v) return;
  // Distant calls lose their high end.
  const muffle = v.ctx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 9000 - distance * 4500;
  muffle.connect(v.input);
  pick(SONGS)(v.ctx, muffle, v.at, between(0.9, 1.15));
}

// A small flock passing over, calling as it goes from one side to the other.
export function flockPass(seconds: number, fromLeft: boolean) {
  const calls = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < calls; i++) {
    const progress = (i + Math.random() * 0.6) / calls;
    const pan = (fromLeft ? -1 : 1) * (1 - progress * 2) * 0.8;
    birdCall({pan, distance: 0.25, delay: progress * seconds * 0.85});
  }
}

// ---------- Forest animals ----------

// "Hoo, hoo-hoo, hoooo": a great horned owl's rhythm.
export function owlHoot({pan = 0, distance = 0.2, delay = 0} = {}) {
  const v = voice("wildlife", {pan, gain: 0.6 * (1 - distance * 0.6), wet: 0.35 + distance * 0.4, delay});
  if (!v) return;
  const {ctx, input, at} = v;
  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 900;
  soften.connect(input);
  const base = between(330, 380);
  const pattern: [number, number][] = [[0, 0.42], [0.72, 0.2], [1.0, 0.22], [1.32, 0.75]];
  for (const [offset, length] of pattern) {
    const t = at + offset;
    for (const [mult, vol] of [[1, 0.5], [2, 0.06]] as const) {
      const osc = tone(ctx, soften, {at: t, length: length + 0.2, volume: vol, freq: base * mult * 1.03, attack: 0.07});
      osc.frequency.linearRampToValueAtTime(base * mult * 0.96, t + length);
    }
  }
}

// A woodpecker drumming on a distant trunk.
export function woodpecker({pan = between(-0.7, 0.7)} = {}) {
  const v = voice("wildlife", {pan, gain: 0.32, wet: 0.5});
  if (!v) return;
  const hits = 12 + Math.floor(Math.random() * 8);
  const rate = between(16, 22);
  for (let i = 0; i < hits; i++) {
    const t = v.at + i / rate;
    const fadeOut = 1 - (i / hits) * 0.6;
    burst(v.ctx, v.input, {at: t, length: 0.03, volume: 0.6 * fadeOut, freq: 1500, q: 4});
    tone(v.ctx, v.input, {at: t, length: 0.025, volume: 0.25 * fadeOut, freq: 700});
  }
}

// A chorus of frogs: a couple of croaky "ribbit"s.
export function frogs({pan = between(-0.8, 0.8)} = {}) {
  const v = voice("wildlife", {pan, gain: 0.32, wet: 0.35});
  if (!v) return;
  const throat = v.ctx.createBiquadFilter();
  throat.type = "bandpass";
  throat.frequency.value = between(700, 1000);
  throat.Q.value = 5;
  throat.connect(v.input);
  const calls = 1 + Math.floor(Math.random() * 3);
  for (let c = 0; c < calls; c++) {
    const start = v.at + c * between(0.55, 0.8);
    for (let p = 0; p < 2; p++) {
      for (let k = 0; k < 4; k++) {
        const t = start + p * 0.13 + k * 0.022;
        tone(v.ctx, throat, {at: t, length: 0.03, volume: 0.6, type: "sawtooth", freq: between(280, 320), attack: 0.004});
      }
    }
  }
}

// Footsteps in leaf litter, spread over `seconds`. Deer are heavier and slower than foxes.
export function footsteps(kind: "deer" | "fox" | "rabbit", seconds: number, pan = 0) {
  const v = voice("wildlife", {pan, gain: kind === "deer" ? 0.5 : 0.32, wet: 0.2});
  if (!v) return;
  const step = kind === "deer" ? 0.36 : kind === "fox" ? 0.2 : 0.55;
  for (let t = 0; t < seconds; t += step * between(0.8, 1.25)) {
    const at = v.at + t;
    burst(v.ctx, v.input, {at, length: between(0.05, 0.1), volume: between(0.25, 0.55), freq: between(900, 2200), q: 0.8});
    if (kind === "deer") tone(v.ctx, v.input, {at, length: 0.06, volume: 0.18, freq: 80});
    if (kind === "rabbit") burst(v.ctx, v.input, {at: at + 0.05, length: 0.06, volume: 0.2, freq: 1400, q: 0.8});
    // Now and then a twig snaps underfoot.
    if (kind === "deer" && Math.random() < 0.06) burst(v.ctx, v.input, {at: at + 0.03, length: 0.025, volume: 0.7, freq: 3200, q: 2, type: "highpass"});
  }
}

// ---------- Weather ----------

// Thunder: a crack when close, then a long rolling rumble.
export function thunder({distance = between(0.2, 0.8), pan = between(-0.6, 0.6), delay = 0} = {}) {
  // Loud enough to roll over a downpour (a close strike lands ~6 dB above the rain, distant
  // ones less), and the master limiter catches anything more.
  const v = voice("ambience", {pan, gain: 0.95 - distance * 0.35, wet: 0, delay});
  if (!v) return;
  const {ctx, input, at} = v;
  if (distance < 0.45) burst(ctx, input, {at, length: 0.35, volume: 0.3, freq: 2500, q: 0.5, type: "highpass"});

  const length = between(4.5, 7);
  for (const [offset, volume] of [[0, 1], [between(0.4, 1.2), 0.7]] as const) {
    const src = noiseSource(ctx, "brown");
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900 - distance * 400, at + offset);
    filter.frequency.exponentialRampToValueAtTime(90, at + offset + length * 0.6);
    const env = ctx.createGain();
    const t = at + offset;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(volume, t + 0.12 + distance * 0.3);
    // Rolling: a few swells as the rumble dies away.
    let level = volume;
    for (let s = 1; s <= 4; s++) {
      level *= 0.6;
      env.gain.linearRampToValueAtTime(level * between(0.6, 1.4), t + (length * s) / 5);
    }
    env.gain.linearRampToValueAtTime(0.0001, t + length);
    src.connect(filter).connect(env).connect(input);
    src.stop(t + length + 0.1);
  }
}

// ---------- Ocean ----------

// A gull's "kyow, kyow, kow".
export function gull({pan = between(-0.8, 0.8)} = {}) {
  const v = voice("wildlife", {pan, gain: 0.22, wet: 0.45});
  if (!v) return;
  const throat = v.ctx.createBiquadFilter();
  throat.type = "bandpass";
  throat.frequency.value = 1700;
  throat.Q.value = 2.5;
  throat.connect(v.input);
  const calls = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < calls; i++) {
    const t = v.at + i * between(0.4, 0.55);
    const length = i === calls - 1 ? 0.45 : 0.32;
    const osc = tone(v.ctx, throat, {at: t, length, volume: 0.7 - i * 0.1, type: "sawtooth", freq: 1300, attack: 0.02});
    osc.frequency.linearRampToValueAtTime(2150, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(1050, t + length);
  }
}

// A foghorn far across the water.
export function foghorn() {
  const v = voice("wildlife", {pan: between(-0.4, 0.4), gain: 0.4, wet: 0.9});
  if (!v) return;
  const {ctx, input, at} = v;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380;
  filter.connect(input);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(0.5, at + 0.6);
  env.gain.setValueAtTime(0.5, at + 2.6);
  env.gain.linearRampToValueAtTime(0, at + 4.2);
  env.connect(filter);
  for (const freq of [92, 138, 184]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.connect(env);
    osc.start(at);
    osc.stop(at + 4.3);
  }
}

// A buoy bell rocking in the swell: inharmonic partials with a long ring.
export function buoyBell() {
  const v = voice("wildlife", {pan: between(-0.6, 0.6), gain: 0.14, wet: 0.7});
  if (!v) return;
  const strikes = 1 + Math.floor(Math.random() * 2);
  for (let s = 0; s < strikes; s++) {
    const t = v.at + s * between(1.6, 2.4);
    for (const [ratio, vol, length] of [[1, 0.5, 4], [2.4, 0.25, 2.5], [3.1, 0.18, 1.8], [4.6, 0.08, 1.2]] as const) {
      tone(v.ctx, v.input, {at: t, length, volume: vol, freq: 540 * ratio, attack: 0.004});
    }
  }
}

// ---------- Interface ----------

type Note = {freq: number; at: number; length: number; volume: number; type?: OscillatorType};

function notes(list: Note[]) {
  audio.unlock(); // these follow a click (or a timer the visitor started), so audio is allowed
  const v = voice("interface", {wet: 0});
  if (!v) return;
  for (const n of list) tone(v.ctx, v.input, {at: v.at + n.at, length: n.length, volume: n.volume, freq: n.freq, type: n.type, attack: 0.02});
}

// Soft two-note chime: focus time is up, or a break has ended.
export function chime() {
  notes([
    {freq: 660, at: 0, length: 0.9, volume: 0.5},
    {freq: 880, at: 0.22, length: 0.9, volume: 0.5},
  ]);
}

// Rising major arpeggio with a bell-like shimmer on top: a session marked done.
export function success() {
  const arpeggio = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes([
    ...arpeggio.map((freq, i) => ({freq, at: i * 0.09, length: 1.1, volume: 0.45, type: "triangle" as const})),
    {freq: 1046.5, at: 0.36, length: 1.8, volume: 0.28},
    {freq: 1568, at: 0.42, length: 1.6, volume: 0.17},
    {freq: 2093, at: 0.48, length: 1.4, volume: 0.11},
  ]);
}
