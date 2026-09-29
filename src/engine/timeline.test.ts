import { describe, expect, it } from 'vitest';
import { defaults } from '../settings/schema';
import { COLOR_PERIOD, FLOW_PERIOD, initialTimeline, step, type TimelineState } from './timeline';
import { LiveClock, MAX_LIVE_DT } from './clock';

function run(dts: number[]): TimelineState {
  const s = { ...defaults(), speed: 1.37, hueRoll: 0.21, armShift: 0.43, gapShift: 1.9 };
  return dts.reduce((tl, dt) => step(tl, s, dt), initialTimeline());
}

describe('timeline', () => {
  it('reaches the same state with variable live steps and fixed offline steps', () => {
    // 2 seconds as jittery live frames vs. exact 60 fps frames
    const jitter = [0.016, 0.017, 0.0165, 0.0168, 0.0162, 0.0175];
    const live: number[] = [];
    let total = 0;
    for (let i = 0; total < 2 - 1e-9; i++) {
      const dt = Math.min(jitter[i % jitter.length], 2 - total);
      live.push(dt);
      total += dt;
    }
    const fixed = Array.from({ length: 120 }, () => 1 / 60);

    const a = run(live);
    const b = run(fixed);
    expect(a.time).toBeCloseTo(2, 9);
    expect(b.time).toBeCloseTo(2, 9);
    expect(a.flowPhase).toBeCloseTo(b.flowPhase, 9);
    expect(a.huePhase).toBeCloseTo(b.huePhase, 9);
    expect(a.armColorPhase).toBeCloseTo(b.armColorPhase, 9);
    expect(a.gapColorPhase).toBeCloseTo(b.gapColorPhase, 9);
  });

  it('keeps phases wrapped to their periods', () => {
    const tl = run(Array.from({ length: 1000 }, () => 0.1));
    const ranges: [number, number][] = [
      [tl.flowPhase, FLOW_PERIOD],
      [tl.huePhase, 1],
      [tl.armColorPhase, COLOR_PERIOD],
      [tl.gapColorPhase, COLOR_PERIOD],
    ];
    for (const [v, period] of ranges) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(period);
    }
  });

  it('wraps flow at a multiple of every arm count', () => {
    for (let arms = 1; arms <= 16; arms++) expect(FLOW_PERIOD % arms).toBe(0);
    for (let n = 1; n <= 3; n++) expect(COLOR_PERIOD % n).toBe(0);
  });

  it('reverses flow for outward direction', () => {
    const s = defaults();
    const inward = step(initialTimeline(), { ...s, direction: 'inward', speed: 0.25 }, 1);
    const outward = step(initialTimeline(), { ...s, direction: 'outward', speed: 0.25 }, 1);
    expect(inward.flowPhase).toBeCloseTo(0.25);
    expect(outward.flowPhase).toBeCloseTo(FLOW_PERIOD - 0.25);
  });
});

describe('LiveClock', () => {
  it('clamps long gaps (e.g. background tab)', () => {
    const c = new LiveClock();
    expect(c.tick(1000, 0)).toBe(0);
    expect(c.tick(6000, 0)).toBe(MAX_LIVE_DT);
  });

  it('skips frames to honour an FPS cap', () => {
    const c = new LiveClock();
    c.tick(0, 30);
    const results = [16.7, 33.3, 50, 66.7].map((t) => c.tick(t, 30));
    expect(results.filter((r) => r !== null)).toHaveLength(2);
  });
});
