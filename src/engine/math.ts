/** Small numeric helpers shared by the engine and renderer. */

/** Greatest common divisor of two non-negative integers. */
export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Least common multiple of two positive integers. */
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** Fractional part, in [0, 1) also for negative numbers. */
export const fract = (x: number) => x - Math.floor(x);

/** `x` wrapped into [0, period). */
export const wrap = (x: number, period: number) => x - Math.floor(x / period) * period;
