import { describe, expect, it } from 'vitest';
import { heartRadii, OUTLINE_SAMPLES } from './shapes';

const sampler = (r: Float32Array) => (deg: number) =>
  r[((Math.round((deg / 360) * OUTLINE_SAMPLES) % OUTLINE_SAMPLES) + OUTLINE_SAMPLES) % OUTLINE_SAMPLES];

describe('heart outline', () => {
  const r = heartRadii();
  const at = sampler(r);

  it('has a radius in every direction (no gaps), largest 1', () => {
    expect(Math.min(...r)).toBeGreaterThan(0.2);
    expect(Math.max(...r)).toBeCloseTo(1);
  });

  it('points down and dips in at the top', () => {
    // The tip (straight down) reaches further than the sides next to it.
    expect(at(270)).toBeGreaterThan(at(240));
    expect(at(270)).toBeGreaterThan(at(300));
    expect(at(90)).toBeLessThan(at(60)); // the dimple sits between the two lobes
    expect(at(90)).toBeLessThan(at(120));
  });

  it('is symmetric left to right', () => {
    for (const deg of [10, 45, 80, 135, 200]) expect(at(deg)).toBeCloseTo(at(180 - deg), 1);
  });
});
