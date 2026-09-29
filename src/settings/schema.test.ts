import { describe, expect, it } from 'vitest';
import {
  defaults,
  fromSlider,
  groups,
  isVisible,
  migrate,
  sanitize,
  schema,
  settingsFromJson,
  settingsToJson,
  SLIDER_RESOLUTION,
  toSlider,
  type Param,
  type RangeParam,
} from './schema';

describe('settings files', () => {
  it('round-trips settings and stamps the version', () => {
    const s = { ...defaults(), arms: 5, mode: 'globe' as const, armColors: ['#ff00ff'] };
    const text = settingsToJson(s);
    expect(JSON.parse(text).version).toBeGreaterThanOrEqual(2);
    expect(settingsFromJson(text)).toEqual(s);
  });

  it('fills in settings the file lacks and clamps bad values', () => {
    const s = settingsFromJson(JSON.stringify({ arms: 999 }));
    expect(s.arms).toBe((schema.find((p) => p.key === 'arms') as RangeParam).max);
    expect(s.density).toBe(defaults().density);
  });

  it('rejects files that are not settings', () => {
    expect(() => settingsFromJson('not json')).toThrow(/valid JSON/);
    expect(() => settingsFromJson('[1, 2]')).toThrow(/any HypnoGenerator settings/);
    expect(() => settingsFromJson('{"name": "something else"}')).toThrow(/any HypnoGenerator settings/);
  });
});

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

  it('only shows mode-specific controls for the modes they affect', () => {
    const find = (key: string) => (schema as readonly Param[]).find((p) => p.key === key)!;
    const s = defaults();
    expect(isVisible(find('exponent'), { ...s, mode: 'power' })).toBe(true);
    expect(isVisible(find('exponent'), { ...s, mode: 'archimedean' })).toBe(false);
    expect(isVisible(find('arms'), { ...s, mode: 'concentric' })).toBe(false);
    expect(isVisible(find('arms'), { ...s, mode: 'logarithmic' })).toBe(true);
    expect(isVisible(find('density'), { ...s, mode: 'concentric' })).toBe(true);
  });

  it('only references real settings and values in showIf', () => {
    for (const p of schema as readonly Param[]) {
      for (const [key, allowed] of Object.entries(p.showIf ?? {})) {
        const target = (schema as readonly Param[]).find((q) => q.key === key);
        expect(['select', 'toggle']).toContain(target?.type);
        const values =
          target?.type === 'select' ? target.options.map((o) => o.value) : target?.type === 'toggle' ? ['true', 'false'] : [];
        for (const v of allowed) expect(values).toContain(v);
      }
    }
  });

  it('survives non-object input', () => {
    expect(sanitize(null)).toEqual(defaults());
    expect(sanitize('garbage')).toEqual(defaults());
  });

  describe('curved sliders', () => {
    const curved = (schema as readonly Param[]).filter((p): p is RangeParam => p.type === 'range' && !!p.curve);
    const zoom = curved.find((p) => p.key === 'zoom')!;

    it('reaches both ends of the range', () => {
      for (const p of curved) {
        expect(fromSlider(p, 0)).toBe(p.min);
        expect(fromSlider(p, SLIDER_RESOLUTION)).toBe(p.max);
      }
    });

    it('snaps values to the step', () => {
      for (const p of curved) {
        for (let pos = 0; pos <= SLIDER_RESOLUTION; pos += 37) {
          const steps = fromSlider(p, pos) / p.step;
          expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
        }
      }
    });

    it('round-trips values through the slider position', () => {
      for (const p of curved) {
        expect(fromSlider(p, toSlider(p, p.default))).toBeCloseTo(p.default, 1);
      }
    });

    it('puts 1× zoom in the middle of a log slider', () => {
      expect(toSlider(zoom, 1)).toBe(SLIDER_RESOLUTION / 2);
    });
  });
});

describe('menu layout', () => {
  it('keeps each section of a tab in one piece (no section split by another)', () => {
    for (const g of groups) {
      const seen = new Set<string>();
      let last: string | undefined;
      for (const p of (schema as readonly Param[]).filter((q) => q.group === g)) {
        if (p.section && p.section !== last) {
          expect(seen.has(p.section), `${g} → ${p.section} appears twice`).toBe(false);
          seen.add(p.section);
        }
        last = p.section;
      }
    }
  });
});
