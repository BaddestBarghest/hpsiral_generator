import type { Settings } from '../settings/schema';

/**
 * Spiral arm curves: how the pattern advances with distance from the centre. Mirrors
 * `armRadial` in scene.frag.glsl (keep the two in step), for the preview and the uniforms.
 */

export const ARM_CURVES = [
  { value: 'linear', label: 'Linear (Archimedean)' },
  { value: 'logarithmic', label: 'Logarithmic' },
  { value: 'power', label: 'Power law' },
  { value: 'inverse', label: 'Inverse (tunnel)' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'ripple', label: 'Ripple' },
] as const;

export type ArmCurve = (typeof ARM_CURVES)[number]['value'];

/** Shader codes, in `ARM_CURVES` order. */
export const ARM_CURVE_CODES = Object.fromEntries(ARM_CURVES.map((c, i) => [c.value, i])) as Record<ArmCurve, number>;

/** One spiral's curve with its parameters (a: exponent, growth or ripple amount; b: ripples per unit). */
export interface ArmShape {
  curve: ArmCurve;
  a: number;
  b: number;
}

const TUNNEL_DEPTH = 0.5;

export function armRadial({ curve, a, b }: ArmShape, rho: number, c: number): number {
  switch (curve) {
    case 'logarithmic':
      return 0.5 * Math.log(rho);
    case 'power':
      return rho ** a - c ** a;
    case 'inverse':
      return -TUNNEL_DEPTH / rho;
    case 'exponential':
      return (Math.exp(a * rho) - Math.exp(a * c)) / a;
    case 'ripple': {
      const w = 2 * Math.PI * b;
      return rho - c + (a * (Math.sin(w * rho) - Math.sin(w * c))) / w;
    }
    default:
      return rho - c;
  }
}

/** The main spiral's (`s2` false) or the auxiliary spiral's arm shape. */
export function armShape(s: Settings, s2: boolean): ArmShape {
  const curve = s2 ? s.s2ArmCurve : s.armCurve;
  const pick = (main: number, aux: number) => (s2 ? aux : main);
  if (curve === 'power') return { curve, a: pick(s.exponent, s.s2Exponent), b: 0 };
  if (curve === 'exponential') return { curve, a: pick(s.curveGrowth, s.s2CurveGrowth), b: 0 };
  if (curve === 'ripple') return { curve, a: pick(s.rippleAmount, s.s2RippleAmount), b: pick(s.rippleCount, s.s2RippleCount) };
  return { curve, a: 0, b: 0 };
}
