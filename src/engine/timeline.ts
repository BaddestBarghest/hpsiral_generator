import type { Settings } from '../settings/schema';
import { beatsPerSecond, rampIntegral } from './rhythm';

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
  /** Beats elapsed at the master tempo (not wrapped; drives ramp and pulses). */
  beatPhase: number;
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
    beatPhase: 0,
  };
}

const wrap = (x: number, period: number) => x - Math.floor(x / period) * period;

/**
 * Advances a colour phase; at speed 0 it returns to 0, so switching hue roll or a colour
 * shift off restores the exact chosen colours instead of freezing a rotated or half-blended
 * state (which could, for example, leave pink showing as its opposite, green).
 */
const colourPhase = (phase: number, speed: number, dt: number, period: number) =>
  speed === 0 ? 0 : wrap(phase + speed * dt, period);

export function step(state: TimelineState, s: Settings, dt: number): TimelineState {
  const dir = s.direction === 'inward' ? 1 : -1;
  const dir2 = s.s2Direction === 'inward' ? 1 : -1;
  const beatPhase = state.beatPhase + beatsPerSecond(s) * dt;
  // Seconds of flow at unit speed, stretched by the speed ramp (exact integral).
  const flowTime = rampIntegral(s, state.beatPhase, beatPhase, dt);
  return {
    time: state.time + dt,
    flowPhase: wrap(state.flowPhase + s.speed * dir * flowTime, FLOW_PERIOD),
    flowPhase2: wrap(state.flowPhase2 + s.s2Speed * dir2 * flowTime, FLOW_PERIOD),
    huePhase: colourPhase(state.huePhase, s.hueRoll, dt, 1),
    armColorPhase: colourPhase(state.armColorPhase, s.armShift, dt, COLOR_PERIOD),
    gapColorPhase: colourPhase(state.gapColorPhase, s.gapShift, dt, COLOR_PERIOD),
    s2ColorPhase: colourPhase(state.s2ColorPhase, s.s2Shift, dt, COLOR_PERIOD),
    wobblePhase: wrap(state.wobblePhase + s.wobbleSpeed * dt, 1),
    beatPhase,
  };
}
