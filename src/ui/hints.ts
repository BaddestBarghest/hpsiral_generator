import type { Settings } from '../settings/schema';

/**
 * Situation-dependent warnings shown under a control, for settings whose effect depends on
 * other settings (e.g. how many colours a colour mode can actually show).
 */

type Band = 'arm' | 'gap' | 's2';

interface BandInfo {
  colors: string[];
  mode: Settings['armColorMode'];
  shift: number;
  arms: number;
  concentric: boolean;
  noun: string;
}

function band(s: Settings, b: Band): BandInfo {
  if (b === 's2') {
    return { colors: s.s2Colors, mode: s.s2ColorMode, shift: s.s2Shift, arms: s.s2Arms, concentric: s.s2Mode === 'concentric', noun: 'arms' };
  }
  const arm = b === 'arm';
  return {
    colors: arm ? s.armColors : s.gapColors,
    mode: arm ? s.armColorMode : s.gapColorMode,
    shift: arm ? s.armShift : s.gapShift,
    arms: s.arms,
    concentric: s.mode === 'concentric',
    noun: arm ? 'arms' : 'gaps',
  };
}

const MODE_KEYS: Record<string, Band> = { armColorMode: 'arm', gapColorMode: 'gap', s2ColorMode: 's2' };
export const SHIFT_KEYS: Record<Band, 'armShift' | 'gapShift' | 's2Shift'> = { arm: 'armShift', gap: 'gapShift', s2: 's2Shift' };

/** Warning for the control `key`, or null when everything will show as expected. */
export function hintFor(key: string, s: Settings): string | null {
  const which = MODE_KEYS[key];
  if (!which) return null;
  const { colors, mode, shift, arms, concentric, noun } = band(s, which);
  const n = colors.length;
  if (n < 2) return null;
  const a = Math.round(arms);
  if (mode === 'static' && !concentric && a < n) {
    return `Only ${a} of your ${n} colours fit: each of the ${a} ${noun} keeps one colour. Use ${n} or more arms, or pick Gradient or Kaleidoscopic to see them all.`;
  }
  if (mode === 'cycle' && shift === 0) {
    return 'Set a colour shift speed above 0 to cycle; at 0 the first colour stays.';
  }
  return null;
}

/** When switching a band to "cycle" with no shift speed, give it one so it actually cycles. */
export function autoShiftFor(key: string, value: unknown, s: Settings): Partial<Settings> | null {
  const which = MODE_KEYS[key];
  if (!which || value !== 'cycle') return null;
  const shiftKey = SHIFT_KEYS[which];
  return s[shiftKey] === 0 ? { [shiftKey]: 0.25 } : null;
}
