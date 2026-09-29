import { describe, expect, it } from 'vitest';
import { defaults, type Settings } from '../settings/schema';
import { phraseList, phraseOrder, textFrame } from './text';

const text = (over: Partial<Settings> = {}): Settings => ({
  ...defaults(),
  textEnabled: true,
  textPhrases: 'one\n  two  \n\nthree\n',
  textInterval: 2,
  textDuration: 1,
  textAnimation: 'none',
  ...over,
});

describe('phrases', () => {
  it('uses trimmed, non-empty lines', () => {
    expect(phraseList(text())).toEqual(['one', 'two', 'three']);
  });

  it('shuffles into a stable permutation', () => {
    const s = text({ textOrder: 'shuffle', textPhrases: 'a\nb\nc\nd\ne\nf\ng\nh' });
    const order = phraseOrder(s, 8);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(phraseOrder(s, 8)).toEqual(order);
    expect(order).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('textFrame', () => {
  it('shows each phrase for its duration, then a gap, in order', () => {
    const s = text();
    expect(textFrame(s, 0.5, 0).phrase).toBe('one');
    expect(textFrame(s, 1.5, 0).phrase).toBe(''); // gap
    expect(textFrame(s, 2.2, 0).phrase).toBe('two');
    expect(textFrame(s, 4.9, 0).phrase).toBe('three');
    expect(textFrame(s, 6.1, 0).phrase).toBe('one'); // wraps round
  });

  it('can follow the beat instead', () => {
    const s = text({ textSync: '2', bpm: 120, textDuration: 30 }); // 2 beats = 1 s slots
    expect(textFrame(s, 0, 0.5).phrase).toBe('one');
    expect(textFrame(s, 0, 2.5).phrase).toBe('two');
  });

  it('never shows longer than the interval', () => {
    const s = text({ textDuration: 30 });
    expect(textFrame(s, 1.99, 0).phrase).toBe('one');
    expect(textFrame(s, 2.01, 0).phrase).toBe('two');
  });

  it('applies uppercase and opacity', () => {
    const f = textFrame(text({ textUppercase: true, textOpacity: 0.5 }), 0.5, 0);
    expect(f.phrase).toBe('ONE');
    expect(f.alpha).toBeCloseTo(0.5);
  });

  it('fades in and out', () => {
    const s = text({ textAnimation: 'fade' }); // 1 s on screen → 0.25 s fades
    expect(textFrame(s, 0.05, 0).alpha).toBeCloseTo(0.2);
    expect(textFrame(s, 0.5, 0).alpha).toBe(1);
    expect(textFrame(s, 0.95, 0).alpha).toBeCloseTo(0.2);
  });

  it('flashes briefly as each phrase appears', () => {
    const s = text({ textFlash: true, textFlashLength: 0.1, textFlashIntensity: 1 });
    expect(textFrame(s, 2.0, 0).flash).toBeCloseTo(1);
    expect(textFrame(s, 2.05, 0).flash).toBeCloseTo(0.5);
    expect(textFrame(s, 2.2, 0).flash).toBe(0);
  });

  it('caps the text flash at 3 per second unless unlocked', () => {
    const fast = text({ textFlash: true, textInterval: 0.2, textDuration: 0.1 });
    expect(textFrame(fast, 0.01, 0)).toMatchObject({ flash: 0, flashCapped: true });
    expect(textFrame({ ...fast, flashUnlock: true }, 0.01, 0).flash).toBeGreaterThan(0);
  });

  it('shows nothing when disabled or empty', () => {
    expect(textFrame(text({ textEnabled: false }), 0.5, 0).phrase).toBe('');
    expect(textFrame(text({ textPhrases: '  \n ' }), 0.5, 0).phrase).toBe('');
  });
});

describe('wall of text', () => {
  it('pairs each phrase with the next one for the alternating wall', () => {
    const s = text({ textLayout: 'wallAlt' });
    expect(textFrame(s, 0.5, 0)).toMatchObject({ phrase: 'one', alt: 'two', slot: 0 });
    expect(textFrame(s, 4.5, 0)).toMatchObject({ phrase: 'three', alt: 'one', slot: 2 });
  });

  it('zooms in rather than out, so the wall always covers the screen', () => {
    const wall = text({ textLayout: 'wall', textAnimation: 'zoom' });
    const single = text({ textAnimation: 'zoom' });
    expect(textFrame(wall, 0.1, 0).scale).toBeGreaterThanOrEqual(1);
    expect(textFrame(single, 0.1, 0).scale).toBeLessThan(1);
  });
});
