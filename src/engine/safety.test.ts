import { describe, expect, it } from 'vitest';
import { defaults, type Settings } from '../settings/schema';
import { flashPlan, MAX_SAFE_FLASHES_PER_SECOND } from './safety';
import { textFrame } from './text';

/** Flashes per second from every source, as the plan allows them. */
function totalRate(s: Settings): number {
  const plan = flashPlan(s);
  const bps = s.bpm / 60;
  const text = plan.textFlash ? 1 / (s.textSync === 'off' ? s.textInterval : (Number(s.textSync) * 60) / s.bpm) : 0;
  return (s.flashMode !== 'off' ? bps / plan.flashBeats : 0) + (s.invertEnabled ? bps / plan.invertBeats : 0) + text;
}

const beat = (over: Partial<Settings>): Settings => ({ ...defaults(), flashMode: 'strobe', ...over });

describe('flash safety limit', () => {
  it('keeps a single effect at or below 3 per second by skipping beats', () => {
    const s = beat({ bpm: 240, flashRate: '0.25' }); // 16/s → 8 → 4 → 2
    expect(flashPlan(s).flashBeats).toBe(2);
    expect(flashPlan(beat({ bpm: 120, flashRate: '1' })).flashBeats).toBe(1); // 2/s is fine
  });

  it('counts flashes and inversions together', () => {
    // Each alone is 2/s (fine); together 4/s, so one of them has to skip beats.
    const s = beat({ bpm: 120, flashRate: '1', invertEnabled: true, invertRate: '1' });
    expect(totalRate(s)).toBeLessThanOrEqual(MAX_SAFE_FLASHES_PER_SECOND);
    const plan = flashPlan(s);
    expect([plan.flashBeats, plan.invertBeats].sort()).toEqual([1, 2]);
  });

  it('makes room for the text flash by slowing the beat effects', () => {
    // Beat flash 2/s + text flash 2/s = 4/s: the beat flash drops to every other beat (1/s).
    const s = beat({ bpm: 120, flashRate: '1', textEnabled: true, textFlash: true, textInterval: 0.5 });
    const plan = flashPlan(s);
    expect(plan.textFlash).toBe(true);
    expect(plan.flashBeats).toBe(2);
    expect(totalRate(s)).toBeLessThanOrEqual(MAX_SAFE_FLASHES_PER_SECOND);
  });

  it('drops the text flash when it cannot fit, and says so', () => {
    const s: Settings = { ...defaults(), textEnabled: true, textFlash: true, textInterval: 0.3, textDuration: 0.1 };
    expect(flashPlan(s).textFlash).toBe(false);
    expect(textFrame(s, 0.01, 0)).toMatchObject({ flash: 0, flashCapped: true });
  });

  it('never exceeds the limit across tempos and rates', () => {
    for (const bpm of [30, 90, 144, 200, 240])
      for (const flashRate of ['0.25', '1', '4'] as const)
        for (const invertRate of ['0.25', '2'] as const)
          for (const textInterval of [0.4, 1, 5]) {
            const s = beat({ bpm, flashRate, invertEnabled: true, invertRate, textEnabled: true, textFlash: true, textInterval });
            expect(totalRate(s)).toBeLessThanOrEqual(MAX_SAFE_FLASHES_PER_SECOND + 1e-9);
          }
  });

  it('can be unlocked explicitly', () => {
    const plan = flashPlan(beat({ bpm: 240, flashRate: '0.25', flashUnlock: true }));
    expect(plan.flashBeats).toBe(0.25);
  });
});
