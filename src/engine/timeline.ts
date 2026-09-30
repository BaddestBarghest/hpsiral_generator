import type { Settings } from '../settings/schema';
import { beatsPerSecond } from './rhythm';
import { loopIntegral } from './modulation';
import { wrap } from './math';
import { advanceSequence, resolveSequence, sequenceActive } from './sequence';

/**
 * Flow phase wraps at lcm(1..16), so every arm count divides it and stripe indices
 * (used for per-stripe colours) never jump when the phase wraps.
 */
export const FLOW_PERIOD = 720720;

/** Colour phases wrap at lcm(1, 2, 3) — a multiple of every band's colour count. */
export const COLOR_PERIOD = 6;

/**
 * Animation state that depends on history (phases integrate speed over time).
 * Advanced only through `step`, so live playback (variable dt) and offline
 * rendering (fixed dt) produce the same result for the same timeline.
 */
export interface TimelineState {
  /** Seconds of animation time elapsed (paused time excluded). */
  time: number;
  /** Pattern flow phase in cycles, wrapped to [0, FLOW_PERIOD). */
  flowPhase: number;
  /** Auxiliary spiral's flow phase, same wrapping. */
  flowPhase2: number;
  /** Hue rotation in revolutions, wrapped to [0, 1). */
  huePhase: number;
  /** Arm colour shift in palette steps, wrapped to [0, COLOR_PERIOD). */
  armColorPhase: number;
  /** Gap colour shift in palette steps, wrapped to [0, COLOR_PERIOD). */
  gapColorPhase: number;
  /** Auxiliary spiral's colour shift, wrapped to [0, COLOR_PERIOD). */
  s2ColorPhase: number;
  /** Wobble ripple travel in cycles, wrapped to [0, 1). */
  wobblePhase: number;
  /** Kaleidoscope sectors' rotation in turns (anticlockwise), wrapped to [0, 1). */
  kaleidoPhase: number;
  /** Beats elapsed at the master tempo (not wrapped; drives beat loops and pulses). */
  beatPhase: number;
  /** Position in the scene sequence, in its unit (seconds or beats); 0 while none plays. */
  seqPos: number;
}

export function initialTimeline(): TimelineState {
  return {
    time: 0,
    flowPhase: 0,
    flowPhase2: 0,
    huePhase: 0,
    armColorPhase: 0,
    gapColorPhase: 0,
    s2ColorPhase: 0,
    wobblePhase: 0,
    kaleidoPhase: 0,
    beatPhase: 0,
    seqPos: 0,
  };
}

/**
 * Advances a colour phase; at speed 0 it returns to 0, so switching hue roll or a colour
 * shift off restores the exact chosen colours instead of freezing a rotated or half-blended
 * state (which could, for example, leave pink showing as its opposite, green).
 */
const colourPhase = (phase: number, speed: number, dt: number, period: number) =>
  speed === 0 ? 0 : wrap(phase + speed * dt, period);

/**
 * In a sequence, a fade that ends a colour shift would snap the colours back to their own
 * at the very end. Instead the phase eases back at `rate` per second to the nearest position
 * that looks the same as 0 (a multiple of `unit`, which divides `period`).
 */
function settlingPhase(phase: number, speed: number, dt: number, period: number, unit: number, rate: number): number {
  if (speed !== 0) return wrap(phase + speed * dt, period);
  const d = Math.round(phase / unit) * unit - phase;
  const move = rate * dt;
  return Math.abs(d) <= move ? 0 : wrap(phase + Math.sign(d) * move, period);
}

/**
 * Puts a beat exactly at the current moment (the user just tapped one), moving the beat
 * position by at most half a beat so everything beat-driven lines up with the taps.
 */
export function alignBeat(state: TimelineState): TimelineState {
  return { ...state, beatPhase: Math.round(state.beatPhase) };
}

export function step(state: TimelineState, settings: Settings, dt: number): TimelineState {
  // With a sequence playing, everything follows the scene showing at this moment.
  const s = resolveSequence(settings, state.seqPos);
  const inSequence = sequenceActive(settings);
  const dir = s.direction === 'inward' ? 1 : -1;
  const dir2 = s.s2Direction === 'inward' ? 1 : -1;
  const beatPhase = state.beatPhase + beatsPerSecond(s) * dt;
  // Cycles flowed this step; exact integrals when a speed loops with the beat.
  const flow = loopIntegral(s, 'speed', state.beatPhase, beatPhase, dt);
  const flow2 = loopIntegral(s, 's2Speed', state.beatPhase, beatPhase, dt);
  const kaleidoSpins = s.kaleidoSpin !== 0 || !!s.loops.kaleidoSpin;
  const colour = (phase: number, speed: number, period: number, unit: number, rate: number) =>
    inSequence ? settlingPhase(phase, speed, dt, period, unit, rate) : colourPhase(phase, speed, dt, period);
  return {
    time: state.time + dt,
    flowPhase: wrap(state.flowPhase + dir * flow, FLOW_PERIOD),
    flowPhase2: wrap(state.flowPhase2 + dir2 * flow2, FLOW_PERIOD),
    huePhase: colour(state.huePhase, s.hueRoll, 1, 1, 0.25),
    armColorPhase: colour(state.armColorPhase, s.armShift, COLOR_PERIOD, s.armColors.length, 1),
    gapColorPhase: colour(state.gapColorPhase, s.gapShift, COLOR_PERIOD, s.gapColors.length, 1),
    s2ColorPhase: colour(state.s2ColorPhase, s.s2Shift, COLOR_PERIOD, s.s2Colors.length, 1),
    wobblePhase: wrap(state.wobblePhase + s.wobbleSpeed * dt, 1),
    // Switched off, the sectors go back to where they started, like the colour phases.
    kaleidoPhase: kaleidoSpins
      ? wrap(state.kaleidoPhase + loopIntegral(s, 'kaleidoSpin', state.beatPhase, beatPhase, dt), 1)
      : colour(state.kaleidoPhase, 0, 1, 1, 0.25),
    beatPhase,
    seqPos: inSequence
      ? advanceSequence(settings.sequence, state.seqPos, settings.sequence.unit === 'beats' ? beatPhase - state.beatPhase : dt)
      : 0,
  };
}
