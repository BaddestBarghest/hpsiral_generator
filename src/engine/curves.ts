/**
 * Looping curves for beat loops (see modulation.ts). A curve runs over one cycle
 * (f = 0..1): 0 at both ends, 1 at its peak. It is written as a function of the distance from
 * the peak (d = 0 at the peak, 1 at the ends); `peak` then moves the peak within the cycle by
 * stretching the rising half and squeezing the falling one (or the other way round), which
 * leaves the mean unchanged.
 */

export const CURVE_SHAPES = [
  { value: 'smooth', label: 'Smooth (sine)' },
  { value: 'linear', label: 'Linear' },
  { value: 'parabolic', label: 'Parabolic' },
  { value: 'gaussian', label: 'Gaussian (bell)' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'pulse', label: 'Pulse (on and off)' },
] as const;

export type CurveShape = (typeof CURVE_SHAPES)[number]['value'];

/** Shapes with a sharpness setting. */
export const SHARP_SHAPES: readonly CurveShape[] = ['gaussian', 'exponential', 'pulse'];

export interface Curve {
  shape: CurveShape;
  /** 0..1: higher = a shorter, sharper peak (gaussian and exponential only). */
  sharpness: number;
  /** Where in the cycle the peak falls, 0..1 (exclusive). */
  peak: number;
}

/** Shape at distance `d` (0..1) from the peak. */
function shapeAt(shape: CurveShape, sharpness: number, d: number): number {
  switch (shape) {
    case 'linear':
      return 1 - d;
    case 'parabolic':
      return 1 - d * d;
    case 'gaussian': {
      // Bell curve, shifted and scaled so it reaches exactly 0 at the ends.
      const w = 0.6 - 0.48 * sharpness;
      const edge = Math.exp(-1 / (2 * w * w));
      return (Math.exp(-(d * d) / (2 * w * w)) - edge) / (1 - edge);
    }
    case 'exponential': {
      // Rises (and falls) exponentially: a slow build to a sharp peak.
      const k = 1 + 11 * sharpness;
      return Math.expm1(k * (1 - d)) / Math.expm1(k);
    }
    case 'pulse': {
      // Holds at 1, then snaps to 0 and holds: a square wave with short smooth edges (so it
      // doesn't flicker). Sharpness shortens the "on" part.
      const edge = 0.08;
      const on = 0.7 - 0.6 * sharpness;
      const t = Math.min(1, Math.max(0, (d - (on - edge)) / (2 * edge)));
      return 1 - t * t * (3 - 2 * t);
    }
    default: // smooth
      return 0.5 + 0.5 * Math.cos(Math.PI * d);
  }
}

/** Position in the symmetric cycle (peak at 0.5) for position `f` in the real cycle (peak at `c`). */
const unwarp = (f: number, c: number) => (f <= c ? f / (2 * c) : 0.5 + (f - c) / (2 * (1 - c)));

/** The curve (0..1) at `x` cycles; any x, the curve repeats every cycle. */
export function curveAt(c: Curve, x: number): number {
  return shapeAt(c.shape, c.sharpness, Math.abs(2 * unwarp(x - Math.floor(x), c.peak) - 1));
}

// ── Integral ──────────────────────────────────────────────────────────────
// The symmetric shape sampled over one cycle, with its running integral. Integrating the
// straight lines between samples (rather than the formula) works for any shape, and still
// gives every step size the same total: `curveIntegral` is a fixed function of x.

interface ShapeTable {
  g: Float64Array;
  cum: Float64Array;
  /** Mean of the shape over a cycle (= the integral over one cycle). */
  mean: number;
}

const SAMPLES = 4096; // even, so the peak (0.5) falls on a sample
const tables = new Map<string, ShapeTable>();

function shapeTable(c: Curve): ShapeTable {
  const key = `${c.shape}:${c.sharpness}`;
  let t = tables.get(key);
  if (t) return t;
  const g = new Float64Array(SAMPLES + 1);
  const cum = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) g[i] = shapeAt(c.shape, c.sharpness, Math.abs((2 * i) / SAMPLES - 1));
  for (let i = 1; i <= SAMPLES; i++) cum[i] = cum[i - 1] + (g[i - 1] + g[i]) / (2 * SAMPLES);
  t = { g, cum, mean: cum[SAMPLES] };
  if (tables.size >= 32) tables.clear(); // dragging a slider makes many; keep only recent ones
  tables.set(key, t);
  return t;
}

/** ∫₀ᵘ shape over the symmetric cycle, for u in [0, 1]. */
function symmetricIntegral(t: ShapeTable, u: number): number {
  const pos = Math.min(SAMPLES, Math.max(0, u * SAMPLES));
  const i = Math.min(SAMPLES - 1, Math.floor(pos));
  const f = pos - i;
  return t.cum[i] + (t.g[i] * f + ((t.g[i + 1] - t.g[i]) * f * f) / 2) / SAMPLES;
}

/** Mean of the curve over a cycle. */
export const curveMean = (c: Curve) => shapeTable(c).mean;

/** ∫₀ˣ curve, x in cycles (any value). */
export function curveIntegral(c: Curve, x: number): number {
  const t = shapeTable(c);
  const whole = Math.floor(x);
  const f = x - whole;
  const p = c.peak;
  const half = symmetricIntegral(t, 0.5);
  const within = f <= p ? 2 * p * symmetricIntegral(t, unwarp(f, p)) : 2 * p * half + 2 * (1 - p) * (symmetricIntegral(t, unwarp(f, p)) - half);
  return whole * t.mean + within;
}
