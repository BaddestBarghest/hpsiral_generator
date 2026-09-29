// Single source of truth for every user-facing parameter.
// The UI, persistence/validation and renderer uniforms are all driven from this table.

import { BOLD_FONT_IDS, FONTS } from './fonts';

export type Group = 'Spiral' | 'Colour' | 'Aux. spiral' | 'Rhythm' | 'Text' | 'Output';

interface Base<K extends string> {
  key: K;
  label: string;
  group: Group;
  /** Optional sub-heading within the group; shown when it differs from the previous param's. */
  section?: string;
  help?: string;
  /** Show the control only when each listed setting has one of the listed values. */
  showIf?: Readonly<Record<string, readonly string[]>>;
}

const FONT_OPTIONS = FONTS.map((f) => ({ value: f.id, label: f.label }));

const SPIRAL_MODES = ['archimedean', 'logarithmic', 'power'] as const;

export interface RangeParam<K extends string = string> extends Base<K> {
  type: 'range';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  /** Show a "Tap" button that sets the value from the rhythm of taps (BPM). */
  tapTempo?: boolean;
}

export interface SelectParam<K extends string = string, V extends string = string> extends Base<K> {
  type: 'select';
  options: readonly { value: V; label: string }[];
  default: V;
  /** Render as a visual picker instead of a drop-down. */
  picker?: 'font';
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

export interface ColorParam<K extends string = string> extends Base<K> {
  type: 'color';
  default: string;
}

export interface TextareaParam<K extends string = string> extends Base<K> {
  type: 'textarea';
  default: string;
  rows: number;
  maxLength: number;
}

export type Param = RangeParam | SelectParam | ToggleParam | PaletteParam | ColorParam | TextareaParam;

/** Colours per band (arms or gaps). */
export const MAX_BAND_COLORS = 3;

const PATTERNS = [
  { value: 'archimedean', label: 'Archimedean spiral' },
  { value: 'logarithmic', label: 'Logarithmic spiral' },
  { value: 'power', label: 'Power-law spiral' },
  { value: 'concentric', label: 'Concentric circles' },
] as const;

const DIRECTIONS = [
  { value: 'inward', label: 'Inward' },
  { value: 'outward', label: 'Outward' },
] as const;

/** Pulse periods in beats (strings so they work as select values). */
const PULSE_RATES = [
  { value: '0.25', label: '4× per beat' },
  { value: '0.5', label: '2× per beat' },
  { value: '1', label: 'Every beat' },
  { value: '2', label: 'Every 2 beats' },
  { value: '4', label: 'Every 4 beats' },
] as const;

const COLOR_MODES = [
  { value: 'static', label: 'Static (one colour per stripe)' },
  { value: 'gradient', label: 'Gradient along the arm' },
  { value: 'cycle', label: 'Cycle through colours' },
  { value: 'kaleido', label: 'Kaleidoscopic' },
] as const;

export const schema = [
  // ── Spiral ────────────────────────────────────────────────────────────
  { key: 'mode', label: 'Pattern', group: 'Spiral', type: 'select', default: 'power', options: PATTERNS },
  {
    key: 'shape', label: 'Shape', group: 'Spiral', type: 'select', default: 'round', help: 'Applies to both spirals.',
    options: [
      { value: 'round', label: 'Round' },
      { value: 'polygon', label: 'Polygon' },
    ],
  },
  { key: 'sides', label: 'Sides', group: 'Spiral', type: 'range', min: 3, max: 12, step: 1, default: 6, showIf: { shape: ['polygon'] } },
  { key: 'arms', label: 'Arms', group: 'Spiral', type: 'range', min: 1, max: 16, step: 1, default: 2, showIf: { mode: SPIRAL_MODES } },
  { key: 'density', label: 'Density', group: 'Spiral', type: 'range', min: 0.5, max: 30, step: 0.1, default: 10 },
  { key: 'exponent', label: 'Power-law exponent', group: 'Spiral', type: 'range', min: 0.2, max: 1.5, step: 0.01, default: 0.4, help: 'Lower = tighter centre; 1 = Archimedean.', showIf: { mode: ['power'] } },
  { key: 'centerSpread', label: 'Center spread', group: 'Spiral', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0, help: 'Widens the stripes near the middle so they don’t bunch up.' },
  { key: 'centerTaper', label: 'Center taper', group: 'Spiral', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6, help: 'Thins the arms towards the middle. Higher = pointier core, 0 = constant width.' },
  { key: 'balance', label: 'Arm width', group: 'Spiral', type: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.5, help: 'Share of each cycle taken by the arm; the rest is the gap.' },
  { key: 'softness', label: 'Edge softness', group: 'Spiral', type: 'range', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'zoom', label: 'Zoom', group: 'Spiral', type: 'range', min: 0.25, max: 4, step: 0.01, default: 1 },
  { key: 'speed', label: 'Speed', group: 'Spiral', type: 'range', min: 0, max: 4, step: 0.01, default: 0.5, unit: 'cycles/s' },
  { key: 'direction', label: 'Direction', group: 'Spiral', type: 'select', default: 'inward', options: DIRECTIONS },
  { key: 'mirror', label: 'Mirror (reverse twist)', group: 'Spiral', type: 'toggle', default: false, showIf: { mode: SPIRAL_MODES } },
  { key: 'twist', label: 'Twist', group: 'Spiral', section: 'Motion', type: 'range', min: -3, max: 3, step: 0.01, default: 0, unit: 'turns', help: 'Bends the arms more the further out they are.' },
  { key: 'wobble', label: 'Wobble', group: 'Spiral', section: 'Motion', type: 'range', min: 0, max: 1, step: 0.01, default: 0, help: 'Ripples the arms sideways.' },
  { key: 'wobbleFreq', label: 'Wobble ripples', group: 'Spiral', section: 'Motion', type: 'range', min: 0.5, max: 12, step: 0.1, default: 3 },
  { key: 'wobbleSpeed', label: 'Wobble speed', group: 'Spiral', section: 'Motion', type: 'range', min: 0, max: 3, step: 0.01, default: 0.5, unit: 'cycles/s' },

  // ── Colour ────────────────────────────────────────────────────────────
  // Colours never change the geometry: each cycle is one arm stripe + one gap,
  // and each band paints itself from its own colour list.
  { key: 'armColors', label: 'Colours', group: 'Colour', section: 'Arms', type: 'palette', minColors: 1, maxColors: MAX_BAND_COLORS, default: ['#ffffff'] },
  { key: 'armColorMode', label: 'Colour mode', group: 'Colour', section: 'Arms', type: 'select', default: 'static', options: COLOR_MODES, help: 'Only matters with 2 or more colours.' },
  { key: 'armShift', label: 'Colour shift speed', group: 'Colour', section: 'Arms', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 'cycles/s' },
  { key: 'gapColors', label: 'Colours', group: 'Colour', section: 'Gaps', type: 'palette', minColors: 1, maxColors: MAX_BAND_COLORS, default: ['#000000'] },
  { key: 'gapColorMode', label: 'Colour mode', group: 'Colour', section: 'Gaps', type: 'select', default: 'static', options: COLOR_MODES },
  { key: 'gapShift', label: 'Colour shift speed', group: 'Colour', section: 'Gaps', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 'cycles/s' },
  { key: 'hueRoll', label: 'Hue roll speed', group: 'Colour', section: 'Hue', type: 'range', min: 0, max: 1, step: 0.005, default: 0, unit: 'rev/s', help: 'Rotates the hue of every colour.' },
  { key: 'trails', label: 'Afterimage trails', group: 'Colour', section: 'Afterimage', type: 'range', min: 0, max: 0.95, step: 0.01, default: 0, help: 'Leaves fading echoes of previous frames.' },
  { key: 'vignette', label: 'Strength', group: 'Colour', section: 'Vignette', type: 'range', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'vignetteSize', label: 'Size', group: 'Colour', section: 'Vignette', type: 'range', min: 0.2, max: 1.6, step: 0.01, default: 0.9 },
  { key: 'vignetteColor', label: 'Colour', group: 'Colour', section: 'Vignette', type: 'color', default: '#000000' },

  // ── Auxiliary spiral ──────────────────────────────────────────────────
  // A second pattern drawn over the first: arms only (its gaps are see-through).
  // Shares zoom, shape, exponent, centre spread/taper, softness, twist and wobble.
  { key: 's2Enabled', label: 'Show auxiliary spiral', group: 'Aux. spiral', type: 'toggle', default: false },
  { key: 's2Mode', label: 'Pattern', group: 'Aux. spiral', type: 'select', default: 'archimedean', options: PATTERNS, showIf: { s2Enabled: ['true'] } },
  { key: 's2Arms', label: 'Arms', group: 'Aux. spiral', type: 'range', min: 1, max: 16, step: 1, default: 1, showIf: { s2Enabled: ['true'], s2Mode: SPIRAL_MODES } },
  { key: 's2Density', label: 'Density', group: 'Aux. spiral', type: 'range', min: 0.5, max: 30, step: 0.1, default: 4, showIf: { s2Enabled: ['true'] } },
  { key: 's2Width', label: 'Arm width', group: 'Aux. spiral', type: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.2, showIf: { s2Enabled: ['true'] } },
  { key: 's2Speed', label: 'Speed', group: 'Aux. spiral', type: 'range', min: 0, max: 4, step: 0.01, default: 0.3, unit: 'cycles/s', showIf: { s2Enabled: ['true'] } },
  { key: 's2Direction', label: 'Direction', group: 'Aux. spiral', type: 'select', default: 'outward', options: DIRECTIONS, showIf: { s2Enabled: ['true'] } },
  { key: 's2Mirror', label: 'Mirror (reverse twist)', group: 'Aux. spiral', type: 'toggle', default: true, showIf: { s2Enabled: ['true'], s2Mode: SPIRAL_MODES } },
  { key: 's2Colors', label: 'Colours', group: 'Aux. spiral', section: 'Colour & blending', type: 'palette', minColors: 1, maxColors: MAX_BAND_COLORS, default: ['#f5cb5c'], showIf: { s2Enabled: ['true'] } },
  { key: 's2ColorMode', label: 'Colour mode', group: 'Aux. spiral', section: 'Colour & blending', type: 'select', default: 'static', options: COLOR_MODES, showIf: { s2Enabled: ['true'] } },
  { key: 's2Shift', label: 'Colour shift speed', group: 'Aux. spiral', section: 'Colour & blending', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 'cycles/s', showIf: { s2Enabled: ['true'] } },
  { key: 's2Opacity', label: 'Opacity', group: 'Aux. spiral', section: 'Colour & blending', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8, showIf: { s2Enabled: ['true'] } },
  {
    key: 's2Blend', label: 'Blend mode', group: 'Aux. spiral', section: 'Colour & blending', type: 'select', default: 'normal', showIf: { s2Enabled: ['true'] },
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'add', label: 'Add (lighten)' },
      { value: 'multiply', label: 'Multiply (darken)' },
      { value: 'screen', label: 'Screen' },
      { value: 'difference', label: 'Difference (invert)' },
    ],
  },

  // ── Rhythm ────────────────────────────────────────────────────────────
  // Everything here follows the master tempo; see engine/rhythm.ts.
  { key: 'bpm', label: 'Beats per minute', group: 'Rhythm', section: 'Tempo', type: 'range', min: 30, max: 240, step: 1, default: 120, tapTempo: true },
  { key: 'rampEnabled', label: 'Vary speed with the beat', group: 'Rhythm', section: 'Speed ramp', type: 'toggle', default: false, help: 'Speeds both spirals up and down over a cycle of beats.' },
  { key: 'rampMin', label: 'Slowest', group: 'Rhythm', section: 'Speed ramp', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0.4, unit: '× speed', showIf: { rampEnabled: ['true'] } },
  { key: 'rampMax', label: 'Fastest', group: 'Rhythm', section: 'Speed ramp', type: 'range', min: 0.5, max: 4, step: 0.05, default: 1.6, unit: '× speed', showIf: { rampEnabled: ['true'] } },
  { key: 'rampBeats', label: 'Cycle length', group: 'Rhythm', section: 'Speed ramp', type: 'range', min: 2, max: 64, step: 1, default: 16, unit: 'beats', showIf: { rampEnabled: ['true'] } },
  {
    key: 'rampShape', label: 'Curve', group: 'Rhythm', section: 'Speed ramp', type: 'select', default: 'smooth', showIf: { rampEnabled: ['true'] },
    options: [
      { value: 'smooth', label: 'Smooth' },
      { value: 'linear', label: 'Linear' },
    ],
  },
  {
    key: 'flashMode', label: 'Mode', group: 'Rhythm', section: 'Flash', type: 'select', default: 'off',
    options: [
      { value: 'off', label: 'Off' },
      { value: 'soft', label: 'Soft flash (fades out)' },
      { value: 'strobe', label: 'Strobe (hard on/off)' },
    ],
  },
  { key: 'flashRate', label: 'Rate', group: 'Rhythm', section: 'Flash', type: 'select', default: '1', options: PULSE_RATES, showIf: { flashMode: ['soft', 'strobe'] } },
  { key: 'flashLength', label: 'Length', group: 'Rhythm', section: 'Flash', type: 'range', min: 0.05, max: 0.9, step: 0.01, default: 0.3, help: 'Share of each flash period.', showIf: { flashMode: ['soft', 'strobe'] } },
  { key: 'flashIntensity', label: 'Intensity', group: 'Rhythm', section: 'Flash', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6, showIf: { flashMode: ['soft', 'strobe'] } },
  { key: 'flashColor', label: 'Colour', group: 'Rhythm', section: 'Flash', type: 'color', default: '#ffffff', showIf: { flashMode: ['soft', 'strobe'] } },
  { key: 'invertEnabled', label: 'Invert colours on the beat', group: 'Rhythm', section: 'Inversion', type: 'toggle', default: false },
  { key: 'invertRate', label: 'Rate', group: 'Rhythm', section: 'Inversion', type: 'select', default: '4', options: PULSE_RATES, showIf: { invertEnabled: ['true'] } },
  { key: 'invertLength', label: 'Length', group: 'Rhythm', section: 'Inversion', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.15, showIf: { invertEnabled: ['true'] } },
  { key: 'zoomPulse', label: 'Amount', group: 'Rhythm', section: 'Zoom pulse', type: 'range', min: 0, max: 0.5, step: 0.01, default: 0, help: 'Gently "breathes" the zoom in time.' },
  { key: 'zoomPulseRate', label: 'Rate', group: 'Rhythm', section: 'Zoom pulse', type: 'select', default: '2', options: PULSE_RATES },
  { key: 'flashUnlock', label: 'Allow more than 3 flashes per second', group: 'Rhythm', section: 'Safety', type: 'toggle', default: false, help: '⚠ Rapid flashing can trigger seizures. While off, flashes and inversions skip beats to stay at or below 3 per second.' },

  // ── Text ──────────────────────────────────────────────────────────────
  // Timed phrases; see engine/text.ts.
  { key: 'textEnabled', label: 'Show text', group: 'Text', section: 'Phrases', type: 'toggle', default: false },
  { key: 'textPhrases', label: 'Phrases (one per line)', group: 'Text', section: 'Phrases', type: 'textarea', rows: 6, maxLength: 4000, default: 'Relax\nBreathe in\nBreathe out\nLet go\nFocus on the centre', showIf: { textEnabled: ['true'] } },
  {
    key: 'textOrder', label: 'Order', group: 'Text', section: 'Phrases', type: 'select', default: 'sequence', showIf: { textEnabled: ['true'] },
    options: [
      { value: 'sequence', label: 'In order' },
      { value: 'shuffle', label: 'Shuffled' },
    ],
  },
  {
    key: 'textSync', label: 'Change phrases', group: 'Text', section: 'Timing', type: 'select', default: 'off', showIf: { textEnabled: ['true'] },
    options: [
      { value: 'off', label: 'On a timer' },
      { value: '1', label: 'Every beat' },
      { value: '2', label: 'Every 2 beats' },
      { value: '4', label: 'Every 4 beats' },
      { value: '8', label: 'Every 8 beats' },
      { value: '16', label: 'Every 16 beats' },
    ],
  },
  { key: 'textInterval', label: 'Change every', group: 'Text', section: 'Timing', type: 'range', min: 0.2, max: 30, step: 0.1, default: 4, unit: 's', showIf: { textEnabled: ['true'], textSync: ['off'] } },
  { key: 'textDuration', label: 'Show for', group: 'Text', section: 'Timing', type: 'range', min: 0.03, max: 30, step: 0.01, default: 2.5, unit: 's', help: 'Under 0.1 s gives subliminal flashes. Never longer than the time between phrases.', showIf: { textEnabled: ['true'] } },
  {
    key: 'textAnimation', label: 'Animation', group: 'Text', section: 'Timing', type: 'select', default: 'fade', showIf: { textEnabled: ['true'] },
    options: [
      { value: 'none', label: 'None' },
      { value: 'fade', label: 'Fade in and out' },
      { value: 'zoom', label: 'Slow zoom' },
      { value: 'pop', label: 'Pop' },
    ],
  },
  { key: 'textFont', label: 'Font', group: 'Text', section: 'Style', type: 'select', picker: 'font', default: 'sans', options: FONT_OPTIONS, showIf: { textEnabled: ['true'] } },
  { key: 'textBold', label: 'Bold', group: 'Text', section: 'Style', type: 'toggle', default: true, showIf: { textEnabled: ['true'], textFont: BOLD_FONT_IDS } },
  { key: 'textUppercase', label: 'Uppercase', group: 'Text', section: 'Style', type: 'toggle', default: false, showIf: { textEnabled: ['true'] } },
  { key: 'textSize', label: 'Size', group: 'Text', section: 'Style', type: 'range', min: 0.03, max: 0.4, step: 0.005, default: 0.12, showIf: { textEnabled: ['true'] } },
  { key: 'textY', label: 'Vertical position', group: 'Text', section: 'Style', type: 'range', min: -0.8, max: 0.8, step: 0.01, default: 0, help: 'Negative moves it down, positive up.', showIf: { textEnabled: ['true'] } },
  { key: 'textColor', label: 'Colour', group: 'Text', section: 'Style', type: 'color', default: '#ffffff', showIf: { textEnabled: ['true'] } },
  { key: 'textOpacity', label: 'Opacity', group: 'Text', section: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 1, showIf: { textEnabled: ['true'] } },
  { key: 'textOutline', label: 'Outline', group: 'Text', section: 'Style', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0, help: 'Keeps text readable over the stripes.', showIf: { textEnabled: ['true'] } },
  { key: 'textOutlineColor', label: 'Outline colour', group: 'Text', section: 'Style', type: 'color', default: '#000000', showIf: { textEnabled: ['true'] } },
  { key: 'textFlash', label: 'Flash when text appears', group: 'Text', section: 'Flash', type: 'toggle', default: false, help: 'A short flash of the whole screen as each phrase appears. Limited to 3 per second unless unlocked in Rhythm → Safety.', showIf: { textEnabled: ['true'] } },
  { key: 'textFlashColor', label: 'Colour', group: 'Text', section: 'Flash', type: 'color', default: '#ffffff', showIf: { textEnabled: ['true'], textFlash: ['true'] } },
  { key: 'textFlashLength', label: 'Length', group: 'Text', section: 'Flash', type: 'range', min: 0.03, max: 0.5, step: 0.01, default: 0.12, unit: 's', showIf: { textEnabled: ['true'], textFlash: ['true'] } },
  { key: 'textFlashIntensity', label: 'Intensity', group: 'Text', section: 'Flash', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7, showIf: { textEnabled: ['true'], textFlash: ['true'] } },

  // ── Display ───────────────────────────────────────────────────────────
  { key: 'renderScale', label: 'Render scale', group: 'Output', section: 'Display', type: 'range', min: 0.25, max: 1, step: 0.05, default: 1 },
  { key: 'maxDpr', label: 'Max pixel ratio', group: 'Output', section: 'Display', type: 'range', min: 1, max: 3, step: 0.25, default: 2 },
  {
    key: 'maxFps', label: 'Max FPS', group: 'Output', section: 'Display', type: 'select', default: '0',
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
  : P extends { type: 'color' } ? string
  : P extends { type: 'textarea' } ? string
  : P extends { type: 'select'; options: readonly { value: infer V }[] } ? V
  : never;

export type Settings = { -readonly [P in Entry as P['key']]: ValueOf<P> };
export type SettingKey = keyof Settings;

export const groups: Group[] = ['Spiral', 'Colour', 'Aux. spiral', 'Rhythm', 'Text', 'Output'];

export function defaults(): Settings {
  const out: Record<string, unknown> = {};
  for (const p of schema as readonly Param[]) {
    out[p.key] = p.type === 'palette' ? [...p.default] : p.default;
  }
  return out as Settings;
}

/** Whether a control applies to the current settings (see `showIf`). */
export function isVisible(p: Param, s: Settings): boolean {
  if (!p.showIf) return true;
  const values = s as Record<string, unknown>;
  return Object.entries(p.showIf).every(([key, allowed]) => allowed.includes(String(values[key])));
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
      case 'color':
        if (typeof v === 'string' && HEX.test(v)) out[p.key] = v.toLowerCase();
        break;
      case 'textarea':
        if (typeof v === 'string') out[p.key] = v.slice(0, p.maxLength);
        break;
    }
  }
  return out as Settings;
}
