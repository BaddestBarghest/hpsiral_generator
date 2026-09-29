export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function averageRgb(colors: RGB[]): RGB {
  const sum: RGB = [0, 0, 0];
  for (const c of colors) for (let i = 0; i < 3; i++) sum[i] += c[i];
  return sum.map((x) => x / Math.max(1, colors.length)) as RGB;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/**
 * sRGB (0..1) → OKLab. Palette blends happen in OKLab (the shader converts back), so
 * red → blue passes through purple instead of a muddy grey (Björn Ottosson's OKLab).
 */
export function srgbToOklab([r, g, b]: RGB): RGB {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → sRGB (0..1, clamped); the inverse of srgbToOklab, mirrored in the scene shader. */
export function oklabToSrgb([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((c) => Math.min(1, Math.max(0, toGamma(Math.max(0, c))))) as RGB;
}

/** sRGB (0..1) → OKLCh: lightness, chroma, hue (radians). The palette is uploaded in this form. */
export function srgbToOklch(c: RGB): RGB {
  const [L, a, b] = srgbToOklab(c);
  return [L, Math.hypot(a, b), Math.atan2(b, a)];
}

/** Samples per palette colour in a palette strip (the shader interpolates linearly between them). */
export const PALETTE_SAMPLES = 32;
/** A strip holds this many palette colours: lcm(1, 2, 3), so any palette repeats evenly in it. */
export const PALETTE_CYCLE = 6;

/** Blend of two OKLCh colours at t (hue the short way round; greys take the other's hue). */
export function mixOklch(a: RGB, b: RGB, t: number): RGB {
  const ha = a[1] < 0.02 ? b[2] : a[2];
  const hb = b[1] < 0.02 ? a[2] : b[2];
  let dh = hb - ha;
  dh -= 2 * Math.PI * Math.floor((dh + Math.PI) / (2 * Math.PI));
  const h = ha + dh * t;
  const c = a[1] + (b[1] - a[1]) * t;
  return oklabToSrgb([a[0] + (b[0] - a[0]) * t, c * Math.cos(h), c * Math.sin(h)]);
}

/**
 * One palette as a strip of RGBA8 texels: PALETTE_CYCLE colours' worth (the palette repeated),
 * PALETTE_SAMPLES texels per colour, each colour at the start of its run and blended in OKLCh
 * towards the next. Blending here once, instead of per pixel, keeps the shader cheap.
 */
export function paletteStrip(colors: RGB[], out: Uint8Array, offset = 0): void {
  const lch = colors.map(srgbToOklch);
  for (let j = 0; j < PALETTE_CYCLE * PALETTE_SAMPLES; j++) {
    const k = Math.floor(j / PALETTE_SAMPLES);
    const t = (j % PALETTE_SAMPLES) / PALETTE_SAMPLES;
    const n = colors.length;
    const c = t === 0 ? colors[k % n] : mixOklch(lch[k % n], lch[(k + 1) % n], t);
    const o = offset + j * 4;
    out[o] = Math.round(c[0] * 255);
    out[o + 1] = Math.round(c[1] * 255);
    out[o + 2] = Math.round(c[2] * 255);
    out[o + 3] = 255;
  }
}
