import {rand} from "../../lib/random";

// SVG path data for the forest theme, generated once from seeded randomness.
// The tree bands use a 1600×1000 viewBox anchored to the bottom of the screen; their
// "ground" is at y = 880, i.e. 120 units above the bottom edge.
//
// Every shape is drawn clockwise. Each band is one <path>, and with the default fill rule a
// shape drawn the other way round cuts a hole where it overlaps its neighbours.

const r = (n: number) => Math.round(n * 10) / 10;

type Shape = {d: string; snow: string};

function pine(x: number, base: number, h: number, w: number): Shape {
  const tiers = 4;
  let d = `M${r(x - w * 0.05)} ${base} v${r(-h * 0.14)} h${r(w * 0.1)} v${r(h * 0.14)} Z`;
  let snow = "";
  for (let i = 0; i < tiers; i++) {
    const top = base - h + i * h * 0.2;
    // The lowest tier reaches just below the ground, so no sky shows under the tree.
    const bottom = i === tiers - 1 ? base + 2 : top + h * 0.36;
    const half = (w / 2) * (0.4 + (0.6 * (i + 1)) / tiers);
    d += ` M${r(x)} ${r(top)} L${r(x + half)} ${r(bottom)} L${r(x - half)} ${r(bottom)} Z`;
    // Snow on the upper part of each tier, with a slightly ragged lower edge.
    const cw = half * 0.5;
    const ch = (bottom - top) * 0.42;
    snow += ` M${r(x)} ${r(top)} L${r(x + cw)} ${r(top + ch)} L${r(x + cw * 0.35)} ${r(top + ch * 0.82)} L${r(x - cw * 0.15)} ${r(top + ch * 1.04)} L${r(x - cw)} ${r(top + ch)} Z`;
  }
  return {d, snow};
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${r(cx - rx)} ${r(cy)} a${r(rx)} ${r(ry)} 0 1 1 ${r(rx * 2)} 0 a${r(rx)} ${r(ry)} 0 1 1 ${r(-rx * 2)} 0`;
const circle = (cx: number, cy: number, rad: number) => ellipse(cx, cy, rad, rad);

// Snow lying on top of a leafy clump.
const clumpSnow = (cx: number, cy: number, rad: number) => ellipse(cx, cy - rad * 0.5, rad * 0.62, rad * 0.3);

// A leafy mass: a core circle ringed by smaller ones, so the outline is bumpy rather than round.
function clump(cx: number, cy: number, rad: number, seed: number) {
  let d = circle(cx, cy, rad * 0.75);
  const ring = 7;
  for (let k = 0; k < ring; k++) {
    const angle = (k / ring) * Math.PI * 2 + rand(seed, k + 60) * 0.5;
    const dist = rad * (0.5 + rand(seed, k + 70) * 0.2);
    d += " " + circle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.8, rad * (0.38 + rand(seed, k + 80) * 0.14));
  }
  return d;
}

function broadleaf(x: number, base: number, h: number, w: number, seed: number): Shape {
  const tw = w * 0.07;
  let d = `M${r(x - tw)} ${base} L${r(x - tw * 0.55)} ${r(base - h * 0.62)} L${r(x + tw * 0.55)} ${r(base - h * 0.62)} L${r(x + tw)} ${base} Z`;
  // Two limbs reaching into the crown.
  d += ` M${r(x)} ${r(base - h * 0.45)} L${r(x - w * 0.22)} ${r(base - h * 0.7)} L${r(x - w * 0.19)} ${r(base - h * 0.72)} L${r(x + tw * 0.4)} ${r(base - h * 0.5)} Z`;
  d += ` M${r(x)} ${r(base - h * 0.5)} L${r(x + w * 0.2)} ${r(base - h * 0.76)} L${r(x + w * 0.23)} ${r(base - h * 0.74)} L${r(x + tw * 0.4)} ${r(base - h * 0.46)} Z`;
  const cy = base - h * 0.74;
  let snow = "";
  for (let k = 0; k < 5; k++) {
    const angle = (k / 5) * Math.PI * 2 + rand(seed, k) * 0.8;
    const dist = w * (0.14 + rand(seed, k + 10) * 0.1);
    const [px, py, pr] = [x + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.7, w * (0.17 + rand(seed, k + 20) * 0.06)];
    d += " " + clump(px, py, pr, seed * 7 + k);
    if (Math.sin(angle) < 0.2) snow += " " + clumpSnow(px, py, pr); // only clumps on the upper side catch snow
  }
  d += " " + clump(x, cy - h * 0.06, w * 0.24, seed * 7 + 9);
  snow += " " + clumpSnow(x, cy - h * 0.06, w * 0.24);
  return {d, snow};
}

type Band = {base: number; minH: number; maxH: number; minW: number; maxW: number; step: number; broadleaf: number; seed: number};

function band({base, minH, maxH, minW, maxW, step, broadleaf: share, seed}: Band): Shape {
  let d = `M-60 ${base - 4} H1660 V1000 H-60 Z`;
  let snow = "";
  let i = 0;
  for (let x = -40; x < 1660; x += step * (0.6 + rand(seed + i, 1) * 0.8)) {
    const h = minH + rand(seed + i, 2) * (maxH - minH);
    const w = minW + rand(seed + i, 3) * (maxW - minW);
    const jitter = rand(seed + i, 4) * 14;
    const tree = rand(seed + i, 5) < share ? broadleaf(x, base + jitter, h, w * 1.6, seed + i) : pine(x, base + jitter, h, w);
    d += " " + tree.d;
    snow += " " + tree.snow;
    i++;
  }
  return {d, snow};
}

// Far to near. Farther bands are paler (atmospheric haze) and their trees smaller.
export const TREE_BANDS = [
  band({base: 640, minH: 110, maxH: 200, minW: 46, maxW: 76, step: 38, broadleaf: 0.15, seed: 100}),
  band({base: 760, minH: 210, maxH: 330, minW: 78, maxW: 118, step: 82, broadleaf: 0.3, seed: 300}),
  band({base: 880, minH: 380, maxH: 580, minW: 120, maxW: 170, step: 190, broadleaf: 0.55, seed: 500}),
];

// Near trees framing each side, in a 400×1000 box anchored to that side: a big trunk and a
// thinner one behind, both rising into the canopy, plus a leafy limb an owl can perch on.
// The box is cropped to fit the screen, so limbs only show where there's room for all of them
// (see .sf-limb and LIMBS_FIT).
export const NEAR = {
  left: {
    trunks: [
      "M58 1000 C70 760 52 470 88 0 L176 0 C150 420 168 760 182 1000 Z",
      "M286 1000 C290 760 280 420 296 0 L326 0 C314 420 324 760 332 1000 Z",
    ].join(" "),
    limb: [
      "M150 505 C186 495 226 480 266 466 L268 471 C228 487 194 506 156 522 Z",
      "M240 482 C247 469 254 460 263 453 L266 457 C258 464 252 473 247 484 Z",
      clump(274, 464, 22, 900),
      clump(262, 448, 13, 901),
    ].join(" "),
    snow: ["M150 501 C186 491 226 476 266 462 L266 466 C226 480 186 495 150 505 Z", clumpSnow(274, 464, 22), clumpSnow(262, 448, 13)].join(" "),
  },
  right: {
    trunks: [
      "M228 1000 C238 760 216 460 244 0 L330 0 C312 420 330 760 346 1000 Z",
      "M70 1000 C74 760 62 420 80 0 L106 0 C96 420 106 760 112 1000 Z",
    ].join(" "),
    limb: [
      "M248 338 C216 324 178 311 139 301 L140 296 C180 305 220 315 250 322 Z",
      "M160 308 C156 297 150 288 143 282 L145 278 C154 284 161 293 166 306 Z",
      clump(130, 296, 22, 902),
      clump(142, 280, 13, 903),
    ].join(" "),
    snow: ["M250 318 C220 311 180 301 140 292 L140 296 C180 305 220 315 250 322 Z", clumpSnow(130, 296, 22), clumpSnow(142, 280, 13)].join(" "),
  },
};

// Where the owl's feet go on each limb, in that side's coordinates.
export const OWL_PERCH = {left: {x: 212, y: 489}, right: {x: 190, y: 310}};

// A limb reaches ~300 of the box's 400 units in from the edge; that much shows once the
// screen is at least 5:4 and wide enough for the box's 24vw to beat its 170px minimum.
export const LIMBS_FIT = "(min-aspect-ratio: 5/4) and (min-width: 720px)";

// Overhanging canopy along the top edge (1600×320 box anchored to the top), with gaps on the
// right where the light comes through.
export const CANOPY = (() => {
  let d = "M-40 -40 H1640 V30 H-40 Z";
  let i = 0;
  for (let x = -40; x < 1660; x += 60 + rand(i, 30) * 60) {
    const gap = x > 950 && x < 1450 ? 0.55 : 0.1;
    if (rand(i, 31) > gap) {
      const rad = 45 + rand(i, 32) * 70;
      d += " " + clump(x, 20 + rand(i, 33) * 60, rad, 200 + i);
      if (rand(i, 34) > 0.55) d += " " + clump(x + rad * 0.7, 70 + rand(i, 35) * 70, rad * 0.5, 400 + i);
    }
    i++;
  }
  return d;
})();

// Ferns and grass along the bottom (1600×200 box anchored to the bottom), split into two groups
// so they can sway out of step.
function frond(x: number, base: number, h: number, lean: number) {
  const tip = x + lean;
  let d = `M${r(x - 2)} ${base} Q${r(x + lean * 0.4)} ${r(base - h * 0.6)} ${r(tip)} ${r(base - h)} Q${r(x + lean * 0.4 + 3)} ${r(base - h * 0.6)} ${r(x + 2)} ${base} Z`;
  for (let k = 1; k < 7; k++) {
    const t = k / 7;
    const px = x + lean * t * t;
    const py = base - h * t;
    const len = (1 - t) * h * 0.32 + 6;
    // Leaflets: out along the lower edge, back along the upper one (clockwise on both sides).
    d += ` M${r(px)} ${r(py)} l0 ${r(len * 0.12)} q${r(-len * 0.45)} ${r(len * 0.05)} ${r(-len)} ${r(len * 0.23)} q${r(len * 0.5)} ${r(-len * 0.3)} ${r(len)} ${r(-len * 0.35)} Z`;
    d += ` M${r(px)} ${r(py)} q${r(len * 0.4)} ${r(-len * 0.05)} ${r(len)} ${r(len * 0.35)} q${r(-len * 0.5)} ${r(-len * 0.02)} ${r(-len)} ${r(-len * 0.23)} Z`;
  }
  return d;
}

function grass(x: number, base: number, h: number) {
  let d = "";
  for (let k = 0; k < 5; k++) {
    const bx = x + k * 5;
    const lean = (k - 2) * 7;
    d += ` M${bx} ${base} Q${r(bx + lean * 0.3)} ${r(base - h * 0.6)} ${r(bx + lean)} ${r(base - h * (0.7 + (k % 2) * 0.3))} Q${r(bx + lean * 0.3 + 3)} ${r(base - h * 0.5)} ${bx + 4} ${base} Z`;
  }
  return d;
}

export const UNDERGROWTH = [0, 1].map((group) => {
  let d = group === 0 ? "M-40 186 H1640 V240 H-40 Z" : "";
  let i = 0;
  for (let x = -20 + group * 40; x < 1640; x += 80 + rand(i + group * 50, 50) * 90) {
    const seed = i + group * 50;
    const h = 50 + rand(seed, 51) * 90;
    // Keep the middle low so the bottom of the page stays readable.
    const middle = x > 420 && x < 1180;
    const height = middle ? h * 0.45 : h;
    d += rand(seed, 52) < 0.55 ? frond(x, 196, height, (rand(seed, 53) - 0.5) * 70) : grass(x, 196, height * 0.7);
    i++;
  }
  return d;
});
