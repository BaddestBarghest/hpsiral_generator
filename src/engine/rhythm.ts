import type { Settings } from '../settings/schema';

/**
 * Tempo-driven effects. Everything is a pure function of the beat position, so live
 * playback, offline renders and loops agree exactly.
 */

/** WCAG 2.3.1: no more than three flashes in any one-second period. */
export const MAX_SAFE_FLASHES_PER_SECOND = 3;

export const beatsPerSecond = (s: Settings) => s.bpm / 60;

// ── Speed ramp ────────────────────────────────────────────────────────────
// Multiplier m(x) = min + (max - min) * shape(x), x = ramp cycles (beats / rampBeats).
// Both shapes average 0.5, so the mean multiplier is (min + max) / 2.

/** ∫₀ˣ shape: smooth = 0.5 − 0.5·cos(2πx); linear = triangle 0 → 1 → 0. */
function shapeIntegral(shape: Settings['rampShape'], x: number): number {
  if (shape === 'linear') {
    const whole = Math.floor(x);
    const f = x - whole;
    return whole * 0.5 + (f < 0.5 ? f * f : 2 * f - f * f - 0.5);
  }
  return x / 2 - Math.sin(2 * Math.PI * x) / (4 * Math.PI);
}

export function rampMultiplier(s: Settings, beats: number): number {
  if (!s.rampEnabled) return 1;
  const x = beats / s.rampBeats;
  const f = x - Math.floor(x);
  const shape = s.rampShape === 'linear' ? 1 - Math.abs(2 * f - 1) : 0.5 - 0.5 * Math.cos(2 * Math.PI * f);
  return s.rampMin + (s.rampMax - s.rampMin) * shape;
}

export function rampMean(s: Settings): number {
  return s.rampEnabled ? (s.rampMin + s.rampMax) / 2 : 1;
}

/**
 * ∫ multiplier dt over a step of `dt` seconds that moved the beat position from
 * `beats0` to `beats1`. Exact (not a per-frame approximation), so the flow phase is
 * identical whatever the frame rate.
 */
export function rampIntegral(s: Settings, beats0: number, beats1: number, dt: number): number {
  if (!s.rampEnabled || dt === 0) return dt;
  const x0 = beats0 / s.rampBeats;
  const x1 = beats1 / s.rampBeats;
  const dx = x1 - x0;
  if (dx === 0) return dt * rampMultiplier(s, beats0);
  const meanShape = (shapeIntegral(s.rampShape, x1) - shapeIntegral(s.rampShape, x0)) / dx;
  return dt * (s.rampMin + (s.rampMax - s.rampMin) * meanShape);
}

// ── Pulses ────────────────────────────────────────────────────────────────

/**
 * Pulse period in beats, doubled until it flashes at most 3 times a second unless
 * the user unlocked faster flashing. Doubling keeps it on the beat grid.
 */
export function flashPeriodBeats(s: Settings, rateBeats: number): number {
  let p = rateBeats;
  if (!s.flashUnlock) while (beatsPerSecond(s) / p > MAX_SAFE_FLASHES_PER_SECOND) p *= 2;
  return p;
}

export interface Pulses {
  /** 0..1 mix towards the flash colour. */
  flash: number;
  /** 0..1 mix towards the inverted image. */
  invert: number;
  /** Zoom multiplier (≥ 1). */
  zoom: number;
}

const fract = (x: number) => x - Math.floor(x);

export function pulses(s: Settings, beats: number): Pulses {
  let flash = 0;
  if (s.flashMode !== 'off') {
    const u = fract(beats / flashPeriodBeats(s, Number(s.flashRate)));
    const env = s.flashMode === 'strobe' ? (u < s.flashLength ? 1 : 0) : Math.exp(-u / Math.max(0.3 * s.flashLength, 0.01));
    flash = env * s.flashIntensity;
  }
  let invert = 0;
  if (s.invertEnabled) {
    const u = fract(beats / flashPeriodBeats(s, Number(s.invertRate)));
    invert = u < s.invertLength ? 1 : 0;
  }
  let zoom = 1;
  if (s.zoomPulse > 0) {
    const u = fract(beats / Number(s.zoomPulseRate));
    zoom = 1 + s.zoomPulse * (0.5 - 0.5 * Math.cos(2 * Math.PI * u));
  }
  return { flash, invert, zoom };
}

/**
 * Beats after which every active tempo-driven effect repeats (ramp cycle and pulse
 * periods), or 0 when nothing depends on the beat. Used for seamless loops.
 */
export function beatPeriod(s: Settings): number {
  const periods: number[] = [];
  if (s.rampEnabled) periods.push(s.rampBeats);
  if (s.flashMode !== 'off') periods.push(flashPeriodBeats(s, Number(s.flashRate)));
  if (s.invertEnabled) periods.push(flashPeriodBeats(s, Number(s.invertRate)));
  if (s.zoomPulse > 0) periods.push(Number(s.zoomPulseRate));
  if (periods.length === 0) return 0;
  // All periods are multiples of a quarter beat.
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const quarters = periods.map((p) => Math.round(p * 4));
  return quarters.reduce((a, b) => (a / gcd(a, b)) * b) / 4;
}
