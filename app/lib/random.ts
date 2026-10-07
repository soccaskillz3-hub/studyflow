// Deterministic pseudo-random in [0, 1) for drawing scenes, so they're identical on server
// and client. Rounded so tiny floating-point differences between JS engines can't cause
// hydration mismatches. `i` picks the item, `n` picks which property of it.
export function rand(i: number, n: number) {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
}

// Ordinary randomness for things that only happen in the browser (animal visits, bird calls).
export const between = (min: number, max: number) => min + Math.random() * (max - min);
export const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
