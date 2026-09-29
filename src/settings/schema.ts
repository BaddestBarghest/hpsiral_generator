// Single source of truth for every user-facing parameter.
// The UI, persistence/validation and renderer uniforms are all driven from this table.

export type Group = 'Spiral' | 'Colour' | 'Display';

interface Base<K extends string> {
  key: K;
  label: string;
  group: Group;
  /** Optional sub-heading within the group; shown when it differs from the previous param's. */
  section?: string;
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

/** Colours per band (arms or gaps). */
export const MAX_BAND_COLORS = 3;

const COLOR_MODES = [
  { value: 'static', label: 'Static (one colour per stripe)' },
  { value: 'gradient', label: 'Gradient along the arm' },
  { value: 'cycle', label: 'Cycle through colours' },
  { value: 'kaleido', label: 'Kaleidoscopic' },
] as const;

export const schema = [
  // ── Spiral ────────────────────────────────────────────────────────────
  {
    key: 'mode', label: 'Pattern', group: 'Spiral', type: 'select', default: 'power',
    options: [
      { value: 'archimedean', label: 'Archimedean spiral' },
      { value: 'logarithmic', label: 'Logarithmic spiral' },
      { value: 'power', label: 'Power-law spiral' },
      { value: 'concentric', label: 'Concentric circles' },
    ],
  },
  { key: 'arms', label: 'Arms', group: 'Spiral', type: 'range', min: 1, max: 16, step: 1, default: 2, help: 'Ignored for concentric circles.' },
  { key: 'density', label: 'Density', group: 'Spiral', type: 'range', min: 0.5, max: 30, step: 0.1, default: 10 },
  { key: 'exponent', label: 'Power-law exponent', group: 'Spiral', type: 'range', min: 0.2, max: 1.5, step: 0.01, default: 0.4, help: 'Power-law spiral only. Lower = tighter centre; 1 = Archimedean.' },
  { key: 'centerSpread', label: 'Center spread', group: 'Spiral', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0, help: 'Widens the stripes near the middle so they don’t bunch up.' },
  { key: 'centerTaper', label: 'Center taper', group: 'Spiral', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6, help: 'Thins the arms towards the middle. Higher = pointier core, 0 = constant width.' },
  { key: 'balance', label: 'Arm width', group: 'Spiral', type: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.5, help: 'Share of each cycle taken by the arm; the rest is the gap.' },
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
  // Colours never change the geometry: each cycle is one arm stripe + one gap,
  // and each band paints itself from its own colour list.
  { key: 'armColors', label: 'Colours', group: 'Colour', section: 'Arms', type: 'palette', minColors: 1, maxColors: MAX_BAND_COLORS, default: ['#ffffff'] },
  { key: 'armColorMode', label: 'Colour mode', group: 'Colour', section: 'Arms', type: 'select', default: 'static', options: COLOR_MODES, help: 'Only matters with 2 or more colours.' },
  { key: 'armShift', label: 'Colour shift speed', group: 'Colour', section: 'Arms', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 'cycles/s' },
  { key: 'gapColors', label: 'Colours', group: 'Colour', section: 'Gaps', type: 'palette', minColors: 1, maxColors: MAX_BAND_COLORS, default: ['#000000'] },
  { key: 'gapColorMode', label: 'Colour mode', group: 'Colour', section: 'Gaps', type: 'select', default: 'static', options: COLOR_MODES },
  { key: 'gapShift', label: 'Colour shift speed', group: 'Colour', section: 'Gaps', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 'cycles/s' },
  { key: 'hueRoll', label: 'Hue roll speed', group: 'Colour', section: 'Effects', type: 'range', min: 0, max: 1, step: 0.005, default: 0, unit: 'rev/s', help: 'Rotates the hue of every colour.' },

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

/** Carries settings saved by older versions forward; run before `sanitize`. */
export function migrate(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const raw = input as Record<string, unknown>;
  // ≤0.1: one `palette` of alternating bands → first colour paints the arms, second the gaps.
  if (Array.isArray(raw.palette) && !('armColors' in raw)) {
    const [arm, gap] = raw.palette as unknown[];
    return { ...raw, armColors: [arm], gapColors: [gap ?? '#000000'] };
  }
  return raw;
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
