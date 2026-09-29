// Outline shapes the spirals can be bent into (settings: `shape`). Most are simple formulas in
// the scene shader; outlines with no neat polar formula (the heart) are traced here once into
// a table of radii (one per direction) that the shader interpolates.

/** Directions in an outline table (evenly spaced, starting at +x, counter-clockwise). */
export const OUTLINE_SAMPLES = 128;

/**
 * Radius of a closed outline in each direction from the origin, scaled so the largest is 1.
 * The origin must see the whole outline (every direction meets it once). `point(t)` traces the
 * outline for t from 0 to 1.
 */
function outlineRadii(point: (t: number) => [number, number]): Float32Array {
  const radii = new Float32Array(OUTLINE_SAMPLES);
  const STEPS = 8192;
  for (let i = 0; i < STEPS; i++) {
    const [x, y] = point(i / STEPS);
    const bin = Math.round((Math.atan2(y, x) / (2 * Math.PI)) * OUTLINE_SAMPLES + OUTLINE_SAMPLES) % OUTLINE_SAMPLES;
    radii[bin] = Math.max(radii[bin], Math.hypot(x, y));
  }
  const max = Math.max(...radii);
  return radii.map((r) => r / max);
}

/**
 * The classic parametric heart (x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t),
 * seen from just below its dimple so every direction meets the outline once. Points down.
 */
export function heartRadii(): Float32Array {
  const cy = -3;
  return outlineRadii((u) => {
    const t = u * 2 * Math.PI;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [x, y - cy];
  });
}

