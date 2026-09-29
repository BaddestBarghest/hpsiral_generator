import type { Settings } from '../settings/schema';

/**
 * Animation state that depends on history (phases integrate speed over time).
 * Advanced only through `step`, so live playback (variable dt) and offline
 * rendering (fixed dt) produce the same result for the same timeline.
 */
export interface TimelineState {
  /** Seconds of animation time elapsed (paused time excluded). */
  time: number;
  /** Pattern flow phase in cycles, wrapped to [0, 1). */
  flowPhase: number;
  /** Hue rotation in revolutions, wrapped to [0, 1). */
  huePhase: number;
}

export function initialTimeline(): TimelineState {
  return { time: 0, flowPhase: 0, huePhase: 0 };
}

const wrap = (x: number) => x - Math.floor(x);

export function step(state: TimelineState, s: Settings, dt: number): TimelineState {
  const dir = s.direction === 'inward' ? 1 : -1;
  return {
    time: state.time + dt,
    flowPhase: wrap(state.flowPhase + s.speed * dir * dt),
    huePhase: wrap(state.huePhase + s.hueRoll * dt),
  };
}
