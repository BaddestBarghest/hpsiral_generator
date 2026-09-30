import type { Settings } from '../settings/schema';
import { textCycleSlots, textSlotBeats } from './text';
import { colorStepsActive, flashPlan } from './safety';
import { fract, lcm } from './math';
import { beatLoopPeriods } from './modulation';

/**
 * Tempo-driven effects. Everything is a pure function of the beat position, so live
 * playback, offline renders and loops agree exactly.
 */

export const beatsPerSecond = (s: Settings) => s.bpm / 60;

/** Steps after which every beat-stepped palette is back where it started (lcm of 1..3). */
const COLOR_STEP_CYCLE = 6;

/** Palette steps taken by beat-locked colour stepping at beat position `beats`. */
export function colorStepPhase(s: Settings, beats: number): number {
  return Math.floor(beats / flashPlan(s).colorBeats) % COLOR_STEP_CYCLE;
}

// ── Pulses ────────────────────────────────────────────────────────────────

export interface Pulses {
  /** 0..1 mix towards the flash colour. */
  flash: number;
  /** 0..1 mix towards the inverted image. */
  invert: number;
  /** Zoom multiplier (≥ 1). */
  zoom: number;
}

export function pulses(s: Settings, beats: number): Pulses {
  // Flashes and inversions share one safety budget (see engine/safety.ts).
  const plan = flashPlan(s);
  let flash = 0;
  if (s.flashMode !== 'off') {
    const u = fract(beats / plan.flashBeats);
    const env = s.flashMode === 'strobe' ? (u < s.flashLength ? 1 : 0) : Math.exp(-u / Math.max(0.3 * s.flashLength, 0.01));
    flash = env * s.flashIntensity;
  }
  let invert = 0;
  if (s.invertEnabled) {
    const u = fract(beats / plan.invertBeats);
    invert = u < s.invertLength ? 1 : 0;
  }
  let zoom = 1;
  if (s.zoomPulse > 0) {
    // Biggest on the beat (like the flashes), easing back in between.
    const u = fract(beats / Number(s.zoomPulseRate));
    zoom = 1 + s.zoomPulse * (0.5 + 0.5 * Math.cos(2 * Math.PI * u));
  }
  return { flash, invert, zoom };
}

/**
 * Beats after which every active tempo-driven effect repeats (beat loops and pulse
 * periods), or 0 when nothing depends on the beat. Used for seamless loops.
 */
export function beatPeriod(s: Settings): number {
  const periods: number[] = [];
  const plan = flashPlan(s);
  if (s.flashMode !== 'off') periods.push(plan.flashBeats);
  if (s.invertEnabled) periods.push(plan.invertBeats);
  // Colour steps repeat once every palette has come round (6 = lcm of 1..3 colours).
  if (colorStepsActive(s)) periods.push(plan.colorBeats * COLOR_STEP_CYCLE);
  if (s.zoomPulse > 0) periods.push(Number(s.zoomPulseRate));
  // Beat-synced text repeats once its whole cycle (every phrase, or every wall layout) has shown.
  const cycle = textCycleSlots(s);
  if (s.textEnabled && cycle > 0 && textSlotBeats(s) > 0) periods.push(textSlotBeats(s) * cycle);
  // Beat loops (the speeds' included) repeat every cycle.
  periods.push(...beatLoopPeriods(s));
  if (periods.length === 0) return 0;
  // All periods are multiples of a quarter beat.
  return periods.map((p) => Math.round(p * 4)).reduce(lcm) / 4;
}
