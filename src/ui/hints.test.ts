import { describe, expect, it } from 'vitest';
import { defaults, type Settings } from '../settings/schema';
import { autoShiftFor, hintFor } from './hints';

const three = ['#ff1744', '#ffea00', '#2979ff'];
const s = (over: Partial<Settings>): Settings => ({ ...defaults(), ...over });

describe('colour hints', () => {
  it('warns when static colours outnumber the arms', () => {
    expect(hintFor('armColorMode', s({ arms: 2, armColors: three, armColorMode: 'static' }))).toMatch(/Only 2 of your 3 colours/);
    expect(hintFor('armColorMode', s({ arms: 3, armColors: three, armColorMode: 'static' }))).toBeNull();
    expect(hintFor('armColorMode', s({ arms: 2, armColors: three, armColorMode: 'gradient' }))).toBeNull();
    // Rings are all separate, so every colour shows.
    expect(hintFor('armColorMode', s({ mode: 'concentric', arms: 1, armColors: three, armColorMode: 'static' }))).toBeNull();
  });

  it('covers gaps and the auxiliary spiral too', () => {
    expect(hintFor('gapColorMode', s({ arms: 2, gapColors: three, gapColorMode: 'static' }))).toMatch(/2 gaps/);
    expect(hintFor('s2ColorMode', s({ s2Arms: 1, s2Colors: three, s2ColorMode: 'static' }))).toMatch(/Only 1 of your 3/);
  });

  it('warns when cycling at zero speed, and auto-sets a speed', () => {
    const cyc = s({ armColors: three, armColorMode: 'cycle', armShift: 0 });
    expect(hintFor('armColorMode', cyc)).toMatch(/shift speed/);
    expect(autoShiftFor('armColorMode', 'cycle', { ...cyc, armColorMode: 'static' })).toEqual({ armShift: 0.25 });
    expect(autoShiftFor('armColorMode', 'cycle', { ...cyc, armShift: 0.6 })).toBeNull();
    expect(autoShiftFor('armColorMode', 'gradient', cyc)).toBeNull();
  });

  it('stays quiet with one colour or unrelated controls', () => {
    expect(hintFor('armColorMode', s({ armColors: ['#ffffff'], armColorMode: 'cycle' }))).toBeNull();
    expect(hintFor('density', defaults())).toBeNull();
  });
});
