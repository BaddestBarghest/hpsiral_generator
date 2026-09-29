import { describe, expect, it } from 'vitest';
import { hexToRgb, mixOklch, oklabToSrgb, PALETTE_CYCLE, PALETTE_SAMPLES, paletteStrip, srgbToOklab, srgbToOklch, type RGB } from './color';

const lchMid = (a: RGB, b: RGB) => mixOklch(srgbToOklch(a), srgbToOklch(b), 0.5);
const saturation = (c: RGB) => Math.max(...c) - Math.min(...c);

describe('OKLab / OKLCh', () => {
  it('round-trips sRGB colours', () => {
    for (const hex of ['#000000', '#ffffff', '#ff1744', '#00e5ff', '#76ff03', '#651fff', '#f5cb5c']) {
      const c = hexToRgb(hex);
      oklabToSrgb(srgbToOklab(c)).forEach((v, i) => expect(v).toBeCloseTo(c[i], 4));
    }
  });

  it('keeps blends between bright colours vivid, where plain RGB goes grey', () => {
    const yellow = hexToRgb('#ffea00');
    const blue = hexToRgb('#2979ff');
    const rgbMid = yellow.map((v, i) => (v + blue[i]) / 2) as RGB;
    expect(saturation(rgbMid)).toBeLessThan(0.25); // muddy
    expect(saturation(lchMid(yellow, blue))).toBeGreaterThan(0.7); // vivid
  });

  it('blends towards white or black without inventing a hue', () => {
    const mid = lchMid(hexToRgb('#ffffff'), hexToRgb('#000000'));
    expect(saturation(mid)).toBeLessThan(0.01);
  });

  it('builds palette strips with each colour exact at the start of its run, repeating', () => {
    const colors = ['#ff1744', '#2979ff'].map(hexToRgb);
    const strip = new Uint8Array(PALETTE_CYCLE * PALETTE_SAMPLES * 4);
    paletteStrip(colors, strip);
    const at = (k: number) => Array.from(strip.subarray(k * PALETTE_SAMPLES * 4, k * PALETTE_SAMPLES * 4 + 3));
    expect(at(0)).toEqual([255, 23, 68]);
    expect(at(1)).toEqual([41, 121, 255]);
    expect(at(4)).toEqual(at(0)); // 2 colours repeat 3 times across the 6-colour strip
  });
});
