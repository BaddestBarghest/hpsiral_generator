import { describe, expect, it } from 'vitest';
import { defaults, sanitize, schema, type Param } from './schema';

describe('schema', () => {
  it('has unique keys', () => {
    const keys = schema.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has valid defaults', () => {
    for (const p of schema as readonly Param[]) {
      if (p.type === 'range') {
        expect(p.default).toBeGreaterThanOrEqual(p.min);
        expect(p.default).toBeLessThanOrEqual(p.max);
      }
      if (p.type === 'select') expect(p.options.map((o) => o.value)).toContain(p.default);
      if (p.type === 'palette') expect(p.default.length).toBeGreaterThanOrEqual(p.minColors);
    }
    expect(sanitize(defaults())).toEqual(defaults());
  });

  it('sanitizes bad input to defaults or clamped values', () => {
    const s = sanitize({
      arms: 999,
      density: 'abc',
      mode: 'not-a-mode',
      mirror: 'yes',
      palette: ['#FF0000', 'red', 42, '#00ff00'],
      unknownKey: 1,
    });
    expect(s.arms).toBe(16);
    expect(s.density).toBe(defaults().density);
    expect(s.mode).toBe(defaults().mode);
    expect(s.mirror).toBe(false);
    expect(s.palette).toEqual(['#ff0000', '#00ff00']);
    expect(s).not.toHaveProperty('unknownKey');
  });

  it('rejects palettes that are too short', () => {
    expect(sanitize({ palette: ['#123456'] }).palette).toEqual(defaults().palette);
  });

  it('survives non-object input', () => {
    expect(sanitize(null)).toEqual(defaults());
    expect(sanitize('garbage')).toEqual(defaults());
  });
});
