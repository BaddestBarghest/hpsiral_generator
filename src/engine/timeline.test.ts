import { describe, expect, it } from 'vitest';
import { defaults } from '../settings/schema';
import { alignBeat, COLOR_PERIOD, FLOW_PERIOD, initialTimeline, step, type TimelineState } from './timeline';
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

describe('colour phases', () => {
  it('return to the exact colours when their speed is set back to 0', () => {
    const rolling = { ...defaults(), hueRoll: 0.5, armShift: 0.3, gapShift: 0.7, s2Shift: 0.2 };
    let tl = initialTimeline();
    for (let i = 0; i < 60; i++) tl = step(tl, rolling, 1 / 60); // one second: hue is half-way round
    expect(tl.huePhase).toBeCloseTo(0.5);
    tl = step(tl, { ...rolling, hueRoll: 0, armShift: 0, gapShift: 0, s2Shift: 0 }, 1 / 60);
    expect([tl.huePhase, tl.armColorPhase, tl.gapColorPhase, tl.s2ColorPhase]).toEqual([0, 0, 0, 0]);
  });
});

describe('tap tempo alignment', () => {
  it('puts a beat at the current moment, moving by at most half a beat', () => {
    const at = (beatPhase: number) => alignBeat({ ...initialTimeline(), beatPhase }).beatPhase;
    expect(at(7.3)).toBe(7);
    expect(at(7.6)).toBe(8);
    expect(at(12)).toBe(12);
  });
});

describe('frame-rate cap', () => {
  /** Frames drawn in one second of display frames with the given gaps (ms, repeating). */
  function drawnPerSecond(gaps: number[], maxFps: number): number {
    const clock = new LiveClock();
    let t = 0;
    let drawn = 0;
    clock.tick(t, maxFps);
    for (let i = 0; t < 1000; i++) {
      t += gaps[i % gaps.length];
      if (clock.tick(t, maxFps) !== null) drawn++;
    }
    return drawn;
  }

  it('does not halve a jittery 60 Hz display when capped at 60', () => {
    // Worker frames often arrive unevenly around 16.7 ms.
    expect(drawnPerSecond([18.4, 14.9], 60)).toBeGreaterThanOrEqual(58);
    expect(drawnPerSecond([16.7], 60)).toBeGreaterThanOrEqual(59);
  });

  it('still caps faster displays', () => {
    expect(drawnPerSecond([1000 / 144], 60)).toBeLessThanOrEqual(61);
    expect(drawnPerSecond([1000 / 144], 60)).toBeGreaterThanOrEqual(55);
    expect(drawnPerSecond([1000 / 120], 30)).toBeLessThanOrEqual(31);
    expect(drawnPerSecond([1000 / 120], 30)).toBeGreaterThanOrEqual(29);
  });

  it('never loses animation time: drawn steps add up to the real time', () => {
    const clock = new LiveClock();
    let t = 0;
    let advanced = 0;
    clock.tick(t, 60);
    for (let i = 0; i < 300; i++) {
      t += i % 2 ? 14.9 : 18.4;
      advanced += clock.tick(t, 60) ?? 0;
    }
    expect(advanced).toBeCloseTo(t / 1000, 1);
  });
});
