import { describe, expect, it } from 'vitest';
import { defaults, type Settings } from '../settings/schema';
import { exactLoop, flowPeriod, planLoop } from './loop';
import { initialTimeline, step } from './timeline';

/** Distance from `x` to the nearest multiple of `period`. */
const offGrid = (x: number, period: number) => {
  const r = ((x % period) + period) % period;
  return Math.min(r, period - r);
};

function assertSeamless(s: Settings, target: number, fps: number, mode: 'exact' | 'short' = 'short') {
  const plan = planLoop(s, target, fps, mode);
  expect(plan.duration).toBeCloseTo(plan.frames / fps, 12);
  let tl = initialTimeline();
  for (let i = 0; i < plan.frames; i++) tl = step(tl, plan.settings, 1 / fps);
  // After exactly one loop, every visible phase is back where it started.
  expect(offGrid(tl.flowPhase, flowPeriod(plan.settings))).toBeLessThan(1e-6);
  expect(offGrid(tl.huePhase, 1)).toBeLessThan(1e-6);
  if (s.armColors.length > 1) expect(offGrid(tl.armColorPhase, s.armColors.length)).toBeLessThan(1e-6);
  if (s.gapColors.length > 1) expect(offGrid(tl.gapColorPhase, s.gapColors.length)).toBeLessThan(1e-6);
  return plan;
}

describe('flowPeriod', () => {
  it('is one cycle for single-colour bands', () => {
    expect(flowPeriod({ ...defaults(), arms: 5 })).toBe(1);
  });
  it('waits for the arm identity to come round with per-stripe colours', () => {
    const s = { ...defaults(), arms: 3, armColors: ['#ffffff', '#ff0000'], armColorMode: 'static' as const };
    expect(flowPeriod(s)).toBe(3);
    expect(flowPeriod({ ...s, mode: 'concentric' as const })).toBe(2);
    expect(flowPeriod({ ...s, armColorMode: 'gradient' as const })).toBe(1);
  });
});

const awkward: Settings = {
  ...defaults(),
  speed: 0.37,
  hueRoll: 0.11,
  arms: 3,
  armColors: ['#ffffff', '#ff0000', '#00ff00'],
  armColorMode: 'static',
  armShift: 0.29,
  gapColors: ['#000000', '#222222'],
  gapShift: 0.5,
};

describe('exactLoop', () => {
  it('is null when nothing moves', () => {
    expect(exactLoop({ ...defaults(), speed: 0 }, 30)).toBeNull();
  });

  it('is the LCM of every cycle time', () => {
    expect(exactLoop(defaults(), 25)).toEqual({ seconds: 2, frames: 50 }); // 1 / 0.5
    expect(exactLoop({ ...defaults(), speed: 0.5, hueRoll: 0.1 }, 25)?.seconds).toBeCloseTo(10); // lcm(2, 10)
    expect(exactLoop({ ...defaults(), speed: 0.4, hueRoll: 0.25 }, 25)?.seconds).toBeCloseTo(20); // lcm(2.5, 4)
    // lcm(300/37, 100/11, 300/29, 4) = 300 s
    const e = exactLoop(awkward, 100 / 3)!;
    expect(e.seconds).toBeCloseTo(300);
    expect(e.frames).toBe(10000);
  });

  it('stretches to a whole number of frames', () => {
    // 1/0.3 s per cycle = 10/3 s; at 24 fps that's 80 frames exactly, at 50 fps 166.67 → 3 cycles (500 frames).
    expect(exactLoop({ ...defaults(), speed: 0.3 }, 24)?.frames).toBe(80);
    expect(exactLoop({ ...defaults(), speed: 0.3 }, 50)?.frames).toBe(500);
  });
});

describe('planLoop', () => {
  it('exact mode keeps every rate and still loops', () => {
    const s = { ...defaults(), speed: 0.4, hueRoll: 0.25, armColors: ['#fff000', '#000fff'], armShift: 0.2 };
    const plan = assertSeamless(s, 1, 30, 'exact');
    expect(plan.changes).toEqual([]);
    expect(plan.settings.hueRoll).toBe(0.25);
    expect(plan.duration).toBeCloseTo(20); // lcm(2.5, 4, 10)
  });

  it('loops the default look', () => {
    const plan = assertSeamless(defaults(), 3, 30);
    expect(plan.changes).toEqual([]); // speed 0.5 → 2 s period, 4 s is a whole number of periods
  });

  it('loops awkward combinations by nudging the secondary rates', () => {
    const s: Settings = {
      ...defaults(),
      speed: 0.37,
      hueRoll: 0.11,
      arms: 3,
      armColors: ['#ffffff', '#ff0000', '#00ff00'],
      armColorMode: 'static',
      armShift: 0.29,
      gapColors: ['#000000', '#222222'],
      gapShift: 1.3,
    };
    for (const fps of [24, 30, 60, 50, 100 / 3]) {
      const plan = assertSeamless(s, 5, fps);
      expect(plan.changes.length).toBeGreaterThan(0);
    }
  });

  it('uses the other motions when the flow is still', () => {
    assertSeamless({ ...defaults(), speed: 0, hueRoll: 0.2 }, 2, 25);
  });

  it('keeps a still image at the requested length', () => {
    const plan = planLoop({ ...defaults(), speed: 0 }, 2, 20);
    expect(plan.frames).toBe(40);
  });

  it('never returns fewer than one period', () => {
    const plan = planLoop({ ...defaults(), speed: 0.1 }, 0.5, 30);
    expect(plan.duration).toBeCloseTo(10, 6);
  });
});
