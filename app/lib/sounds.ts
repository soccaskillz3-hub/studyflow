// Small synthesized sounds (Web Audio), so there are no audio files to ship.
// Best effort: silent if the browser blocks or lacks audio.

type Note = {freq: number; at: number; length: number; volume: number; type?: OscillatorType};

function play(notes: Note[]) {
  try {
    const ctx = new AudioContext();
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + n.at;
      osc.type = n.type ?? "sine";
      osc.frequency.value = n.freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(n.volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + n.length + 0.05);
    }
    const end = Math.max(...notes.map((n) => n.at + n.length));
    setTimeout(() => ctx.close(), (end + 0.5) * 1000);
  } catch {
    // No audio available.
  }
}

// Soft two-note chime: focus time is up, or a break has ended.
export function chime() {
  play([
    {freq: 660, at: 0, length: 0.9, volume: 0.18},
    {freq: 880, at: 0.22, length: 0.9, volume: 0.18},
  ]);
}

// Rising major arpeggio with a bell-like shimmer on top: a session marked done.
export function success() {
  const arpeggio = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  play([
    ...arpeggio.map((freq, i) => ({freq, at: i * 0.09, length: 1.1, volume: 0.16, type: "triangle" as const})),
    {freq: 1046.5, at: 0.36, length: 1.8, volume: 0.1},
    {freq: 1568, at: 0.42, length: 1.6, volume: 0.06},
    {freq: 2093, at: 0.48, length: 1.4, volume: 0.04},
  ]);
}
