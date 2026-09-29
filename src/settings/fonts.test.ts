import { describe, expect, it } from 'vitest';
import { FONT_CATEGORIES, FONTS } from './fonts';
import { FONT_FILES } from '../render/fontFiles';
import { defaults, sanitize } from './schema';

describe('fonts', () => {
  it('has a file for every font, and a bold file exactly when it claims bold', () => {
    for (const f of FONTS) {
      expect(FONT_FILES[f.id][400], f.id).toBeTruthy();
      expect(Boolean(FONT_FILES[f.id][700]), f.id).toBe(f.bold);
    }
    expect(Object.keys(FONT_FILES).sort()).toEqual(FONTS.map((f) => f.id).sort());
  });

  it('uses unique ids and known categories', () => {
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
    for (const f of FONTS) expect(FONT_CATEGORIES).toContain(f.category);
  });

  it('keeps the original font ids valid for saved settings', () => {
    for (const id of ['sans', 'serif', 'mono', 'impact']) expect(sanitize({ textFont: id }).textFont).toBe(id);
    expect(sanitize({ textFont: 'comic-sans' }).textFont).toBe(defaults().textFont);
  });
});
