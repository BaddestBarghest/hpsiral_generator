import type { Settings } from '../settings/schema';
import { beatPeriod, beatsPerSecond, rampMean } from './rhythm';

/**
 * Seamless loops: every periodic motion must complete a whole number of cycles in the
 * clip, so the frame after the last one is identical to the first.
 */

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/**
 * Flow cycles after which the pattern looks identical. One cycle moves every stripe to
 * where its neighbour was, which is invisible unless stripes are coloured individually
 * (static/kaleidoscopic with several colours): then the arm identity (k mod arms) or the
 * ring colour (k mod colours) must come round again too.
 */
export function flowPeriod(s: Settings): number {
  let p = 1;
  for (const [colors, mode] of [
    [s.armColors, s.armColorMode],
    [s.gapColors, s.gapColorMode],
  ] as const) {
    if (colors.length > 1 && (mode === 'static' || mode === 'kaleido')) {
      p = lcm(p, s.mode === 'concentric' ? colors.length : Math.round(s.arms));
    }
  }
  return p;
}

/** Same as `flowPeriod`, for the second spiral (arms only; its gaps are see-through). */
export function flowPeriod2(s: Settings): number {
  const perStripe = s.s2Colors.length > 1 && (s.s2ColorMode === 'static' || s.s2ColorMode === 'kaleido');
  if (!perStripe) return 1;
  return s.s2Mode === 'concentric' ? s.s2Colors.length : Math.round(s.s2Arms);
}

type RateKey = 'speed' | 'hueRoll' | 'armShift' | 'gapShift' | 's2Speed' | 's2Shift' | 'wobbleSpeed' | 'bpm';

interface Motion {
  key: RateKey;
  label: string;
  /** Cycles-of-something per second. */
  rate: number;
  /** Units of the rate after which that motion repeats. */
  period: number;
  /** Converts a rate back to the setting's own units (e.g. beats/s → BPM). */
  toSetting: (rate: number) => number;
}

const same = (r: number) => r;

function motions(s: Settings): Motion[] {
  // With a speed ramp, the flow advances by speed × mean multiplier per second on
  // average; over whole ramp cycles (guaranteed by the tempo motion) that is exact.
  const mean = rampMean(s);
  const beats = beatPeriod(s);
  const all: Motion[] = [
    { key: 'speed', label: 'Speed', rate: s.speed * mean, period: flowPeriod(s), toSetting: (r) => r / mean },
    { key: 'hueRoll', label: 'Hue roll speed', rate: s.hueRoll, period: 1, toSetting: same },
    // A single colour can't visibly shift, so it doesn't constrain the loop.
    { key: 'armShift', label: 'Arm colour shift', rate: s.armColors.length > 1 ? s.armShift : 0, period: s.armColors.length, toSetting: same },
    { key: 'gapShift', label: 'Gap colour shift', rate: s.gapColors.length > 1 ? s.gapShift : 0, period: s.gapColors.length, toSetting: same },
    // Hidden or invisible motions don't constrain the loop either.
    { key: 's2Speed', label: 'Spiral 2 speed', rate: s.s2Enabled ? s.s2Speed * mean : 0, period: flowPeriod2(s), toSetting: (r) => r / mean },
    { key: 's2Shift', label: 'Spiral 2 colour shift', rate: s.s2Enabled && s.s2Colors.length > 1 ? s.s2Shift : 0, period: s.s2Colors.length, toSetting: same },
    { key: 'wobbleSpeed', label: 'Wobble speed', rate: s.wobble > 0 ? s.wobbleSpeed : 0, period: 1, toSetting: same },
    // Ramp cycles and flash/inversion/zoom pulses all repeat every `beats` beats.
    { key: 'bpm', label: 'Tempo (BPM)', rate: beats > 0 ? beatsPerSecond(s) : 0, period: beats, toSetting: (r) => r * 60 },
  ];
  return all.filter((m) => Math.abs(m.rate) > 1e-9);
}

export interface LoopChange {
  key: RateKey;
  label: string;
  from: number;
  to: number;
}

export interface LoopPlan {
  /** Seconds; exactly `frames / fps`. */
  duration: number;
  frames: number;
  /** Settings to render with (rates adjusted to fit the loop). */
  settings: Settings;
  /** Rates that had to be nudged, for display. */
  changes: LoopChange[];
  /** Shortest seamless loop for these settings, in seconds (snapped to whole frames). */
  shortest: number;
}

// ── Exact loop: LCM of every motion's cycle time ─────────────────────────────
// Slider steps (and BPM / 60) are simple fractions, so each cycle time
// (period / rate) is an exact fraction. BigInt keeps the LCM exact even when it
// gets astronomically long.

const bgcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : bgcd(b, a % b));
const blcm = (a: bigint, b: bigint) => (a / bgcd(a, b)) * b;

/** `x` as an exact fraction p/q with q ≤ 1000 (covers 100/3 fps and slider steps). */
function toFraction(x: number): [bigint, bigint] {
  for (let q = 1; q <= 1000; q++) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-9) return [BigInt(p), BigInt(q)];
  }
  return [BigInt(Math.round(x * 1000)), 1000n];
}

export interface ExactLoop {
  seconds: number;
  frames: number;
}

/**
 * The true repeat length of the animation with the rates exactly as set: the least
 * common multiple of every motion's cycle time, extended to a whole number of frames.
 * Returns null when nothing moves.
 */
export function exactLoop(s: Settings, fps: number): ExactLoop | null {
  const ms = motions(s);
  if (ms.length === 0) return null;
  // Cycle time = period / rate = (pn / pd) / (rn / rd) = (pn * rd) / (pd * rn).
  let num = 0n; // LCM of numerators
  let den = 0n; // GCD of denominators
  for (const m of ms) {
    const [pn, pd] = toFraction(m.period);
    const [rn, rd] = toFraction(Math.abs(m.rate));
    let a = pn * rd;
    let b = pd * (rn === 0n ? 1n : rn);
    const g = bgcd(a, b);
    a /= g;
    b /= g;
    num = num === 0n ? a : blcm(num, a);
    den = den === 0n ? b : bgcd(den, b);
  }
  // Frames per loop = (num / den) * (p / q); stretch by the smallest m making it whole.
  const [p, q] = toFraction(fps);
  const top = num * p;
  const bottom = den * q;
  const frames = top / bgcd(top, bottom); // == m * top / bottom with m = bottom / gcd
  return { frames: Number(frames), seconds: Number(frames) / fps };
}

export type LoopMode = 'exact' | 'short';

/**
 * Plans a seamless loop near `targetSeconds`.
 *
 * - `exact`: keeps every rate as set; the length is a whole number of exact loops
 *   (can be very long when speeds share no common factors).
 * - `short`: the length is a whole number of the primary motion's periods (flow if
 *   moving, else the first other motion), and every other rate is nudged to complete
 *   whole cycles in that time.
 */
export function planLoop(s: Settings, targetSeconds: number, fps: number, mode: LoopMode = 'short'): LoopPlan {
  const ms = motions(s);
  if (ms.length === 0) {
    // Nothing moves: any length loops.
    const frames = Math.max(1, Math.round(targetSeconds * fps));
    return { duration: frames / fps, frames, settings: { ...s }, changes: [], shortest: 1 / fps };
  }

  if (mode === 'exact') {
    const exact = exactLoop(s, fps)!;
    const repeats = Math.max(1, Math.round(targetSeconds / exact.seconds));
    const frames = repeats * exact.frames;
    return { duration: frames / fps, frames, settings: { ...s }, changes: [], shortest: exact.seconds };
  }

  const primary = ms[0];
  const period = primary.period / Math.abs(primary.rate);
  const repeats = Math.max(1, Math.round(targetSeconds / period));
  const frames = Math.max(1, Math.round(repeats * period * fps));
  const duration = frames / fps;
  const shortest = Math.max(1, Math.round(period * fps)) / fps;

  const settings: Settings = { ...s };
  const changes: LoopChange[] = [];
  for (const m of ms) {
    const cycles = Math.max(1, Math.round((Math.abs(m.rate) * duration) / m.period));
    const rate = (Math.sign(m.rate) * cycles * m.period) / duration;
    const from = m.toSetting(m.rate);
    const to = m.toSetting(rate);
    settings[m.key] = to;
    if (Math.abs(to - from) > 5e-4) changes.push({ key: m.key, label: m.label, from, to });
  }
  return { duration, frames, settings, changes, shortest };
}
