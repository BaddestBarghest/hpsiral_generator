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

/**
 * Fits every flashing effect into the shared budget unless the user unlocked faster
 * flashing. Beat flashes and inversions skip beats (their period doubles, so they stay on
 * the beat grid), fastest first. The text flash is kept if it fits alongside them, even
 * when that means slowing them further; otherwise it's the one switched off.
 */
export function flashPlan(s: Settings): FlashPlan {
  const flashRate = Number(s.flashRate);
  const invertRate = Number(s.invertRate);
  const text = textFlashRate(s);
  if (s.flashUnlock) return { flashBeats: flashRate, invertBeats: invertRate, textFlash: text > 0 };

  const bps = s.bpm / 60;
  const fit = (budget: number): FlashPlan | null => {
    let flashBeats = flashRate;
    let invertBeats = invertRate;
    for (;;) {
      const f = s.flashMode !== 'off' ? bps / flashBeats : 0;
      const i = s.invertEnabled ? bps / invertBeats : 0;
      if (f + i <= budget + 1e-9) return { flashBeats, invertBeats, textFlash: false };
      // Slow the faster effect that can still be slowed.
      const canF = f > 0 && flashBeats < MAX_PERIOD_BEATS;
      const canI = i > 0 && invertBeats < MAX_PERIOD_BEATS;
      if (canF && (!canI || f >= i)) flashBeats *= 2;
      else if (canI) invertBeats *= 2;
      else return null;
    }
  };

  if (text > 0 && text <= MAX_SAFE_FLASHES_PER_SECOND) {
    const withText = fit(MAX_SAFE_FLASHES_PER_SECOND - text);
    if (withText) return { ...withText, textFlash: true };
  }
  // At the slowest beat periods the beat effects always fit on their own.
  return fit(MAX_SAFE_FLASHES_PER_SECOND)!;
}
