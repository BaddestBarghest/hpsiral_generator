import { describe, expect, it } from 'vitest';
import { defaults, type Settings } from '../settings/schema';
import { beatPeriod, colorStepPhase, pulses } from './rhythm';


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
  it('breathes the zoom smoothly, biggest on the beat', () => {
    const s: Settings = { ...defaults(), zoomPulse: 0.2, zoomPulseRate: '2' };
    expect(pulses(s, 0).zoom).toBeCloseTo(1.2);
    expect(pulses(s, 1).zoom).toBeCloseTo(1);
    expect(pulses(s, 2).zoom).toBeCloseTo(1.2);
  });
  it('is inert by default', () => {
    expect(pulses(defaults(), 1.23)).toEqual({ flash: 0, invert: 0, zoom: 1 });
    expect(beatPeriod(defaults())).toBe(0);
  });
  it('combines periods on the quarter-beat grid', () => {
    const glowLoop = { to: 1, shape: 'smooth' as const, sharpness: 0.5, peak: 0.5, beats: 6 };
    const s: Settings = { ...defaults(), loops: { glow: glowLoop }, flashMode: 'soft', flashRate: '4', zoomPulse: 0.1, zoomPulseRate: '0.25' };
    expect(beatPeriod(s)).toBe(12); // lcm(6, 4, 0.25)
  });
});


describe('colour steps on the beat', () => {
  const s: Settings = { ...defaults(), armColors: ['#ff0000', '#0000ff'], armShift: 0.5, colorStep: true, colorStepRate: '2' };
  it('advance one whole colour every step, exactly on the beat', () => {
    expect(colorStepPhase(s, 0)).toBe(0);
    expect(colorStepPhase(s, 1.99)).toBe(0);
    expect(colorStepPhase(s, 2)).toBe(1);
    expect(colorStepPhase(s, 4.5)).toBe(2);
  });
  it('make loops wait for the palettes to come round', () => {
    expect(beatPeriod(s)).toBe(12); // 2 beats per step × 6-step palette cycle
  });
});
