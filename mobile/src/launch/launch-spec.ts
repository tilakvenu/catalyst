/**
 * Single source of truth for the C67.2 launch.
 * The overlay reads timings, easings, and geometry from here only.
 */

export const TOTAL_MS = 2400;
export const CEILING_MS = 2800;

export const MARK_SIZE = 72;
/** Bead radius inside the 64-unit mark, scaled to MARK_SIZE. 6.5 * 72/64. */
export const BEAD_RADIUS = 7.3125;
export const SPIRAL_R0 = MARK_SIZE * 2.4;
export const SPIRAL_TURNS = 1.5;
export const SPIRAL_DASH_FRACTION = 0.18;
export const SPIRAL_COUNT = 3;
export const SPIRAL_SEPARATION_DEG = 120;
export const SPIRAL_GROUP_ROTATE_DEG = 220;
export const SPIRAL_GROUP_SCALE_TO = BEAD_RADIUS / SPIRAL_R0;

export const PARTICLE_COUNT = 10;
export const PARTICLE_SEED = 6702;
export const PARTICLE_TURNS = 1.25;
export const PARTICLE_STAGGER_MS = 40;
export const PARTICLE_LIFE_MS = 600;
export const PARTICLE_SCALE_TO = 0.3;

export const WORDMARK = "CATALYST";
export const WORDMARK_OFFSET = 54;
export const WORDMARK_ENTER_Y = 6;

export const SHOCK_BASE = 36;
export const SHOCK_SCALE_TO = 14;
export const SHOCK_STROKE = 2;

export const REDUCED_HOLD_MS = 400;
export const REDUCED_FADE_MS = 150;

/** Z step-mark. Bead sits at (28, 34) in this 64-unit grid. */
export const MARK_PATH = "M6 52H28V44.5 M28 23.5V16H58";
export const MARK_VIEW = 64;
export const MARK_BEAD = { cx: 28, cy: 34, r: 6.5 };
/** Precomputed. Do not call getTotalLength() on native. */
export const MARK_PATH_LENGTH = 67;

export const EASE_SPIN = [0.16, 1, 0.3, 1] as const;
export const EASE_WORD = [0.33, 1, 0.68, 1] as const;
export const EASE_ACCEL = [0.55, 0, 1, 0.45] as const;
export const EASE_RELEASE = [0.7, 0, 0.3, 1] as const;
/** CSS ease-out. The table says "ease-out" for the shockwave. */
export const EASE_OUT = [0, 0, 0.58, 1] as const;

export type Ease = readonly [number, number, number, number] | "linear" | "spring";

export type LaunchRow = {
  t: number;
  element: string;
  what: string;
  duration: number;
  easing: Ease | null;
};

/** Every row of the A3 timing table. */
export const LAUNCH_ROWS: readonly LaunchRow[] = [
  { t: 0, element: "overlay", what: "solid black, everything hidden", duration: 0, easing: null },
  { t: 120, element: "markGroup", what: "SPIN IN rotate -540 to 0, scale 0.35 to 1, opacity 0 to 1", duration: 600, easing: EASE_SPIN },
  { t: 120, element: "markGhost", what: "same motion, lags 60ms, 30% opacity, fades out by 720", duration: 600, easing: EASE_SPIN },
  { t: 600, element: "bead", what: "scale 0 to 1.2 to 1, opacity 0 to 1", duration: 320, easing: "spring" },
  { t: 680, element: "wordmark", what: "opacity 0 to 1, translateY 6 to 0", duration: 300, easing: EASE_WORD },
  { t: 900, element: "spirals", what: "3 spiral strokes staggered 900/980/1060, dash outer to inner", duration: 700, easing: EASE_ACCEL },
  { t: 900, element: "spiralGroup", what: "rotate 0 to +220, scale tightens to the bead", duration: 800, easing: EASE_ACCEL },
  { t: 1000, element: "particles", what: "10 dots staggered 40ms, radius falls to the bead", duration: 600, easing: "linear" },
  { t: 1350, element: "markGroup", what: "COLLAPSE rotate 0 to +300, scale to 0, midpoint stretch", duration: 450, easing: EASE_ACCEL },
  { t: 1350, element: "wordmark", what: "pulled to bead center, scale to 0, opacity to 0", duration: 300, easing: EASE_ACCEL },
  { t: 1800, element: "bead", what: "SINGULARITY scale 1 to 0.25", duration: 80, easing: "linear" },
  { t: 1880, element: "bead", what: "RELEASE scale 0.25 to 40", duration: 400, easing: EASE_RELEASE },
  { t: 1880, element: "shockwave", what: "ring scale 1 to 14, opacity 0.8 to 0", duration: 320, easing: EASE_OUT },
  { t: 2180, element: "overlay", what: "fill shifts from accent to the theme background", duration: 120, easing: "linear" },
  { t: 2280, element: "overlay", what: "opacity 1 to 0", duration: 120, easing: "linear" },
  { t: 2400, element: "overlay", what: "unmount", duration: 0, easing: null },
];

/** Reanimated duration springs: wall time is about 1.5× the perceptual duration. 133+80 → ~320ms. */
export const BEAD_SPRING = {
  peakPerceptualMs: 133,
  settlePerceptualMs: 80,
  peakScale: 1.2,
  dampingRatio: 0.7,
};

export const MARK_SPIN = { t: 120, duration: 600, rotateFrom: -540, rotateTo: 0, scaleFrom: 0.35, scaleTo: 1 };
export const GHOST_LAG_MS = 60;
export const GHOST_OPACITY = 0.3;
export const GHOST_FADE_OUT_AT = 720;
export const COLLAPSE = { t: 1350, duration: 450, rotateTo: 300, stretchX: 1.35, stretchY: 0.6 };
export const SPIRAL_STARTS = [900, 980, 1060] as const;
export const SINGULARITY = { t: 1800, duration: 80, scale: 0.25 };
export const RELEASE = { t: 1880, duration: 400, scale: 40 };
export const FILL_SHIFT = { t: 2180, duration: 120 };
export const FADE_OUT = { t: 2280, duration: 120 };

export function launchLayers(reduced: boolean) {
  if (reduced) {
    return { spin: false, spiral: false, particle: false, collapse: false, burst: false, shockwave: false, staticMark: true };
  }
  return { spin: true, spiral: true, particle: true, collapse: true, burst: true, shockwave: true, staticMark: false };
}

export function shouldSkipForWebdriver(input: { platform: string; webdriver: boolean; launchParam: boolean }): boolean {
  return input.platform === "web" && input.webdriver && !input.launchParam;
}

function bezierComponent(c1: number, c2: number, t: number): number {
  "worklet";
  const u = 1 - t;
  return 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t;
}

function bezierDerivative(c1: number, c2: number, t: number): number {
  "worklet";
  const u = 1 - t;
  return 3 * u * u * c1 + 6 * u * t * (c2 - c1) + 3 * t * t * (1 - c2);
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  "worklet";
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = bezierComponent(x1, x2, t) - x;
    const d = bezierDerivative(x1, x2, t);
    if (Math.abs(d) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - dx / d));
  }
  return bezierComponent(y1, y2, t);
}

export function applyEase(easing: Ease | null, u: number): number {
  "worklet";
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (!easing || easing === "linear" || easing === "spring") return u;
  return cubicBezier(easing[0], easing[1], easing[2], easing[3], u);
}

export function pathLength(d: string): number {
  const tokens = d.match(/[MmHhVvLlZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) return 0;
  let i = 0;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let len = 0;
  let cmd = "M";
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[MmHhVvLlZz]$/.test(tok)) {
      cmd = tok;
      i++;
      if (cmd === "Z" || cmd === "z") {
        len += Math.hypot(sx - x, sy - y);
        x = sx;
        y = sy;
      }
      continue;
    }
    if (cmd === "M" || cmd === "L") {
      const nx = num();
      const ny = num();
      if (cmd === "L") len += Math.hypot(nx - x, ny - y);
      else {
        sx = nx;
        sy = ny;
      }
      x = nx;
      y = ny;
      if (cmd === "M") cmd = "L";
    } else if (cmd === "H") {
      const nx = num();
      len += Math.abs(nx - x);
      x = nx;
    } else if (cmd === "V") {
      const ny = num();
      len += Math.abs(ny - y);
      y = ny;
    } else if (cmd === "m" || cmd === "l") {
      const nx = x + num();
      const ny = y + num();
      if (cmd === "l") len += Math.hypot(nx - x, ny - y);
      else {
        sx = nx;
        sy = ny;
      }
      x = nx;
      y = ny;
      if (cmd === "m") cmd = "l";
    } else {
      break;
    }
  }
  return Math.round(len * 1000) / 1000;
}

function spiralPath(rotDeg: number): string {
  const steps = 96;
  const thetaMax = SPIRAL_TURNS * Math.PI * 2;
  const rot = (rotDeg * Math.PI) / 180;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const theta = u * thetaMax;
    const r = SPIRAL_R0 + (BEAD_RADIUS - SPIRAL_R0) * u;
    const a = theta + rot;
    const x = (r * Math.cos(a)).toFixed(2);
    const y = (r * Math.sin(a)).toFixed(2);
    d += i === 0 ? `M${x} ${y}` : `L${x} ${y}`;
  }
  return d;
}

export const SPIRAL_PATHS = [0, 120, 240].map((deg) => spiralPath(deg));
export const SPIRAL_PATH_LENGTH = pathLength(SPIRAL_PATHS[0]);

function hashUnit(index: number): number {
  let x = (PARTICLE_SEED + index * 9973) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967295;
}

export function particleStart(index: number): { r0: number; angle0: number } {
  const radiusUnit = hashUnit(index);
  const angleUnit = hashUnit(index + 100);
  return {
    r0: MARK_SIZE * (1.6 + 0.8 * radiusUnit),
    angle0: angleUnit * Math.PI * 2,
  };
}

export function particleRadius(r0: number, p: number): number {
  "worklet";
  return r0 * (1 - p) + BEAD_RADIUS * p;
}

export function particleAngle(angle0: number, p: number): number {
  "worklet";
  return angle0 + PARTICLE_TURNS * Math.PI * 2 * p;
}

export function particleProgress(elapsedMs: number, index: number): number {
  "worklet";
  const local = elapsedMs - index * PARTICLE_STAGGER_MS;
  if (local <= 0) return 0;
  if (local >= PARTICLE_LIFE_MS) return 1;
  return local / PARTICLE_LIFE_MS;
}

const PARTICLE_STARTS = Array.from({ length: PARTICLE_COUNT }, (_, i) => particleStart(i));

function clamp01(v: number): number {
  "worklet";
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, u: number): number {
  "worklet";
  return a + (b - a) * u;
}

function span(t: number, start: number, duration: number, easing: Ease | null): number {
  "worklet";
  if (t < start) return 0;
  if (duration <= 0) return 1;
  return applyEase(easing, clamp01((t - start) / duration));
}

export type FramePose = {
  overlay: "black" | "accent" | "theme";
  overlayOpacity: number;
  mark: { opacity: number; rotate: number; scaleX: number; scaleY: number };
  ghost: { opacity: number; rotate: number; scale: number };
  bead: { opacity: number; scale: number };
  word: { opacity: number; translateY: number; scale: number };
  spiralGroup: { rotate: number; scale: number };
  spirals: { opacity: number; dash: number }[];
  particles: { opacity: number; x: number; y: number; scale: number }[];
  shock: { opacity: number; scale: number };
};

export function framePose(t: number): FramePose {
  "worklet";
  const spin = span(t, MARK_SPIN.t, MARK_SPIN.duration, EASE_SPIN);
  let markRot = lerp(MARK_SPIN.rotateFrom, MARK_SPIN.rotateTo, spin);
  let markSX = lerp(MARK_SPIN.scaleFrom, MARK_SPIN.scaleTo, spin);
  let markSY = markSX;
  let markOp = t < MARK_SPIN.t ? 0 : spin;

  if (t >= COLLAPSE.t) {
    const c = span(t, COLLAPSE.t, COLLAPSE.duration, EASE_ACCEL);
    markRot = lerp(0, COLLAPSE.rotateTo, c);
    if (c < 0.5) {
      const k = c / 0.5;
      markSX = lerp(1, COLLAPSE.stretchX, k);
      markSY = lerp(1, COLLAPSE.stretchY, k);
      markOp = 1;
    } else {
      const k = (c - 0.5) / 0.5;
      markSX = lerp(COLLAPSE.stretchX, 0, k);
      markSY = lerp(COLLAPSE.stretchY, 0, k);
      markOp = 1 - k;
    }
  }

  const ghostStart = MARK_SPIN.t + GHOST_LAG_MS;
  const ghostU = span(t, ghostStart, MARK_SPIN.duration, EASE_SPIN);
  let ghostOp = 0;
  if (t >= ghostStart && t < GHOST_FADE_OUT_AT) {
    const life = (t - ghostStart) / (GHOST_FADE_OUT_AT - ghostStart);
    ghostOp = life < 0.35 ? GHOST_OPACITY * (life / 0.35) : GHOST_OPACITY * (1 - (life - 0.35) / 0.65);
  }

  let beadScale = 0;
  let beadOp = 0;
  if (t >= 600) {
    beadOp = span(t, 600, 320, "linear");
    if (t < 920) {
      const u = clamp01((t - 600) / 320);
      beadScale = u < 0.62 ? lerp(0, BEAD_SPRING.peakScale, applyEase(EASE_OUT, u / 0.62)) : lerp(BEAD_SPRING.peakScale, 1, (u - 0.62) / 0.38);
    } else if (t < SINGULARITY.t) {
      beadScale = 1;
      beadOp = 1;
    } else if (t < RELEASE.t) {
      beadScale = lerp(1, SINGULARITY.scale, span(t, SINGULARITY.t, SINGULARITY.duration, "linear"));
      beadOp = 1;
    } else {
      beadScale = lerp(SINGULARITY.scale, RELEASE.scale, span(t, RELEASE.t, RELEASE.duration, EASE_RELEASE));
      beadOp = 1;
    }
  }

  const wordIn = span(t, 680, 300, EASE_WORD);
  const wordPull = span(t, 1350, 300, EASE_ACCEL);
  const wordY = t < 1350 ? lerp(WORDMARK_OFFSET + WORDMARK_ENTER_Y, WORDMARK_OFFSET, wordIn) : lerp(WORDMARK_OFFSET, 0, wordPull);
  const wordScale = t < 1350 ? 1 : 1 - wordPull;
  const wordOp = t < 1350 ? (t < 680 ? 0 : wordIn) : 1 - wordPull;

  const groupU = span(t, 900, 800, EASE_ACCEL);
  const spirals = SPIRAL_STARTS.map((start) => {
    const u = span(t, start, 700, EASE_ACCEL);
    const op = u <= 0 ? 0 : u < 0.28 ? 0.9 * (u / 0.28) : 0.9 * (1 - (u - 0.28) / 0.72);
    return { opacity: Math.max(0, op), dash: u };
  });

  const particleElapsed = Math.max(0, t - 1000);
  const particles = PARTICLE_STARTS.map((start, index) => {
    const p = particleProgress(particleElapsed, index);
    const born = particleElapsed >= index * PARTICLE_STAGGER_MS;
    const r = particleRadius(start.r0, p);
    const a = particleAngle(start.angle0, p);
    const fade = !born ? 0 : Math.min(p / 0.18, (1 - p) / 0.22, 1);
    return {
      opacity: Math.max(0, fade),
      x: r * Math.cos(a),
      y: r * Math.sin(a),
      scale: lerp(1, PARTICLE_SCALE_TO, p),
    };
  });

  const shockU = span(t, 1880, 320, EASE_OUT);
  const shock = {
    opacity: t < 1880 || t > 2200 ? 0 : lerp(0.8, 0, shockU),
    scale: t < 1880 ? 1 : lerp(1, SHOCK_SCALE_TO, shockU),
  };

  let overlay: FramePose["overlay"] = "black";
  if (t >= FILL_SHIFT.t) overlay = t >= FILL_SHIFT.t + FILL_SHIFT.duration ? "theme" : "accent";
  else if (t >= RELEASE.t) overlay = "accent";

  const overlayOpacity = t < FADE_OUT.t ? 1 : 1 - span(t, FADE_OUT.t, FADE_OUT.duration, "linear");

  return {
    overlay,
    overlayOpacity,
    mark: { opacity: markOp, rotate: markRot, scaleX: markSX, scaleY: markSY },
    ghost: { opacity: ghostOp, rotate: lerp(MARK_SPIN.rotateFrom, 0, ghostU), scale: lerp(MARK_SPIN.scaleFrom, 1, ghostU) },
    bead: { opacity: beadOp, scale: beadScale },
    word: { opacity: wordOp, translateY: wordY, scale: wordScale },
    spiralGroup: { rotate: lerp(0, SPIRAL_GROUP_ROTATE_DEG, groupU), scale: lerp(1, SPIRAL_GROUP_SCALE_TO, groupU) },
    spirals,
    particles,
    shock,
  };
}
