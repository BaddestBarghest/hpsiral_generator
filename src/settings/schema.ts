// Single source of truth for every user-facing parameter.
// The UI, persistence/validation and renderer uniforms are all driven from this table.

import { BOLD_FONT_IDS, CUSTOM_FONT_ID, FONTS } from './fonts';
import { CURVE_SHAPES, type Curve } from '../engine/curves';
import { ARM_CURVES } from '../render/armCurves';

export type Group = 'Spiral' | 'Colour' | 'Aux. spiral' | 'Rhythm' | 'Text' | 'Display';

interface Base<K extends string> {
  key: K;
  label: string;
  group: Group;
  /** Optional sub-heading within the group; shown when it differs from the previous param's. */
  section?: string;
  help?: string;
  /** Always show the help (e.g. a safety warning) instead of hiding it behind the ⓘ. */
  helpAlways?: boolean;
  /**
   * Show the control only when each listed setting has one of the listed values; with a list
   * of conditions, when any of them holds.
   */
  showIf?: Condition | readonly Condition[];
}

const FONT_OPTIONS = [...FONTS.map((f) => ({ value: f.id, label: f.label })), { value: CUSTOM_FONT_ID, label: 'Your font' } as const];

/** Settings → the values any of which makes a condition hold. */
type Condition = Readonly<Record<string, readonly string[]>>;

/** Some colour list uses the kaleidoscopic mode (its sectors). */
const KALEIDO_IN_USE: readonly Condition[] = [{ armColorMode: ['kaleido'] }, { gapColorMode: ['kaleido'] }, { s2Enabled: ['true'], s2ColorMode: ['kaleido'] }];

/** Patterns with arms (everything but concentric rings). */
const SPIRAL_MODES = ['spiral', 'globe'] as const;
/** Patterns drawn from the outline shape, with centre spread and wobble (everything but the globe). */
const FLAT_MODES = ['spiral', 'concentric'] as const;

/**
 * For settings shared by both spirals (outline shape, centre spread, twist, wobble): shown
 * when the main spiral's pattern is one of `modes`, or the auxiliary spiral is on with one.
 */
const eitherSpiral = (modes: readonly string[], extra: Condition = {}): readonly Condition[] => [
  { ...extra, mode: modes },
  { ...extra, s2Enabled: ['true'], s2Mode: modes },
];
/** Shapes with a count (sides or points). */
const COUNTED_SHAPES = ['polygon', 'star'] as const;

export interface RangeParam<K extends string = string> extends Base<K> {
  type: 'range';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  /** Show a "Tap" button that sets the value from the rhythm of taps (BPM). */
  tapTempo?: boolean;
  /**
   * How the slider track maps to the value (linear by default). `log` suits multiplicative
   * settings (zoom, density, durations); `sq` gives the low end more room while keeping 0.
   */
  curve?: 'log' | 'sq';
  /** Can be animated with the beat (see `BeatLoop`); only for values the renderer reads per frame. */
  loopable?: boolean;
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
  { value: 'spiral', label: 'Spiral' },
  { value: 'concentric', label: 'Concentric circles' },
  { value: 'globe', label: 'Globe (3D)' },
] as const;

// Arm curve parameters (render/armCurves.ts), the same for both spirals.
const CURVE_HELP = 'How tightly the arms wind at each distance from the centre.';
const EXPONENT = { label: 'Exponent', type: 'range', min: 0.2, max: 2, step: 0.01, default: 0.4, help: 'Below 1 = tighter towards the centre; 1 = linear; above 1 = tighter towards the edge.' } as const;
const GROWTH = { label: 'Growth', type: 'range', min: 0.5, max: 4, step: 0.05, default: 2, help: 'How fast the arms wind tighter towards the edge.' } as const;
const RIPPLE_AMOUNT = { label: 'Ripple amount', type: 'range', min: 0, max: 0.95, step: 0.01, default: 0.6, help: 'How much the winding alternates between tight and loose.' } as const;
const RIPPLE_COUNT = { label: 'Ripples', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2, curve: 'log', help: 'Bands of tight and loose winding between the centre and the edge.' } as const;

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
  { key: 'mode', label: 'Pattern', group: 'Spiral', section: 'Shape', type: 'select', default: 'spiral', options: PATTERNS },
  { key: 'armCurve', label: 'Arm curve', group: 'Spiral', section: 'Shape', type: 'select', default: 'power', options: ARM_CURVES, help: CURVE_HELP, showIf: { mode: ['spiral'] } },
  { key: 'exponent', group: 'Spiral', section: 'Shape', ...EXPONENT, showIf: { mode: ['spiral'], armCurve: ['power'] } },
  { key: 'curveGrowth', group: 'Spiral', section: 'Shape', ...GROWTH, showIf: { mode: ['spiral'], armCurve: ['exponential'] } },
  { key: 'rippleAmount', group: 'Spiral', section: 'Shape', ...RIPPLE_AMOUNT, showIf: { mode: ['spiral'], armCurve: ['ripple'] } },
  { key: 'rippleCount', group: 'Spiral', section: 'Shape', ...RIPPLE_COUNT, showIf: { mode: ['spiral'], armCurve: ['ripple'] } },
  { key: 'globeTilt', label: 'Globe tilt', group: 'Spiral', section: 'Shape', type: 'range', min: -90, max: 90, step: 1, default: 29, unit: '°', help: 'Tips the globe’s spin axis towards you: 0 = seen side on, 90 = looking straight down at a pole. Applies to both spirals.', showIf: eitherSpiral(['globe']) },
  {
    key: 'shape', label: 'Shape', group: 'Spiral', section: 'Shape', type: 'select', default: 'round', help: 'Applies to both spirals (not to the globe).',
    showIf: eitherSpiral(FLAT_MODES),
    options: [
      { value: 'round', label: 'Round' },
      { value: 'polygon', label: 'Polygon' },
      { value: 'star', label: 'Star' },
      { value: 'heart', label: 'Heart' },
    ],
  },
  { key: 'sides', label: 'Count', group: 'Spiral', section: 'Shape', type: 'range', min: 3, max: 12, step: 1, default: 6, help: 'Sides of the polygon or points of the star.', showIf: eitherSpiral(FLAT_MODES, { shape: COUNTED_SHAPES }) },
  { key: 'shapeDepth', label: 'Depth', group: 'Spiral', section: 'Shape', type: 'range', min: 0.1, max: 0.8, step: 0.01, default: 0.45, help: 'How deep the star’s points cut in.', showIf: eitherSpiral(FLAT_MODES, { shape: ['star'] }) },
  { key: 'arms', label: 'Arms', group: 'Spiral', section: 'Shape', type: 'range', min: 1, max: 16, step: 1, default: 2, showIf: { mode: SPIRAL_MODES } },
  { key: 'density', label: 'Density', group: 'Spiral', section: 'Shape', type: 'range', min: 0.5, max: 30, step: 0.1, default: 10, curve: 'log' },
  { key: 'centerSpread', label: 'Center spread', group: 'Spiral', section: 'Shape', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0, help: 'Widens the stripes near the middle so they don’t bunch up. Applies to both spirals.', showIf: eitherSpiral(FLAT_MODES) },
  { key: 'centerTaper', label: 'Center taper', group: 'Spiral', section: 'Shape', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6, help: 'Thins the arms towards the middle. Higher = pointier core, 0 = constant width.' },
  { key: 'outerTaper', label: 'Outer taper', group: 'Spiral', section: 'Shape', type: 'range', min: 0, max: 1, step: 0.01, default: 0, help: 'Thins the arms towards the edge; at 1 they fade to nothing by the screen’s corners.' },
  { key: 'balance', label: 'Arm width', group: 'Spiral', section: 'Shape', type: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.5, help: 'Share of each cycle taken by the arm; the rest is the gap.' },
  { key: 'softness', label: 'Edge softness', group: 'Spiral', section: 'Shape', type: 'range', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'zoom', label: 'Zoom', group: 'Spiral', section: 'Shape', type: 'range', loopable: true, min: 0.25, max: 4, step: 0.01, default: 1, curve: 'log' },
  { key: 'mirror', label: 'Mirror (clockwise ↔ anticlockwise)', group: 'Spiral', section: 'Shape', type: 'toggle', default: false, showIf: { mode: SPIRAL_MODES } },
  { key: 'centerX', label: 'Horizontal position', group: 'Spiral', section: 'Position', type: 'range', loopable: true, min: -2, max: 2, step: 0.01, default: 0, help: 'Moves the centre of both spirals: negative left, positive right. Far enough out, only the edge of the pattern sweeps across the screen.' },
  { key: 'centerY', label: 'Vertical position', group: 'Spiral', section: 'Position', type: 'range', loopable: true, min: -2, max: 2, step: 0.01, default: 0, help: 'Negative moves the centre down, positive up.' },
  { key: 'rotation', label: 'Rotation', group: 'Spiral', section: 'Position', type: 'range', loopable: true, min: -180, max: 180, step: 1, default: 0, unit: '°', help: 'Turns both spirals (and their outline shape) anticlockwise, e.g. to stand a star on one point.' },
  { key: 'speed', label: 'Speed', group: 'Spiral', section: 'Motion', type: 'range', loopable: true, min: 0, max: 4, step: 0.01, default: 0.5, unit: 'cycles/s', curve: 'sq' },
  { key: 'direction', label: 'Direction', group: 'Spiral', section: 'Motion', type: 'select', default: 'inward', options: DIRECTIONS },
  { key: 'twist', label: 'Twist', group: 'Spiral', section: 'Motion', type: 'range', loopable: true, min: -3, max: 3, step: 0.01, default: 0, unit: 'turns', help: 'Bends the arms more the further out they are. Applies to both spirals.', showIf: eitherSpiral(['spiral']) },
  { key: 'wobble', label: 'Wobble', group: 'Spiral', section: 'Motion', type: 'range', min: 0, max: 1, step: 0.01, default: 0, help: 'Ripples the arms (or rings) sideways. Applies to both spirals.', showIf: eitherSpiral(FLAT_MODES) },
  { key: 'wobbleFreq', label: 'Wobble ripples', group: 'Spiral', section: 'Motion', type: 'range', min: 0.5, max: 12, step: 0.1, default: 3, curve: 'log', showIf: eitherSpiral(FLAT_MODES) },
  { key: 'wobbleSpeed', label: 'Wobble speed', group: 'Spiral', section: 'Motion', type: 'range', min: 0, max: 3, step: 0.01, default: 0.5, unit: 'cycles/s', curve: 'sq', showIf: eitherSpiral(FLAT_MODES) },
  { key: 'trails', label: 'Afterimage trails', group: 'Spiral', section: 'Afterimage', type: 'range', loopable: true, min: 0, max: 2, step: 0.01, default: 0, unit: 's', curve: 'sq', help: 'Leaves fading echoes of the spirals; the time is how long an echo takes to fade by half. Text has its own in the Text tab.' },

  // ── Colour ────────────────────────────────────────────────────────────
  // Colours never change the geometry: each cycle is one arm stripe + one gap,
  // and each band paints itself from its own colour list.
  { key: 'armColors', label: 'Colours', group: 'Colour', section: 'Arms', type: 'palette', minColors: 1, maxColors: MAX_BAND_COLORS, default: ['#ffffff'] },
  { key: 'armColorMode', label: 'Colour mode', group: 'Colour', section: 'Arms', type: 'select', default: 'static', options: COLOR_MODES, help: 'Only matters with 2 or more colours.' },
  { key: 'armShift', label: 'Colour shift speed', group: 'Colour', section: 'Arms', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 'cycles/s', curve: 'sq' },
  { key: 'gapColors', label: 'Colours', group: 'Colour', section: 'Gaps', type: 'palette', minColors: 1, maxColors: MAX_BAND_COLORS, default: ['#000000'] },
  { key: 'gapColorMode', label: 'Colour mode', group: 'Colour', section: 'Gaps', type: 'select', default: 'static', options: COLOR_MODES },
  { key: 'gapShift', label: 'Colour shift speed', group: 'Colour', section: 'Gaps', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 'cycles/s', curve: 'sq' },
  {
    key: 'gradientScale', label: 'Gradient scale', group: 'Colour', section: 'Gradient', type: 'range', min: 0.2, max: 6, step: 0.05, default: 1.5, curve: 'log',
    help: 'How quickly “Gradient along the arm” runs through the colours: higher = shorter gradients that repeat more often. Applies to every colour list set to Gradient.',
    showIf: [{ armColorMode: ['gradient'] }, { gapColorMode: ['gradient'] }, { s2Enabled: ['true'], s2ColorMode: ['gradient'] }],
  },
  {
    key: 'kaleidoSpin', label: 'Sector spin', group: 'Colour', section: 'Colour sectors', type: 'range', loopable: true, min: -0.5, max: 0.5, step: 0.01, default: 0, unit: 'turns/s',
    help: 'Turns the coloured slices made by the Kaleidoscopic colour mode around the centre; the stripes themselves don’t move. Negative turns them clockwise.',
    showIf: KALEIDO_IN_USE,
  },
  {
    key: 'kaleidoSectors', label: 'Sectors', group: 'Colour', section: 'Colour sectors', type: 'range', min: 2, max: 12, step: 1, default: 6,
    help: 'How many coloured slices go round the centre. A multiple of the number of colours keeps every slice next to a different colour.',
    showIf: KALEIDO_IN_USE,
  },
  { key: 'hueRoll', label: 'Hue roll speed', group: 'Colour', section: 'Hue', type: 'range', min: 0, max: 0.25, step: 0.001, default: 0, unit: 'rev/s', curve: 'sq', help: 'Rotates the hue of every colour.' },
  { key: 'glow', label: 'Strength', group: 'Colour', section: 'Glow', type: 'range', loopable: true, min: 0, max: 2, step: 0.01, default: 0, help: 'Soft light spilling from the bright parts of the spirals.' },
  { key: 'glowSize', label: 'Spread', group: 'Colour', section: 'Glow', type: 'range', loopable: true, min: 0.02, max: 0.3, step: 0.005, default: 0.08, curve: 'log', help: 'How far the light spreads.' },
  { key: 'glowColor', label: 'Colour', group: 'Colour', section: 'Glow', type: 'color', default: '#ffffff', help: 'White keeps each stripe’s own colour; other colours tint the glow.' },
  { key: 'vignette', label: 'Strength', group: 'Colour', section: 'Vignette', type: 'range', loopable: true, min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'vignetteSize', label: 'Size', group: 'Colour', section: 'Vignette', type: 'range', loopable: true, min: 0.2, max: 1.6, step: 0.01, default: 0.9 },
  { key: 'vignetteColor', label: 'Colour', group: 'Colour', section: 'Vignette', type: 'color', default: '#000000' },

  // ── Auxiliary spiral ──────────────────────────────────────────────────
  // A second pattern drawn over the first: arms only (its gaps are see-through).
  // Shares zoom, shape, centre spread/taper, softness, twist and wobble.
  { key: 's2Enabled', label: 'Show auxiliary spiral', group: 'Aux. spiral', type: 'toggle', default: false },
  { key: 's2Mode', label: 'Pattern', group: 'Aux. spiral', type: 'select', default: 'spiral', options: PATTERNS, showIf: { s2Enabled: ['true'] } },
  { key: 's2ArmCurve', label: 'Arm curve', group: 'Aux. spiral', type: 'select', default: 'linear', options: ARM_CURVES, help: CURVE_HELP, showIf: { s2Enabled: ['true'], s2Mode: ['spiral'] } },
  { key: 's2Exponent', group: 'Aux. spiral', ...EXPONENT, showIf: { s2Enabled: ['true'], s2Mode: ['spiral'], s2ArmCurve: ['power'] } },
  { key: 's2CurveGrowth', group: 'Aux. spiral', ...GROWTH, showIf: { s2Enabled: ['true'], s2Mode: ['spiral'], s2ArmCurve: ['exponential'] } },
  { key: 's2RippleAmount', group: 'Aux. spiral', ...RIPPLE_AMOUNT, showIf: { s2Enabled: ['true'], s2Mode: ['spiral'], s2ArmCurve: ['ripple'] } },
  { key: 's2RippleCount', group: 'Aux. spiral', ...RIPPLE_COUNT, showIf: { s2Enabled: ['true'], s2Mode: ['spiral'], s2ArmCurve: ['ripple'] } },
  { key: 's2Arms', label: 'Arms', group: 'Aux. spiral', type: 'range', min: 1, max: 16, step: 1, default: 1, showIf: { s2Enabled: ['true'], s2Mode: SPIRAL_MODES } },
  { key: 's2Density', label: 'Density', group: 'Aux. spiral', type: 'range', min: 0.5, max: 30, step: 0.1, default: 4, curve: 'log', showIf: { s2Enabled: ['true'] } },
  { key: 's2Width', label: 'Arm width', group: 'Aux. spiral', type: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.2, showIf: { s2Enabled: ['true'] } },
  { key: 's2Speed', label: 'Speed', group: 'Aux. spiral', type: 'range', loopable: true, min: 0, max: 4, step: 0.01, default: 0.3, unit: 'cycles/s', curve: 'sq', showIf: { s2Enabled: ['true'] } },
  { key: 's2Direction', label: 'Direction', group: 'Aux. spiral', type: 'select', default: 'outward', options: DIRECTIONS, showIf: { s2Enabled: ['true'] } },
  { key: 's2Mirror', label: 'Mirror (clockwise ↔ anticlockwise)', group: 'Aux. spiral', type: 'toggle', default: true, showIf: { s2Enabled: ['true'], s2Mode: SPIRAL_MODES } },
  { key: 's2Colors', label: 'Colours', group: 'Aux. spiral', section: 'Colour & blending', type: 'palette', minColors: 1, maxColors: MAX_BAND_COLORS, default: ['#f5cb5c'], showIf: { s2Enabled: ['true'] } },
  { key: 's2ColorMode', label: 'Colour mode', group: 'Aux. spiral', section: 'Colour & blending', type: 'select', default: 'static', options: COLOR_MODES, showIf: { s2Enabled: ['true'] } },
  { key: 's2Shift', label: 'Colour shift speed', group: 'Aux. spiral', section: 'Colour & blending', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 'cycles/s', curve: 'sq', showIf: { s2Enabled: ['true'] } },
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
  { key: 'invertLength', label: 'Length', group: 'Rhythm', section: 'Inversion', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.15, help: 'Share of each inversion period.', showIf: { invertEnabled: ['true'] } },
  { key: 'zoomPulse', label: 'Amount', group: 'Rhythm', section: 'Zoom pulse', type: 'range', min: 0, max: 0.5, step: 0.01, default: 0, help: 'Gently "breathes" the zoom in time, biggest on the beat.' },
  { key: 'zoomPulseRate', label: 'Rate', group: 'Rhythm', section: 'Zoom pulse', type: 'select', default: '2', options: PULSE_RATES },
  { key: 'colorStep', label: 'Step colours on the beat', group: 'Rhythm', section: 'Colour steps', type: 'toggle', default: false, help: 'Colour shifts jump to the next colour on the beat instead of flowing. Applies to every colour list with a shift speed above 0.' },
  { key: 'colorStepRate', label: 'Rate', group: 'Rhythm', section: 'Colour steps', type: 'select', default: '1', options: PULSE_RATES, showIf: { colorStep: ['true'] } },
  { key: 'flashUnlock', label: 'Allow more than 3 flashes per second', group: 'Rhythm', section: 'Safety', type: 'toggle', helpAlways: true, default: false, help: '⚠ Rapid flashing can trigger seizures. While off, beat flashes, inversions, colour steps and text flashes together stay at or below 3 per second: beat effects skip beats, and the text flash is dropped if it still doesn’t fit.' },

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
  { key: 'textInterval', label: 'Change every', group: 'Text', section: 'Timing', type: 'range', min: 0.2, max: 30, step: 0.1, default: 4, unit: 's', curve: 'log', showIf: { textEnabled: ['true'], textSync: ['off'] } },
  { key: 'textDuration', label: 'Show for', group: 'Text', section: 'Timing', type: 'range', min: 0.03, max: 30, step: 0.01, default: 2.5, unit: 's', curve: 'log', help: 'Under 0.1 s gives subliminal flashes. Never longer than the time between phrases.', showIf: { textEnabled: ['true'] } },
  {
    key: 'textAnimation', label: 'Animation', group: 'Text', section: 'Timing', type: 'select', default: 'fade', showIf: { textEnabled: ['true'] },
    options: [
      { value: 'none', label: 'None' },
      { value: 'fade', label: 'Fade in and out' },
      { value: 'zoom', label: 'Slow zoom' },
      { value: 'pop', label: 'Pop' },
    ],
  },
  {
    key: 'textLayout', label: 'Layout', group: 'Text', section: 'Layout', type: 'select', default: 'single', showIf: { textEnabled: ['true'] },
    help: 'A wall fills the screen with the phrase and moves its rows around each time a phrase appears; one copy always sits at the position below.',
    options: [
      { value: 'single', label: 'Single phrase' },
      { value: 'wall', label: 'Wall: repeated phrase' },
      { value: 'wallAlt', label: 'Wall: alternating phrases' },
    ],
  },
  { key: 'textWallDensity', label: 'Wall density', group: 'Text', section: 'Layout', type: 'range', min: 0.5, max: 2, step: 0.01, default: 1, curve: 'log', help: 'How closely the phrases are packed together; 2 is as tight as they go without overlapping.', showIf: { textEnabled: ['true'], textLayout: ['wall', 'wallAlt'] } },
  { key: 'textX', label: 'Horizontal position', group: 'Text', section: 'Layout', type: 'range', min: -0.8, max: 0.8, step: 0.01, default: 0, help: 'Negative moves it left, positive right.', showIf: { textEnabled: ['true'] } },
  { key: 'textY', label: 'Vertical position', group: 'Text', section: 'Layout', type: 'range', min: -0.8, max: 0.8, step: 0.01, default: 0, help: 'Negative moves it down, positive up.', showIf: { textEnabled: ['true'] } },
  { key: 'textFont', label: 'Font', group: 'Text', section: 'Look', type: 'select', picker: 'font', default: 'sans', options: FONT_OPTIONS, showIf: { textEnabled: ['true'] } },
  { key: 'textBold', label: 'Bold', group: 'Text', section: 'Look', type: 'toggle', default: true, showIf: { textEnabled: ['true'], textFont: BOLD_FONT_IDS } },
  { key: 'textUppercase', label: 'Uppercase', group: 'Text', section: 'Look', type: 'toggle', default: false, showIf: { textEnabled: ['true'] } },
  { key: 'textSize', label: 'Size', group: 'Text', section: 'Look', type: 'range', min: 0.03, max: 0.4, step: 0.005, default: 0.12, curve: 'log', showIf: { textEnabled: ['true'] } },
  { key: 'textColor', label: 'Colour', group: 'Text', section: 'Look', type: 'color', default: '#ffffff', showIf: { textEnabled: ['true'] } },
  { key: 'textOpacity', label: 'Opacity', group: 'Text', section: 'Look', type: 'range', min: 0, max: 1, step: 0.01, default: 1, showIf: { textEnabled: ['true'] } },
  { key: 'textOutline', label: 'Outline', group: 'Text', section: 'Outline & glow', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0, help: 'Keeps text readable over the stripes.', showIf: { textEnabled: ['true'] } },
  { key: 'textOutlineColor', label: 'Outline colour', group: 'Text', section: 'Outline & glow', type: 'color', default: '#000000', showIf: { textEnabled: ['true'] } },
  { key: 'textGlow', label: 'Glow', group: 'Text', section: 'Outline & glow', type: 'range', min: 0, max: 1, step: 0.01, default: 0, help: 'A soft halo around the letters.', showIf: { textEnabled: ['true'] } },
  { key: 'textGlowColor', label: 'Glow colour', group: 'Text', section: 'Outline & glow', type: 'color', default: '#ffffff', showIf: { textEnabled: ['true'] } },
  { key: 'textTrails', label: 'Afterimage trails', group: 'Text', section: 'Afterimage', type: 'range', min: 0, max: 2, step: 0.01, default: 0, unit: 's', curve: 'sq', help: 'Fading echoes of the text only, separate from the spirals’ afterimage.', showIf: { textEnabled: ['true'] } },
  { key: 'textFlash', label: 'Flash when text appears', group: 'Text', section: 'Flash', type: 'toggle', default: false, help: 'A short flash of the whole screen as each phrase appears. Shares the 3-per-second safety limit with beat flashes and inversions (Rhythm → Safety).', showIf: { textEnabled: ['true'] } },
  { key: 'textFlashColor', label: 'Colour', group: 'Text', section: 'Flash', type: 'color', default: '#ffffff', showIf: { textEnabled: ['true'], textFlash: ['true'] } },
  { key: 'textFlashLength', label: 'Length', group: 'Text', section: 'Flash', type: 'range', min: 0.03, max: 0.5, step: 0.01, default: 0.12, unit: 's', showIf: { textEnabled: ['true'], textFlash: ['true'] } },
  { key: 'textFlashIntensity', label: 'Intensity', group: 'Text', section: 'Flash', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7, showIf: { textEnabled: ['true'], textFlash: ['true'] } },

  // ── Display ───────────────────────────────────────────────────────────
  { key: 'renderScale', label: 'Render scale', group: 'Display', section: 'Live preview', type: 'range', min: 0.25, max: 1, step: 0.05, default: 1, help: 'Draws the preview at fewer pixels to run faster on slow devices. Exports always render at full quality.' },
  { key: 'maxDpr', label: 'Max pixel ratio', group: 'Display', section: 'Live preview', type: 'range', min: 1, max: 3, step: 0.25, default: 2 },
  {
    key: 'maxFps', label: 'Max FPS', group: 'Display', section: 'Live preview', type: 'select', default: '0',
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

type SchemaSettings = { -readonly [P in Entry as P['key']]: ValueOf<P> };

/** Settings that can be animated with the beat. */
export type LoopableKey = Extract<Entry, { loopable: true }>['key'];

/**
 * A setting animated with the beat: it runs from its own value (at the cycle's ends) to
 * `to` (at the curve's peak) and back, once every `beats` beats.
 */
export interface BeatLoop extends Curve {
  to: number;
  beats: number;
}

/** Cycle lengths offered for beat loops. At least 2 beats keeps them under 3 per second. */
export const LOOP_BEATS = [2, 4, 8, 16, 32, 64] as const;

export type BeatLoops = Partial<Record<LoopableKey, BeatLoop>>;

/** Every setting in the schema, plus the beat loops (which are stored per setting). */
export type Settings = SchemaSettings & { loops: BeatLoops };
export type SettingKey = keyof Settings;

export const groups: Group[] = ['Spiral', 'Colour', 'Aux. spiral', 'Rhythm', 'Text', 'Display'];

export function defaults(): Settings {
  const out: Record<string, unknown> = {};
  for (const p of schema as readonly Param[]) {
    out[p.key] = p.type === 'palette' ? [...p.default] : p.default;
  }
  out.loops = {};
  return out as Settings;
}

/** Range params that can be animated with the beat. */
export const loopableParams = (schema as readonly Param[]).filter((p): p is RangeParam => p.type === 'range' && !!p.loopable);

/** A new beat loop for `p` at `value`: a quarter of the slider away, towards the middle. */
export function newBeatLoop(p: RangeParam, value: number): BeatLoop {
  const pos = toSlider(p, value);
  const to = fromSlider(p, pos + (pos < SLIDER_RESOLUTION / 2 ? 1 : -1) * SLIDER_RESOLUTION * 0.25);
  return { to, shape: 'smooth', sharpness: 0.5, peak: 0.5, beats: 8 };
}

function sanitizeLoops(input: unknown): BeatLoops {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Record<string, BeatLoop> = {};
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  for (const p of loopableParams) {
    const l = src[p.key] as Record<string, unknown> | undefined;
    if (!l || typeof l !== 'object') continue;
    out[p.key] = {
      to: num(l.to, p.min, p.max, p.default),
      shape: CURVE_SHAPES.find((o) => o.value === l.shape)?.value ?? 'smooth',
      sharpness: num(l.sharpness, 0, 1, 0.5),
      peak: num(l.peak, 0.05, 0.95, 0.5),
      beats: LOOP_BEATS.find((b) => b === l.beats) ?? 8,
    };
  }
  return out;
}

/** Whether a control applies to the current settings (see `showIf`). */
export function isVisible(p: Param, s: Settings): boolean {
  if (!p.showIf) return true;
  const values = s as Record<string, unknown>;
  const holds = (c: Condition) => Object.entries(c).every(([key, allowed]) => allowed.includes(String(values[key])));
  return conditions(p).some(holds);
}

/** A param's `showIf` as a list of alternatives (empty when it has none). */
export const conditions = (p: Param): readonly Condition[] => (!p.showIf ? [] : Array.isArray(p.showIf) ? p.showIf : [p.showIf as Condition]);

/** Slider positions run 0..SLIDER_RESOLUTION for curved ranges. */
export const SLIDER_RESOLUTION = 1000;

/** Slider position (0..SLIDER_RESOLUTION) for a value of a range param. */
export function toSlider(p: RangeParam, value: number): number {
  const v = Math.min(p.max, Math.max(p.min, value));
  let t: number;
  if (p.curve === 'log') t = Math.log(v / p.min) / Math.log(p.max / p.min);
  else if (p.curve === 'sq') t = Math.sqrt((v - p.min) / (p.max - p.min));
  else t = (v - p.min) / (p.max - p.min);
  return Math.round(t * SLIDER_RESOLUTION);
}

/**
 * Value for a slider position, snapped to the param's step so values stay simple
 * fractions (seamless-loop planning relies on that).
 */
export function fromSlider(p: RangeParam, pos: number): number {
  const t = Math.min(1, Math.max(0, pos / SLIDER_RESOLUTION));
  let v: number;
  if (p.curve === 'log') v = p.min * Math.pow(p.max / p.min, t);
  else if (p.curve === 'sq') v = p.min + (p.max - p.min) * t * t;
  else v = p.min + (p.max - p.min) * t;
  const decimals = p.step >= 1 ? 0 : Math.ceil(-Math.log10(p.step) - 1e-9);
  const snapped = Number((Math.round(v / p.step) * p.step).toFixed(decimals));
  return Math.min(p.max, Math.max(p.min, snapped));
}

/**
 * Version stamped on saved settings, so a later change to what a setting means can convert
 * old values in `migrate`. Unversioned saves count as version 1: they may predate or follow
 * the 2026-09-29 change of `trails` to a half-life in seconds, so those values are kept as is.
 * Version 3 replaced the Rhythm tab's speed ramp with beat loops on the two speeds; version 4
 * turned the spiral patterns into one "spiral" pattern with an arm curve.
 */
export const SETTINGS_VERSION = 4;

/** Settings plus their version, as saved. */
export function withVersion(s: Settings): Settings & { version: number } {
  return { ...s, version: SETTINGS_VERSION };
}

/** Settings as saved (in a file, or in the browser), with their version. */
export function settingsToJson(s: Settings): string {
  return JSON.stringify(withVersion(s), null, 2);
}

/** Reads saved settings (older versions included); throws a readable Error when the text isn't settings. */
export function settingsFromJson(text: string): Settings {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a settings file (it isn't valid JSON).");
  }
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!obj || !(schema as readonly Param[]).some((p) => p.key in obj)) {
    throw new Error("That file doesn't contain any HypnoGenerator settings.");
  }
  return sanitize(migrate(obj));
}

/** Carries settings saved by older versions forward; run before `sanitize`. */
export function migrate(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  let raw = input as Record<string, unknown>;
  const version = typeof raw.version === 'number' ? raw.version : 1;
  // ≤0.1: one `palette` of alternating bands → first colour paints the arms, second the gaps.
  if (Array.isArray(raw.palette) && !('armColors' in raw)) {
    const [arm, gap] = raw.palette as unknown[];
    raw = { ...raw, armColors: [arm], gapColors: [gap ?? '#000000'] };
  }
  if (version < 3 && raw.rampEnabled === true) raw = migrateSpeedRamp(raw);
  if (version < 4) raw = migrateArmCurves(raw);
  return raw;
}

/** v4: spiral patterns became one "spiral" pattern with an arm curve each. */
const OLD_SPIRAL_PATTERNS: Record<string, string> = { archimedean: 'linear', logarithmic: 'logarithmic', power: 'power', tunnel: 'inverse' };

function migrateArmCurves(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  for (const [modeKey, curveKey] of [['mode', 'armCurve'], ['s2Mode', 's2ArmCurve']] as const) {
    const curve = OLD_SPIRAL_PATTERNS[String(raw[modeKey])];
    if (curve) {
      out[modeKey] = 'spiral';
      out[curveKey] = curve;
    }
  }
  // The auxiliary spiral used to share the main spiral's exponent.
  if ('exponent' in raw && !('s2Exponent' in raw)) out.s2Exponent = raw.exponent;
  return out;
}

/**
 * v3: the speed ramp (speed × a multiplier running from `rampMin` to `rampMax` and back, shared
 * by both spirals) becomes a beat loop on each speed, from speed × min to speed × max. The
 * old ramp settings are left for `sanitize` to drop.
 */
function migrateSpeedRamp(raw: Record<string, unknown>): Record<string, unknown> {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const min = num(raw.rampMin, 0.4);
  const max = num(raw.rampMax, 1.6);
  const rampBeats = num(raw.rampBeats, 16);
  // The ramp's cycle could be any whole number of beats; loops offer powers of two.
  const beats = LOOP_BEATS.reduce((best, b) => (Math.abs(Math.log(b / rampBeats)) < Math.abs(Math.log(best / rampBeats)) ? b : best));
  const curve = { shape: raw.rampShape ?? 'smooth', sharpness: raw.rampSharpness ?? 0.5, peak: raw.rampPeak ?? 0.5, beats };
  const loops = { ...(raw.loops && typeof raw.loops === 'object' ? raw.loops : {}) } as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw, loops };
  for (const [key, fallback] of [['speed', 0.5], ['s2Speed', 0.3]] as const) {
    const speed = num(raw[key], fallback);
    out[key] = speed * min;
    loops[key] = { ...curve, to: speed * max };
  }
  return out;
}

/** A `#rrggbb` colour (either case). */
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

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
          const colors = v.filter((c): c is string => typeof c === 'string' && HEX_COLOR.test(c)).slice(0, p.maxColors);
          if (colors.length >= p.minColors) out[p.key] = colors.map((c) => c.toLowerCase());
        }
        break;
      case 'color':
        if (typeof v === 'string' && HEX_COLOR.test(v)) out[p.key] = v.toLowerCase();
        break;
      case 'textarea':
        if (typeof v === 'string') out[p.key] = v.slice(0, p.maxLength);
        break;
    }
  }
  out.loops = sanitizeLoops(src.loops);
  return out as Settings;
}
