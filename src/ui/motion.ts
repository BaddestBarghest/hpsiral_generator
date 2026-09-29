// UI animation timing. Everything is short and subtle, and switched off entirely when the
// user's system asks for reduced motion.

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Duration for a UI transition: `ms`, or 0 with reduced motion. */
export const dur = (ms: number) => (reduceMotion ? 0 : ms);

/** Standard timings. */
export const FAST = 150;
export const MEDIUM = 220;
