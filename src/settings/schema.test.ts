import { describe, expect, it } from 'vitest';
import { defaults, migrate, sanitize, schema, type Param } from './schema';

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
      armColors: ['#FF0000', 'red', 42, '#00ff00'],
      armColorMode: 'rainbow',
      unknownKey: 1,
    });
    expect(s.arms).toBe(16);
    expect(s.density).toBe(defaults().density);
    expect(s.mode).toBe(defaults().mode);
    expect(s.mirror).toBe(false);
    expect(s.armColors).toEqual(['#ff0000', '#00ff00']);
    expect(s.armColorMode).toBe('static');
    expect(s).not.toHaveProperty('unknownKey');
  });

  it('caps colour lists at 3 and rejects empty ones', () => {
    expect(sanitize({ gapColors: ['#111111', '#222222', '#333333', '#444444'] }).gapColors).toHaveLength(3);
    expect(sanitize({ gapColors: [] }).gapColors).toEqual(defaults().gapColors);
  });

  it('migrates the old single palette to arm and gap colours', () => {
    const s = sanitize(migrate({ palette: ['#FFFFFF', '#000000', '#7c3aed'], colorMode: 'bands', arms: 3 }));
    expect(s.armColors).toEqual(['#ffffff']);
    expect(s.gapColors).toEqual(['#000000']);
    expect(s.arms).toBe(3);
    expect(s).not.toHaveProperty('palette');
  });

  it('survives non-object input', () => {
    expect(sanitize(null)).toEqual(defaults());
    expect(sanitize('garbage')).toEqual(defaults());
  });
});
