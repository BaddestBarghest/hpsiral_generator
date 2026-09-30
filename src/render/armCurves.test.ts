import { describe, expect, it } from 'vitest';
import { defaults } from '../settings/schema';
import { ARM_CURVE_CODES, ARM_CURVES, armRadial, armShape, type ArmShape } from './armCurves';

const shapes: ArmShape[] = [
  { curve: 'linear', a: 0, b: 0 },
  { curve: 'power', a: 0.4, b: 0 },
  { curve: 'power', a: 1.8, b: 0 },
  { curve: 'exponential', a: 3, b: 0 },
  { curve: 'ripple', a: 0.95, b: 5 },
];

describe('arm curves', () => {
  it('keep the old patterns', () => {
    expect(armRadial({ curve: 'linear', a: 0, b: 0 }, 0.7, 0.1)).toBeCloseTo(0.6);
    expect(armRadial({ curve: 'logarithmic', a: 0, b: 0 }, Math.E, 0)).toBeCloseTo(0.5);
    expect(armRadial({ curve: 'power', a: 0.5, b: 0 }, 0.25, 0)).toBeCloseTo(0.5);
    expect(armRadial({ curve: 'inverse', a: 0, b: 0 }, 0.5, 0)).toBeCloseTo(-1);
  });

  it('start at 0 at the centre', () => {
    for (const shape of shapes) expect(armRadial(shape, 0.2, 0.2)).toBeCloseTo(0, 12);
  });

  it('never wind backwards', () => {
    for (const shape of shapes) {
      let prev = -Infinity;
      for (let rho = 0.01; rho < 2; rho += 0.001) {
        const v = armRadial(shape, rho, 0);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it('match the shader codes', () => {
    // scene.frag.glsl: 0 linear, 1 logarithmic, 2 power, 3 inverse, 4 exponential, 5 ripple.
    expect(ARM_CURVES.map((c) => ARM_CURVE_CODES[c.value])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ARM_CURVE_CODES.exponential).toBe(4);
  });

  it('take each spiral’s own parameters', () => {
    const s = { ...defaults(), armCurve: 'ripple' as const, rippleAmount: 0.3, rippleCount: 4, s2ArmCurve: 'power' as const, s2Exponent: 1.5 };
    expect(armShape(s, false)).toEqual({ curve: 'ripple', a: 0.3, b: 4 });
    expect(armShape(s, true)).toEqual({ curve: 'power', a: 1.5, b: 0 });
  });
});
