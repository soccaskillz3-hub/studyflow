// The app's single Web Audio graph. Every sound is synthesized, so there are no audio files.
//
//   sources → bus (ambience | wildlife | interface) → master → compressor → speakers
//                         wildlife also → reverb ↗
//
// Browsers only allow audio after the visitor interacts with the page, so nothing is created
// until unlock() is called from a click or key press.

export type Bus = "ambience" | "wildlife" | "interface";
export type NoiseColor = "white" | "pink" | "brown";

export type SoundSettings = {
  enabled: boolean;
  master: number; // 0–1, as shown on the sliders
  ambience: number;
  wildlife: number;
  interface: number;
};

export const DEFAULT_SOUND: SoundSettings = {enabled: true, master: 0.5, ambience: 0.4, wildlife: 0.5, interface: 0.6};

// Sliders are linear but hearing isn't; squaring makes each step sound like an even change.
const loudness = (v: number) => Math.min(1, Math.max(0, v)) ** 2;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<Bus, GainNode>> = {};
  private reverbIn: GainNode | null = null;
  private noises: Partial<Record<NoiseColor, AudioBuffer>> = {};
  private settings: SoundSettings = DEFAULT_SOUND;
  private listeners = new Set<() => void>();

  get context() {
    return this.ctx;
  }

  // True once audio is actually playing (unlocked, enabled and not suspended).
  get running() {
    return this.ctx?.state === "running" && this.settings.enabled;
  }

  // Call from a user gesture. Safe to call repeatedly.
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext({latencyHint: "playback"});
      } catch {
        return; // No Web Audio: stay silent.
      }
      this.build(this.ctx);
    }
    if (this.settings.enabled && this.ctx.state === "suspended") {
      this.ctx.resume().then(() => this.notify(), () => {});
    } else {
      this.notify();
    }
  }

  // Runs `fn` whenever audio becomes available or resumes, so long-running sounds can start.
  onReady(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  configure(settings: SoundSettings) {
    const wasEnabled = this.settings.enabled;
    this.settings = settings;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;

    const now = ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.enabled ? loudness(settings.master) : 0, now, 0.12);
    (["ambience", "wildlife", "interface"] as const).forEach((bus) =>
      this.buses[bus]?.gain.setTargetAtTime(loudness(settings[bus]), now, 0.12),
    );

    // Suspend entirely while muted so the synthesized ambience costs no CPU.
    if (!settings.enabled && wasEnabled) {
      setTimeout(() => {
        if (!this.settings.enabled) ctx.suspend().catch(() => {});
      }, 600);
    } else if (settings.enabled && ctx.state === "suspended") {
      ctx.resume().then(() => this.notify(), () => {});
    }
  }

  // Where a sound on `bus` should connect to. Null until unlocked.
  bus(bus: Bus): AudioNode | null {
    return this.buses[bus] ?? null;
  }

  // Extra input that adds room reverb; connect a quiet copy of a sound here.
  reverb(): AudioNode | null {
    return this.reverbIn;
  }

  // Eight seconds of stereo noise (left and right independent, so beds sound wide), made once.
  noise(color: NoiseColor): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const cached = this.noises[color];
    if (cached) return cached;

    const length = ctx.sampleRate * 8;
    const fade = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      // Generate a little past the end, then blend that overflow into the start: the last
      // sample then runs straight on into the first, so the loop point can't click.
      const raw = new Float32Array(length + fade);
      let b0 = 0, b1 = 0, b2 = 0, last = 0, peak = 0;
      for (let i = 0; i < raw.length; i++) {
        const white = Math.random() * 2 - 1;
        let v = white;
        if (color === "pink") {
          // Paul Kellet's economy pink-noise filter.
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.963 * b1 + white * 0.2965164;
          b2 = 0.57 * b2 + white * 1.0526913;
          v = b0 + b1 + b2 + white * 0.1848;
        } else if (color === "brown") {
          last = (last + 0.02 * white) / 1.02;
          v = last;
        }
        raw[i] = v;
        peak = Math.max(peak, Math.abs(v));
      }
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i < fade ? i / fade : 1;
        data[i] = ((raw[i] * t + (i < fade ? raw[length + i] * (1 - t) : 0)) / peak) * 0.9;
      }
    }
    this.noises[color] = buffer;
    return buffer;
  }

  private build(ctx: AudioContext) {
    // A gentle compressor evens out the mix; a fast limiter after it stops any sudden peak
    // (thunder, a close call) from ever jumping out much above the rest.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.3;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    compressor.connect(limiter).connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(compressor);

    for (const name of ["ambience", "wildlife", "interface"] as const) {
      const gain = ctx.createGain();
      gain.connect(this.master);
      this.buses[name] = gain;
    }

    // A soft outdoor reverb: two and a half seconds of decaying noise, darker as it fades.
    const seconds = 2.5;
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const white = Math.random() * 2 - 1;
        smooth += (white - smooth) * (0.9 - t * 0.7); // low-pass that closes over time
        data[i] = smooth * (1 - t) ** 3.2;
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(convolver).connect(wet).connect(this.buses.wildlife!);

    this.configure(this.settings);
  }
}

export const audio = new AudioEngine();

// A looping noise source starting at a random point, so layers sharing a buffer don't line up.
export function noiseSource(ctx: AudioContext, color: NoiseColor) {
  const src = ctx.createBufferSource();
  src.buffer = audio.noise(color);
  src.loop = true;
  src.start(0, Math.random() * 7);
  return src;
}

// A slow sine wobble added onto `param` (which keeps its own base value): `depth` either way.
export function lfo(ctx: AudioContext, param: AudioParam, rate: number, depth: number) {
  const osc = ctx.createOscillator();
  osc.frequency.value = rate;
  const amount = ctx.createGain();
  amount.gain.value = depth;
  osc.connect(amount).connect(param);
  osc.start(ctx.currentTime + Math.random() * 0.1);
  return osc;
}
