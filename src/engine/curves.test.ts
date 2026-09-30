import { describe, expect, it } from 'vitest';
import { CURVE_SHAPES, curveAt, curveIntegral, curveMean, type Curve } from './curves';

const curve = (shape: Curve['shape'], peak = 0.5, sharpness = 0.5): Curve => ({ shape, sharpness, peak });
const SHAPES = CURVE_SHAPES.map((o) => o.value);

describe('curves', () => {
  it('keep the original smooth (sine) and linear shapes', () => {
    for (const f of [0.1, 0.25, 0.41, 0.7]) {
      expect(curveAt(curve('smooth'), f)).toBeCloseTo(0.5 - 0.5 * Math.cos(2 * Math.PI * f), 9);
      expect(curveAt(curve('linear'), f)).toBeCloseTo(1 - Math.abs(2 * f - 1), 9);
    }
    expect(curveMean(curve('smooth'))).toBeCloseTo(0.5, 9);
    expect(curveMean(curve('linear'))).toBeCloseTo(0.5, 9);
  });

  for (const shape of SHAPES) {
    it(`${shape}: runs from 0 at the ends to 1 at the peak, every cycle`, () => {
      expect(curveAt(curve(shape), 0)).toBeCloseTo(0);
      expect(curveAt(curve(shape), 0.5)).toBeCloseTo(1);
      expect(curveAt(curve(shape), 1)).toBeCloseTo(0);
      expect(curveAt(curve(shape), 3.5)).toBeCloseTo(1);
    });

    it(`${shape}: moving the peak keeps the mean`, () => {
      const early = curve(shape, 0.25);
      expect(curveAt(early, 0.25)).toBeCloseTo(1);
      expect(curveMean(early)).toBeCloseTo(curveMean(curve(shape)), 12);
    });

    it(`${shape}: integrates to the mean over whole cycles, however it's split`, () => {
      const c = curve(shape, 0.3, 0.8);
      expect(curveIntegral(c, 3)).toBeCloseTo(3 * curveMean(c), 12);
      // Summing small steps telescopes to the same total whatever the step size.
      const sum = (step: number, to: number) => {
        let total = 0;
        for (let x = 0; x < to - 1e-12; x += step) total += curveIntegral(c, Math.min(to, x + step)) - curveIntegral(c, x);
        return total;
      };
      expect(sum(1 / 7, 2.3)).toBeCloseTo(sum(1 / 240, 2.3), 9);
    });
  }

  it('sharper peaks spend less time high', () => {
    for (const shape of ['gaussian', 'exponential'] as const) {
      expect(curveMean(curve(shape, 0.5, 1))).toBeLessThan(curveMean(curve(shape, 0.5, 0)));
    }
  });
});
