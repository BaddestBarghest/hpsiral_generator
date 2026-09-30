import {
  DEVICE_KEYS,
  schema,
  type BeatLoop,
  type Look,
  type LoopableKey,
  type Param,
  type RangeParam,
  type Sequence,
  type Settings,
} from '../settings/schema';
import { hexToRgb, mixOklch, srgbToOklch } from '../render/color';
import { wrap } from './math';

/**
 * Scene sequences: saved looks shown in turn, each held for a while and then blended into the
 * next. Positions are in the sequence's unit (seconds or beats) and advance with the timeline,
 * so live playback and offline renders show the same thing at the same moment.
 */

/** The sequence is playing and has something to show. */
export const sequenceActive = (s: Settings) => s.sequence.enabled && s.sequence.scenes.length > 0;

/** Length of scene `i` including its fade into the next (the last one has none unless it loops). */
function sceneLength(seq: Sequence, i: number): number {
  const sc = seq.scenes[i];
  const fades = i < seq.scenes.length - 1 || seq.loop;
  return sc.hold + (fades ? sc.fade : 0);
}

/** Length of one pass through every scene, in the sequence's unit. */
export function sequenceLength(seq: Sequence): number {
  let total = 0;
  for (let i = 0; i < seq.scenes.length; i++) total += sceneLength(seq, i);
  return total;
}

/** Where scene `i` starts, in the sequence's unit. */
export function sceneStart(seq: Sequence, i: number): number {
  let start = 0;
  for (let k = 0; k < Math.min(i, seq.scenes.length); k++) start += sceneLength(seq, k);
  return start;
}

export interface SequencePlace {
  /** The scene showing (or being faded out of). */
  scene: number;
  /** The scene being faded into; equal to `scene` while holding. */
  next: number;
  /** Progress through the fade, 0..1 (0 while holding). */
  t: number;
}

/** Which scene shows at position `pos`. Looping sequences repeat; others stay on the last scene. */
export function sequencePlace(seq: Sequence, pos: number): SequencePlace {
  const n = seq.scenes.length;
  const total = sequenceLength(seq);
  if (n === 0 || total <= 0) return { scene: 0, next: 0, t: 0 };
  let p = seq.loop ? wrap(pos, total) : Math.max(0, pos);
  for (let i = 0; i < n; i++) {
    const { hold } = seq.scenes[i];
    const len = sceneLength(seq, i);
    if (p < hold) return { scene: i, next: i, t: 0 };
    if (p < len) return { scene: i, next: (i + 1) % n, t: (p - hold) / (len - hold) };
    p -= len;
  }
  return { scene: n - 1, next: n - 1, t: 0 };
}

/** Moves a sequence position on by `delta`, keeping it within one pass. */
export function advanceSequence(seq: Sequence, pos: number, delta: number): number {
  const total = sequenceLength(seq);
  if (total <= 0) return 0;
  return seq.loop ? wrap(pos + delta, total) : Math.min(total, pos + delta);
}

/** A scene's look with this device's display settings and the live sequence. */
function withLive(look: Look, live: Settings): Settings {
  const out = { ...look, sequence: live.sequence } as Record<string, unknown>;
  for (const key of DEVICE_KEYS) out[key] = live[key];
  return out as Settings;
}

/**
 * The settings to draw with at sequence position `pos`: the live settings when no sequence
 * plays, else the scene showing there (or a blend of two during a fade).
 */
export function resolveSequence(s: Settings, pos: number): Settings {
  if (!sequenceActive(s)) return s;
  const { scene, next, t } = sequencePlace(s.sequence, pos);
  const a = s.sequence.scenes[scene].look;
  if (t === 0 || scene === next) return withLive(a, s);
  return withLive(blendLooks(a, s.sequence.scenes[next].look, t), s);
}

/** Every scene's settings (just `s` when no sequence plays), e.g. to check whether any uses afterimages. */
export function sequenceLooks(s: Settings): Settings[] {
  return sequenceActive(s) ? s.sequence.scenes.map((sc) => withLive(sc.look, s)) : [s];
}

/** Seconds one pass of the sequence lasts (beats are converted at each scene's tempo). */
export function sequenceSeconds(s: Settings): number {
  const seq = s.sequence;
  if (seq.unit === 'seconds') return sequenceLength(seq);
  const n = seq.scenes.length;
  let seconds = 0;
  for (let i = 0; i < n; i++) {
    const a = seq.scenes[i];
    seconds += (a.hold * 60) / a.look.bpm;
    const fade = sceneLength(seq, i) - a.hold;
    if (fade <= 0) continue;
    // The tempo changes during the fade: add up small slices at their own tempo.
    const b = seq.scenes[(i + 1) % n].look;
    const SLICES = 32;
    for (let k = 0; k < SLICES; k++) {
      const bpm = a.look.bpm + (b.bpm - a.look.bpm) * ease((k + 0.5) / SLICES);
      seconds += (fade / SLICES) * (60 / bpm);
    }
  }
  return seconds;
}

// ── Blending ────────────────────────────────────────────────────────────────

const params = schema as readonly Param[];
const keysWhere = (test: (p: Param) => boolean) => params.filter(test).map((p) => p.key);

/** Counts that can't be in between (half an arm breaks the pattern): they switch half-way. */
const WHOLE_NUMBERS = new Set(['arms', 's2Arms', 'sides', 'kaleidoSectors']);

/**
 * Effects that are off on one side of a fade. Their settings are taken from the side where
 * they're on, and only their strength (`level`) fades, so e.g. the auxiliary spiral fades in
 * as it is instead of morphing from hidden settings.
 */
const DORMANT: { on?: keyof Look; level: keyof Look; keys: string[] }[] = [
  { on: 's2Enabled', level: 's2Opacity', keys: keysWhere((p) => p.group === 'Aux. spiral') },
  { on: 'textEnabled', level: 'textOpacity', keys: keysWhere((p) => p.group === 'Text') },
  { on: 'flashMode', level: 'flashIntensity', keys: keysWhere((p) => p.group === 'Rhythm' && p.section === 'Flash') },
  { level: 'glow', keys: ['glowSize', 'glowColor'] },
  { level: 'vignette', keys: ['vignetteSize', 'vignetteColor'] },
  { level: 'zoomPulse', keys: ['zoomPulseRate'] },
];

function isDormant(look: Look, d: (typeof DORMANT)[number]): boolean {
  if (d.on) {
    const v = look[d.on];
    return v === false || v === 'off';
  }
  return look[d.level] === 0 && !look.loops[d.level as LoopableKey];
}

/** `look` with every effect it has off but `other` has on set up as `other`'s, at strength 0. */
function wakeDormant(look: Look, other: Look): Look {
  let out = look;
  for (const d of DORMANT) {
    if (!isDormant(look, d) || isDormant(other, d)) continue;
    const copy: Record<string, unknown> = { ...out };
    for (const key of d.keys) copy[key] = other[key as keyof Look];
    copy[d.level] = 0;
    out = copy as Look;
  }
  return out;
}

/** Smooth start and end, so settings don't lurch into or out of a fade. */
const ease = (t: number) => t * t * (3 - 2 * t);

function mixNumber(p: RangeParam, a: number, b: number, t: number): number {
  if (a === b) return a;
  // Multiplicative settings (zoom, density) glide evenly on their own scale.
  return p.curve === 'log' ? a * Math.pow(b / a, t) : a + (b - a) * t;
}

const toHex = (rgb: readonly number[]) => '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');

export function mixColor(a: string, b: string, t: number): string {
  if (a === b) return a;
  return toHex(mixOklch(srgbToOklch(hexToRgb(a)), srgbToOklch(hexToRgb(b)), t));
}

/**
 * Blends two colour lists. A list repeated to a multiple of its length looks the same, so
 * 1 ↔ 2 and 1 ↔ 3 colours blend colour by colour; 2 ↔ 3 can't, and switches half-way.
 */
function mixPalette(a: string[], b: string[], t: number): string[] {
  const n = Math.max(a.length, b.length);
  if (n % a.length !== 0 || n % b.length !== 0) return t < 0.5 ? a : b;
  return Array.from({ length: n }, (_, i) => mixColor(a[i % a.length], b[i % b.length], t));
}

/** A beat loop that doesn't move: its peak is the setting's own value. */
const stillLoop = (like: BeatLoop, value: number): BeatLoop => ({ ...like, to: value });

/** Blends two looks' beat loops; a loop on one side only grows from (or shrinks to) nothing. */
function mixLoops(a: Look, b: Look, t: number): Look['loops'] {
  const out: Look['loops'] = {};
  const keys = new Set([...Object.keys(a.loops), ...Object.keys(b.loops)]) as Set<LoopableKey>;
  for (const key of keys) {
    const p = params.find((q) => q.key === key) as RangeParam;
    const la = a.loops[key] ?? stillLoop(b.loops[key]!, a[key]);
    const lb = b.loops[key] ?? stillLoop(a.loops[key]!, b[key]);
    const late = t >= 0.5 ? lb : la;
    out[key] = {
      to: mixNumber(p, la.to, lb.to, t),
      shape: late.shape,
      sharpness: la.sharpness + (lb.sharpness - la.sharpness) * t,
      peak: la.peak + (lb.peak - la.peak) * t,
      beats: late.beats,
    };
  }
  return out;
}

/**
 * The look `t` (0..1) of the way through a fade from `a` to `b`. Numbers and colours glide;
 * choices (pattern, shape, font, phrases…) switch half-way.
 */
export function blendLooks(a: Look, b: Look, t: number): Look {
  const from = wakeDormant(a, b);
  const to = wakeDormant(b, a);
  const k = ease(Math.min(1, Math.max(0, t)));
  const out: Record<string, unknown> = {};
  for (const p of params) {
    const x = from[p.key as keyof Look];
    const y = to[p.key as keyof Look];
    switch (p.type) {
      case 'range':
        out[p.key] = WHOLE_NUMBERS.has(p.key) ? (k < 0.5 ? x : y) : mixNumber(p, x as number, y as number, k);
        break;
      case 'color':
        out[p.key] = mixColor(x as string, y as string, k);
        break;
      case 'palette':
        out[p.key] = mixPalette(x as string[], y as string[], k);
        break;
      default:
        out[p.key] = k < 0.5 ? x : y;
    }
  }
  out.loops = mixLoops(from, to, k);
  return out as Look;
}
