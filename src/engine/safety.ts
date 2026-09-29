import type { Settings } from '../settings/schema';

/**
 * Photosensitivity limit shared by every flashing effect. WCAG 2.3.1 allows no more than
 * three flashes in any one-second period, counting all sources together: beat flashes,
 * inversions (a full-screen luminance flip) and the "flash when text appears".
 */
export const MAX_SAFE_FLASHES_PER_SECOND = 3;

/** Beat effects are never slowed past one pulse per this many beats. */
const MAX_PERIOD_BEATS = 64;

export interface FlashPlan {
  /** Beats between beat flashes (the chosen rate, doubled as needed). */
  flashBeats: number;
  /** Beats between inversions (likewise). */
  invertBeats: number;
  /** Beats between beat-locked colour steps (likewise). */
  colorBeats: number;
  /** Whether the text flash may fire. */
  textFlash: boolean;
}

/** Seconds between phrases (whether timed in seconds or synced to beats). */
export function textSlotSeconds(s: Settings): number {
  return s.textSync === 'off' ? s.textInterval : (Number(s.textSync) * 60) / s.bpm;
}

/** Text flashes per second if allowed, or 0 when the text flash is off. */
function textFlashRate(s: Settings): number {
  if (!s.textEnabled || !s.textFlash || s.textPhrases.trim() === '') return 0;
  return 1 / textSlotSeconds(s);
}

/** Whether any colour band actually changes when colours step on the beat. */
export function colorStepsActive(s: Settings): boolean {
  if (!s.colorStep) return false;
  const shifting = (colors: string[], speed: number) => colors.length > 1 && speed > 0;
  return shifting(s.armColors, s.armShift) || shifting(s.gapColors, s.gapShift) || (s.s2Enabled && shifting(s.s2Colors, s.s2Shift));
}

type BeatEffect = 'flashBeats' | 'invertBeats' | 'colorBeats';

/**
 * Fits every flashing effect into the shared budget unless the user unlocked faster
 * flashing. Beat effects (flashes, inversions, colour steps) skip beats (their period
 * doubles, so they stay on the beat grid), fastest first. The text flash is kept if it fits
 * alongside them, even when that means slowing them further; otherwise it's switched off.
 */
export function flashPlan(s: Settings): FlashPlan {
  const chosen: Record<BeatEffect, number> = {
    flashBeats: Number(s.flashRate),
    invertBeats: Number(s.invertRate),
    colorBeats: Number(s.colorStepRate),
  };
  const active: Record<BeatEffect, boolean> = {
    flashBeats: s.flashMode !== 'off',
    invertBeats: s.invertEnabled,
    colorBeats: colorStepsActive(s),
  };
  const text = textFlashRate(s);
  if (s.flashUnlock) return { ...chosen, textFlash: text > 0 };

  const bps = s.bpm / 60;
  const effects = Object.keys(chosen) as BeatEffect[];
  const fit = (budget: number): FlashPlan | null => {
    const beats = { ...chosen };
    const rate = (e: BeatEffect) => (active[e] ? bps / beats[e] : 0);
    for (;;) {
      if (effects.reduce((sum, e) => sum + rate(e), 0) <= budget + 1e-9) return { ...beats, textFlash: false };
      // Slow the fastest effect that can still be slowed.
      const slowable = effects.filter((e) => active[e] && beats[e] < MAX_PERIOD_BEATS);
      if (slowable.length === 0) return null;
      const fastest = slowable.reduce((a, b) => (rate(b) > rate(a) ? b : a));
      beats[fastest] *= 2;
    }
  };

  if (text > 0 && text <= MAX_SAFE_FLASHES_PER_SECOND) {
    const withText = fit(MAX_SAFE_FLASHES_PER_SECOND - text);
    if (withText) return { ...withText, textFlash: true };
  }
  // At the slowest beat periods the beat effects always fit on their own.
  return fit(MAX_SAFE_FLASHES_PER_SECOND)!;
}
