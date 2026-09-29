import { describe, expect, it } from 'vitest';
import { defaults } from '../settings/schema';
import { initialTimeline, step } from '../engine/timeline';
import type { Renderer } from '../render/Renderer';
import { advance, subSteps } from './warmup';

describe('trail sub-steps', () => {
  it('only sub-steps when an afterimage is on', () => {
    expect(subSteps(defaults(), 25)).toBe(1);
    expect(subSteps({ ...defaults(), trails: 0.5 }, 25)).toBe(3);
    expect(subSteps({ ...defaults(), trails: 0.5 }, 60)).toBe(1);
    expect(subSteps({ ...defaults(), textEnabled: true, textTrails: 0.5 }, 15)).toBe(4);
  });

  it('advances the timeline by exactly one output frame, drawing the frames in between', () => {
    const s = { ...defaults(), trails: 0.5, speed: 0.7, hueRoll: 0.1 };
    const draws: number[] = [];
    const renderer = { draw: (_s: unknown, tl: { time: number }, _dt: number, show: boolean) => { expect(show).toBe(false); draws.push(tl.time); } } as unknown as Renderer;
    const tl = advance(renderer, s, initialTimeline(), 20);
    const direct = step(initialTimeline(), s, 1 / 20);
    expect(draws).toHaveLength(2);
    expect(tl.time).toBeCloseTo(direct.time, 12);
    expect(tl.flowPhase).toBeCloseTo(direct.flowPhase, 9);
    expect(tl.huePhase).toBeCloseTo(direct.huePhase, 9);
  });
});
