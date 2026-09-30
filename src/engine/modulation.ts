import type { BeatLoop, LoopableKey, Settings } from '../settings/schema';
import { curveAt, curveIntegral, curveMean } from './curves';

/**
 * Beat loops: settings animated with the beat. Each is a pure function of the beat position,
 * so live playback, offline renders and seamless loops agree exactly. Most are values the
 * renderer reads fresh every frame; the speeds are rates, which the timeline integrates
 * (see `loopIntegral`).
 */

/** Looped settings that are rates (the timeline integrates them), not values drawn directly. */
export const RATE_LOOP_KEYS = ['speed', 's2Speed', 'kaleidoSpin'] as const;
export type RateLoopKey = (typeof RATE_LOOP_KEYS)[number];
export const isRateLoopKey = (key: string): key is RateLoopKey => (RATE_LOOP_KEYS as readonly string[]).includes(key);

/** Mean of looped setting `key` over a cycle (its own value without a loop). */
export function loopMean(s: Settings, key: LoopableKey): number {
  const l = s.loops[key];
  return l ? s[key] + (l.to - s[key]) * curveMean(l) : s[key];
}

/**
 * ∫ value dt of looped rate `key` over a step of `dt` seconds that moved the beat position
 * from `beats0` to `beats1`. Exact (not a per-frame approximation), so the flow phase is
 * identical whatever the frame rate.
 */
export function loopIntegral(s: Settings, key: RateLoopKey, beats0: number, beats1: number, dt: number): number {
  const l = s.loops[key];
  const base = s[key];
  if (!l || dt === 0) return base * dt;
  const x0 = beats0 / l.beats;
  const x1 = beats1 / l.beats;
  const meanCurve = x1 === x0 ? curveAt(l, x0) : (curveIntegral(l, x1) - curveIntegral(l, x0)) / (x1 - x0);
  return dt * (base + (l.to - base) * meanCurve);
}

/** Loops that actually move (their two ends differ). */
function activeLoops(s: Settings): [LoopableKey, BeatLoop][] {
  return (Object.entries(s.loops) as [LoopableKey, BeatLoop][]).filter(([key, l]) => l.to !== s[key]);
}

/** The value of looped setting `key` at beat position `beats`. */
export function loopedValue(s: Settings, key: LoopableKey, beats: number): number {
  const l = s.loops[key];
  const base = s[key];
  return l ? base + (l.to - base) * curveAt(l, beats / l.beats) : base;
}

/** Settings as they are at beat position `beats`, with every beat loop applied. */
export function applyBeatLoops(s: Settings, beats: number): Settings {
  const loops = activeLoops(s);
  if (loops.length === 0) return s;
  const out = { ...s };
  for (const [key] of loops) out[key] = loopedValue(s, key, beats);
  return out;
}

/** Cycle lengths (in beats) of the loops that move; the seamless-loop length must cover them. */
export const beatLoopPeriods = (s: Settings): number[] => activeLoops(s).map(([, l]) => l.beats);

/**
 * The largest value `key` reaches over its loop. Effects that switch whole passes on or off
 * (glow, afterimages) decide from this, so a loop dipping to 0 doesn't reset them.
 */
export function loopMax(s: Settings, key: LoopableKey): number {
  const l = s.loops[key];
  return l ? Math.max(s[key], l.to) : s[key];
}

/** Looped settings that move things around without changing their colours. */
const MOTION_ONLY: readonly LoopableKey[] = ['zoom', 'speed', 's2Speed', 'kaleidoSpin', 'twist', 'centerX', 'centerY', 'rotation'];

/** Whether any loop changes colours over time (glow, vignette, afterimages). */
export const loopsChangeColours = (s: Settings) => activeLoops(s).some(([key]) => !MOTION_ONLY.includes(key));
