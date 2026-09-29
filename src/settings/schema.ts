// Single source of truth for every user-facing parameter.
// The UI, persistence/validation and renderer uniforms are all driven from this table.

export type Group = 'Spiral' | 'Colour' | 'Display';

interface Base<K extends string> {
  key: K;
  label: string;
  group: Group;
  help?: string;
}

export interface RangeParam<K extends string = string> extends Base<K> {
  type: 'range';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface SelectParam<K extends string = string, V extends string = string> extends Base<K> {
  type: 'select';
  options: readonly { value: V; label: string }[];
  default: V;
}

export interface ToggleParam<K extends string = string> extends Base<K> {
  type: 'toggle';
  default: boolean;
}

export interface PaletteParam<K extends string = string> extends Base<K> {
  type: 'palette';
  minColors: number;
  maxColors: number;
  default: readonly string[];
}

export type Param = RangeParam | SelectParam | ToggleParam | PaletteParam;

export const MAX_PALETTE = 8;

export const schema = [
  // ── Spiral ────────────────────────────────────────────────────────────
  {
    key: 'mode', label: 'Pattern', group: 'Spiral', type: 'select', default: 'archimedean',
    options: [
      { value: 'archimedean', label: 'Archimedean spiral' },
      { value: 'logarithmic', label: 'Logarithmic spiral' },
      { value: 'concentric', label: 'Concentric circles' },
    ],
  },
  { key: 'arms', label: 'Arms', group: 'Spiral', type: 'range', min: 1, max: 16, step: 1, default: 2, help: 'Ignored for concentric circles.' },
  { key: 'density', label: 'Density', group: 'Spiral', type: 'range', min: 0.5, max: 30, step: 0.1, default: 6 },
  { key: 'centerSpread', label: 'Center spread', group: 'Spiral', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.1, help: 'Widens the stripes near the middle so they don’t bunch up.' },
  { key: 'balance', label: 'Stripe balance', group: 'Spiral', type: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.5, help: 'Width of the first colour band.' },
  { key: 'softness', label: 'Edge softness', group: 'Spiral', type: 'range', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'zoom', label: 'Zoom', group: 'Spiral', type: 'range', min: 0.25, max: 4, step: 0.01, default: 1 },
  { key: 'speed', label: 'Speed', group: 'Spiral', type: 'range', min: 0, max: 4, step: 0.01, default: 0.5, unit: 'cycles/s' },
  {
    key: 'direction', label: 'Direction', group: 'Spiral', type: 'select', default: 'inward',
    options: [
      { value: 'inward', label: 'Inward' },
      { value: 'outward', label: 'Outward' },
    ],
  },
  { key: 'mirror', label: 'Mirror (reverse twist)', group: 'Spiral', type: 'toggle', default: false },

  // ── Colour ────────────────────────────────────────────────────────────
  { key: 'palette', label: 'Palette', group: 'Colour', type: 'palette', minColors: 2, maxColors: MAX_PALETTE, default: ['#ffffff', '#000000'] },
  {
    key: 'colorMode', label: 'Colour mode', group: 'Colour', type: 'select', default: 'bands',
    options: [
      { value: 'bands', label: 'Solid bands' },
      { value: 'gradient', label: 'Smooth gradient' },
    ],
  },
  { key: 'hueRoll', label: 'Hue roll speed', group: 'Colour', type: 'range', min: 0, max: 1, step: 0.005, default: 0, unit: 'rev/s' },

  // ── Display ───────────────────────────────────────────────────────────
  { key: 'renderScale', label: 'Render scale', group: 'Display', type: 'range', min: 0.25, max: 1, step: 0.05, default: 1 },
  { key: 'maxDpr', label: 'Max pixel ratio', group: 'Display', type: 'range', min: 1, max: 3, step: 0.25, default: 2 },
  {
    key: 'maxFps', label: 'Max FPS', group: 'Display', type: 'select', default: '0',
    options: [
      { value: '0', label: 'Display refresh rate' },
      { value: '60', label: '60' },
      { value: '30', label: '30' },
    ],
  },
] as const satisfies readonly Param[];

type Schema = typeof schema;
type Entry = Schema[number];

type ValueOf<P> = P extends { type: 'range' } ? number
  : P extends { type: 'toggle' } ? boolean
  : P extends { type: 'palette' } ? string[]
  : P extends { type: 'select'; options: readonly { value: infer V }[] } ? V
  : never;

export type Settings = { -readonly [P in Entry as P['key']]: ValueOf<P> };
export type SettingKey = keyof Settings;

export const groups: Group[] = ['Spiral', 'Colour', 'Display'];

export function defaults(): Settings {
  const out: Record<string, unknown> = {};
  for (const p of schema as readonly Param[]) {
    out[p.key] = p.type === 'palette' ? [...p.default] : p.default;
  }
  return out as Settings;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Coerce arbitrary input (localStorage, imported JSON, URL) into valid Settings. Unknown keys are dropped. */
export function sanitize(input: unknown): Settings {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = defaults() as Record<string, unknown>;
  for (const p of schema as readonly Param[]) {
    const v = src[p.key];
    switch (p.type) {
      case 'range': {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
        if (Number.isFinite(n)) out[p.key] = Math.min(p.max, Math.max(p.min, n));
        break;
      }
      case 'toggle':
        if (typeof v === 'boolean') out[p.key] = v;
        break;
      case 'select':
        if (p.options.some((o) => o.value === v)) out[p.key] = v;
        break;
      case 'palette':
        if (Array.isArray(v)) {
          const colors = v.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, p.maxColors);
          if (colors.length >= p.minColors) out[p.key] = colors.map((c) => c.toLowerCase());
        }
        break;
    }
  }
  return out as Settings;
}
