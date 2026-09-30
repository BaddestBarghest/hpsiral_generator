import { describe, expect, it } from 'vitest';
import { defaults, loopableParams, newBeatLoop, sanitize, settingsFromJson, settingsToJson, type Settings } from '../settings/schema';
import { applyBeatLoops, loopedValue, loopIntegral, loopMax, loopMean, loopsChangeColours } from './modulation';
import { initialTimeline, step } from './timeline';
import { beatPeriod } from './rhythm';
import { exactLoop } from './loop';

const glowing: Settings = {
  ...defaults(),
  glow: 0.2,
  loops: { glow: { to: 1.2, shape: 'gaussian', sharpness: 0.8, peak: 0.25, beats: 4 } },
};

describe('beat loops', () => {
  it('run from the setting to the loop value and back', () => {
    expect(loopedValue(glowing, 'glow', 0)).toBeCloseTo(0.2);
    expect(loopedValue(glowing, 'glow', 1)).toBeCloseTo(1.2); // peak at a quarter of 4 beats
    expect(loopedValue(glowing, 'glow', 4)).toBeCloseTo(0.2);
    expect(loopedValue(glowing, 'glow', 5)).toBeCloseTo(1.2); // repeats every cycle
  });

  it('can run downwards too', () => {
    const zoom = loopableParams.find((p) => p.key === 'zoom')!;
    const s: Settings = { ...defaults(), zoom: 2, loops: { zoom: { ...newBeatLoop(zoom, 2), to: 1 } } };
    expect(loopedValue(s, 'zoom', 4)).toBeCloseTo(1);
    expect(loopMax(s, 'zoom')).toBe(2);
  });

  it('apply only to looped settings', () => {
    const s = applyBeatLoops(glowing, 1);
    expect(s.glow).toBeCloseTo(1.2);
    expect(s.vignette).toBe(glowing.vignette);
    expect(applyBeatLoops(defaults(), 1)).toEqual(defaults());
  });

  it('keep effects on while a loop passes through 0', () => {
    const s: Settings = { ...defaults(), trails: 0, loops: { trails: { to: 0.8, shape: 'smooth', sharpness: 0.5, peak: 0.5, beats: 8 } } };
    expect(loopMax(s, 'trails')).toBe(0.8);
    expect(loopsChangeColours(s)).toBe(true);
  });

  it('are part of the seamless loop length', () => {
    expect(beatPeriod(glowing)).toBe(4);
    const s: Settings = { ...glowing, speed: 0.5, bpm: 120 }; // flow 2 s, loop 4 beats = 2 s
    expect(exactLoop(s, 30)?.seconds).toBeCloseTo(2);
    expect(exactLoop({ ...s, loops: { glow: { ...glowing.loops.glow!, beats: 16 } } }, 30)?.seconds).toBeCloseTo(8);
  });

  it('ignore loops that go nowhere', () => {
    const still: Settings = { ...glowing, loops: { glow: { ...glowing.loops.glow!, to: 0.2 } } };
    expect(beatPeriod(still)).toBe(0);
  });

  it('start a quarter of the slider away, towards the middle', () => {
    const glow = loopableParams.find((p) => p.key === 'glow')!;
    expect(newBeatLoop(glow, 0).to).toBeCloseTo(0.5);
    expect(newBeatLoop(glow, 2).to).toBeCloseTo(1.5);
  });
});

describe('speed loops', () => {
  const s: Settings = {
    ...defaults(),
    bpm: 100,
    speed: 0.2,
    loops: { speed: { to: 1.4, shape: 'gaussian', sharpness: 0.8, peak: 0.2, beats: 8 } },
  };

  it('integrate exactly, whatever the step size', () => {
    const bps = s.bpm / 60;
    const total = (dt: number, seconds: number) => {
      let t = 0;
      let sum = 0;
      while (t < seconds - 1e-12) {
        const d = Math.min(dt, seconds - t);
        sum += loopIntegral(s, 'speed', t * bps, (t + d) * bps, d);
        t += d;
      }
      return sum;
    };
    const oneCycle = 8 / bps;
    expect(total(1 / 60, oneCycle)).toBeCloseTo(loopMean(s, 'speed') * oneCycle, 9);
    expect(total(1 / 7, 3.3)).toBeCloseTo(total(1 / 240, 3.3), 9);
  });

  it('drive the flow at the mean speed over whole cycles', () => {
    const seconds = (8 / (s.bpm / 60)) * 3;
    let tl = initialTimeline();
    for (let i = 0; i < Math.round(seconds * 60); i++) tl = step(tl, s, 1 / 60);
    expect(tl.flowPhase).toBeCloseTo((loopMean(s, 'speed') * seconds) % 720720, 6);
    expect(tl.beatPhase).toBeCloseTo(24, 9);
  });

  it('flow at the set speed without a loop', () => {
    expect(loopIntegral(defaults(), 'speed', 0, 5, 0.5)).toBe(0.25);
    expect(loopMean(defaults(), 'speed')).toBe(0.5);
  });
});

describe('saved speed ramps', () => {
  it('become beat loops on both speeds', () => {
    const s = settingsFromJson(
      JSON.stringify({ version: 2, speed: 0.5, s2Speed: 0.25, rampEnabled: true, rampMin: 0.4, rampMax: 1.6, rampBeats: 12, rampShape: 'linear' }),
    );
    expect(s.speed).toBeCloseTo(0.2);
    expect(s.s2Speed).toBeCloseTo(0.1);
    expect(s.loops.speed).toMatchObject({ shape: 'linear', beats: 16 }); // nearest offered length
    expect(s.loops.speed!.to).toBeCloseTo(0.8);
    expect(s.loops.s2Speed!.to).toBeCloseTo(0.4);
    expect('rampEnabled' in s).toBe(false);
  });

  it('are ignored when switched off, or in current saves', () => {
    expect(settingsFromJson(JSON.stringify({ version: 2, speed: 0.5, rampEnabled: false })).loops).toEqual({});
    expect(settingsFromJson(JSON.stringify({ version: 3, speed: 0.5, rampEnabled: true })).speed).toBe(0.5);
  });
});

describe('saved beat loops', () => {
  it('round-trip through a settings file', () => {
    expect(settingsFromJson(settingsToJson(glowing)).loops).toEqual(glowing.loops);
  });

  it('are cleaned up on load', () => {
    const s = sanitize({
      glow: 0.5,
      loops: {
        glow: { to: 99, shape: 'wiggly', sharpness: -1, peak: 2, beats: 3 },
        bpm: { to: 200, shape: 'smooth', sharpness: 0.5, peak: 0.5, beats: 8 }, // not loopable
        vignette: 'nonsense',
      },
    });
    expect(s.loops).toEqual({ glow: { to: 2, shape: 'smooth', sharpness: 0, peak: 0.95, beats: 8 } });
    expect(sanitize({}).loops).toEqual({});
  });
});
