import { describe, expect, it } from 'vitest';
import { defaults, type Settings } from '../settings/schema';
import { beatPeriod, pulses, rampIntegral, rampMean, rampMultiplier } from './rhythm';
import { initialTimeline, step } from './timeline';

const ramp = (shape: 'smooth' | 'linear'): Settings => ({
  ...defaults(),
  bpm: 100,
  rampEnabled: true,
  rampMin: 0.2,
  rampMax: 2.6,
  rampBeats: 8,
  rampShape: shape,
});

describe('speed ramp', () => {
  for (const shape of ['smooth', 'linear'] as const) {
    it(`${shape}: runs from slowest to fastest and back`, () => {
      const s = ramp(shape);
      expect(rampMultiplier(s, 0)).toBeCloseTo(0.2);
      expect(rampMultiplier(s, 4)).toBeCloseTo(2.6); // half a cycle
      expect(rampMultiplier(s, 8)).toBeCloseTo(0.2);
    });

    it(`${shape}: integrates exactly, whatever the step size`, () => {
      const s = ramp(shape);
      const bps = s.bpm / 60;
      const total = (dt: number, seconds: number) => {
        let t = 0;
        let beats = 0;
        let sum = 0;
        while (t < seconds - 1e-12) {
          const d = Math.min(dt, seconds - t);
          sum += rampIntegral(s, beats, beats + bps * d, d);
          beats += bps * d;
          t += d;
        }
        return sum;
      };
      const oneCycle = 8 / bps; // seconds
      expect(total(1 / 60, oneCycle)).toBeCloseTo(rampMean(s) * oneCycle, 9);
      expect(total(1 / 7, 3.3)).toBeCloseTo(total(1 / 240, 3.3), 9);
    });
  }

  it('is a no-op when disabled', () => {
    expect(rampIntegral(defaults(), 0, 5, 0.5)).toBe(0.5);
    expect(rampMean(defaults())).toBe(1);
  });
});

describe('pulses', () => {
  it('strobes hard on and off', () => {
    const s: Settings = { ...defaults(), flashMode: 'strobe', flashRate: '1', flashLength: 0.25, flashIntensity: 1 };
    expect(pulses(s, 3.1).flash).toBe(1);
    expect(pulses(s, 3.5).flash).toBe(0);
  });
  it('soft flashes fade from full intensity', () => {
    const s: Settings = { ...defaults(), flashMode: 'soft', flashIntensity: 0.8 };
    expect(pulses(s, 2).flash).toBeCloseTo(0.8);
    expect(pulses(s, 2.5).flash).toBeLessThan(0.05);
  });
  it('breathes the zoom smoothly', () => {
    const s: Settings = { ...defaults(), zoomPulse: 0.2, zoomPulseRate: '2' };
    expect(pulses(s, 0).zoom).toBeCloseTo(1);
    expect(pulses(s, 1).zoom).toBeCloseTo(1.2);
  });
  it('is inert by default', () => {
    expect(pulses(defaults(), 1.23)).toEqual({ flash: 0, invert: 0, zoom: 1 });
    expect(beatPeriod(defaults())).toBe(0);
  });
  it('combines periods on the quarter-beat grid', () => {
    const s: Settings = { ...defaults(), rampEnabled: true, rampBeats: 6, flashMode: 'soft', flashRate: '4', zoomPulse: 0.1, zoomPulseRate: '0.25' };
    expect(beatPeriod(s)).toBe(12); // lcm(6, 4, 0.25)
  });
});

describe('timeline with tempo', () => {
  it('flows at the ramped speed', () => {
    const s = { ...ramp('smooth'), speed: 0.5 };
    const seconds = (8 / (s.bpm / 60)) * 3; // three ramp cycles
    let tl = initialTimeline();
    for (let i = 0; i < Math.round(seconds * 60); i++) tl = step(tl, s, 1 / 60);
    expect(tl.flowPhase).toBeCloseTo((0.5 * rampMean(s) * seconds) % 720720, 6);
    expect(tl.beatPhase).toBeCloseTo(24, 9);
  });
});
