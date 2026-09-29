import type { Settings } from '../settings/schema';

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
  /** Hue rotation in revolutions, wrapped to [0, 1). */
  huePhase: number;
  /** Arm colour shift in palette steps, wrapped to [0, COLOR_PERIOD). */
  armColorPhase: number;
  /** Gap colour shift in palette steps, wrapped to [0, COLOR_PERIOD). */
  gapColorPhase: number;
}

export function initialTimeline(): TimelineState {
  return { time: 0, flowPhase: 0, huePhase: 0, armColorPhase: 0, gapColorPhase: 0 };
}

const wrap = (x: number, period: number) => x - Math.floor(x / period) * period;

export function step(state: TimelineState, s: Settings, dt: number): TimelineState {
  const dir = s.direction === 'inward' ? 1 : -1;
  return {
    time: state.time + dt,
    flowPhase: wrap(state.flowPhase + s.speed * dir * dt, FLOW_PERIOD),
    huePhase: wrap(state.huePhase + s.hueRoll * dt, 1),
    armColorPhase: wrap(state.armColorPhase + s.armShift * dt, COLOR_PERIOD),
    gapColorPhase: wrap(state.gapColorPhase + s.gapShift * dt, COLOR_PERIOD),
  };
}
