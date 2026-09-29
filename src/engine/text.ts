import type { Settings } from '../settings/schema';

/**
 * Timed text phrases. Like everything else, a pure function of the timeline, so live
 * playback, renders and loops show the same phrase at the same moment.
 */

/** Non-empty trimmed lines of the phrases box. */
export function phraseList(s: Settings): string[] {
  return s.textPhrases
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Seconds per phrase slot when timed in seconds, or beats per slot when synced to the tempo. */
export function textSlotBeats(s: Settings): number {
  return s.textSync === 'off' ? 0 : Number(s.textSync);
}

/**
 * Display order: in sequence, or one fixed shuffle (seeded by the phrases themselves, so it
 * is stable, reproducible, and still repeats every N phrases, which keeps loops possible).
 */
export function phraseOrder(s: Settings, count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (s.textOrder !== 'shuffle' || count < 2) return order;
  let seed = 2166136261;
  for (const ch of s.textPhrases) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    // mulberry32
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** WCAG 2.3.1 cap shared with the beat flashes. */
const MAX_FLASHES_PER_SECOND = 3;

export interface TextFrame {
  /** Phrase to show, or '' when nothing is on screen. */
  phrase: string;
  /** The next phrase in order; alternates with `phrase` in the "alternating" wall. */
  alt: string;
  /** Index of the current phrase slot; the wall rearranges itself each slot. */
  slot: number;
  /** 0..1 */
  alpha: number;
  /** Scale about the text's centre (animation). */
  scale: number;
  /** 0..1 strength of the "flash when text appears" pulse. */
  flash: number;
  /** Whether the text flash is suppressed by the 3-per-second safety cap. */
  flashCapped: boolean;
}

const NONE: TextFrame = { phrase: '', alt: '', slot: 0, alpha: 0, scale: 1, flash: 0, flashCapped: false };

export const isWall = (s: Settings) => s.textLayout !== 'single';

/**
 * What text shows at timeline time `seconds` / beat position `beats`.
 */
export function textFrame(s: Settings, seconds: number, beats: number): TextFrame {
  if (!s.textEnabled) return NONE;
  const phrases = phraseList(s);
  if (phrases.length === 0) return NONE;

  const bps = s.bpm / 60;
  const slotBeats = textSlotBeats(s);
  // Everything below works in seconds; beat-synced slots convert via the tempo.
  const interval = slotBeats > 0 ? slotBeats / bps : s.textInterval;
  const t = slotBeats > 0 ? beats / bps : seconds;
  const slot = Math.floor(t / interval);
  const age = t - slot * interval;
  const duration = Math.min(s.textDuration, interval);

  const flashCapped = !s.flashUnlock && 1 / interval > MAX_FLASHES_PER_SECOND;
  const flash =
    s.textFlash && !flashCapped && age < s.textFlashLength ? (1 - age / s.textFlashLength) * s.textFlashIntensity : 0;

  if (age >= duration) return { ...NONE, flash, flashCapped };

  const order = phraseOrder(s, phrases.length);
  const at = (i: number) => {
    const p = phrases[order[((i % phrases.length) + phrases.length) % phrases.length]];
    return s.textUppercase ? p.toUpperCase() : p;
  };
  const phrase = at(slot);

  const progress = age / duration;
  // Fades take a quarter of the time on screen, at most 0.4 s each way.
  const fade = Math.min(0.25 * duration, 0.4);
  const fadeEnv = Math.min(1, age / fade, (duration - age) / fade);
  let alpha = 1;
  let scale = 1;
  switch (s.textAnimation) {
    case 'fade':
      alpha = fadeEnv;
      break;
    case 'zoom':
      alpha = fadeEnv;
      // A wall fills the screen, so it zooms in rather than out (shrinking would bare the edges).
      scale = isWall(s) ? 1 + 0.15 * progress : 0.85 + 0.15 * progress;
      break;
    case 'pop':
      alpha = Math.min(1, (duration - age) / Math.min(0.1 * duration, 0.2));
      scale = 1 + 0.25 * Math.exp(-age / 0.08);
      break;
  }
  return { phrase, alt: at(slot + 1), slot, alpha: Math.max(0, alpha) * s.textOpacity, scale, flash, flashCapped };
}
