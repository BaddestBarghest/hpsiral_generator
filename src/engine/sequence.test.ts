import { describe, expect, it } from 'vitest';
import { defaults, lookOf, sanitize, settingsFromJson, settingsToJson, type Look, type Settings } from '../settings/schema';
import {
  advanceSequence,
  blendLooks,
  mixColor,
  resolveSequence,
  sceneStart,
  sequenceLength,
  sequencePlace,
  sequenceSeconds,
} from './sequence';
import { initialTimeline, step } from './timeline';

const look = (over: Partial<Look> = {}): Look => ({ ...lookOf(defaults()), ...over });

/** Settings playing scenes A (hold 10, fade 4) and B (hold 6, fade 2). */
function withScenes(a: Partial<Look>, b: Partial<Look>, extra: Partial<Settings['sequence']> = {}): Settings {
  return {
    ...defaults(),
    sequence: {
      enabled: true,
      unit: 'seconds',
      loop: true,
      scenes: [
        { name: 'A', look: look(a), hold: 10, fade: 4 },
        { name: 'B', look: look(b), hold: 6, fade: 2 },
      ],
      ...extra,
    },
  };
}

describe('sequence timing', () => {
  const s = withScenes({}, {});

  it('holds, fades, and loops back to the first scene', () => {
    expect(sequenceLength(s.sequence)).toBe(22);
    expect(sequencePlace(s.sequence, 5)).toEqual({ scene: 0, next: 0, t: 0 });
    expect(sequencePlace(s.sequence, 12)).toEqual({ scene: 0, next: 1, t: 0.5 });
    expect(sequencePlace(s.sequence, 15)).toEqual({ scene: 1, next: 1, t: 0 });
    expect(sequencePlace(s.sequence, 21)).toEqual({ scene: 1, next: 0, t: 0.5 });
    expect(sequencePlace(s.sequence, 22 + 5).scene).toBe(0);
    expect(sceneStart(s.sequence, 1)).toBe(14);
  });

  it('stays on the last scene when not looping', () => {
    const once = withScenes({}, {}, { loop: false }).sequence;
    expect(sequenceLength(once)).toBe(20); // the last fade doesn't count
    expect(sequencePlace(once, 100)).toEqual({ scene: 1, next: 1, t: 0 });
    expect(advanceSequence(once, 19, 5)).toBe(20);
  });

  it('wraps the position when looping', () => {
    expect(advanceSequence(s.sequence, 21, 3)).toBeCloseTo(2);
  });

  it('converts beats to seconds at each scene’s tempo', () => {
    const beats = withScenes({ bpm: 120 }, { bpm: 60 }, { unit: 'beats' });
    beats.sequence.scenes[0].fade = 0;
    beats.sequence.scenes[1].fade = 0;
    // 10 beats at 2/s + 6 beats at 1/s
    expect(sequenceSeconds(beats)).toBeCloseTo(11);
  });

  it('advances in beats with the tempo', () => {
    const beats = withScenes({ bpm: 120 }, { bpm: 120 }, { unit: 'beats' });
    const tl = step(initialTimeline(), beats, 1);
    expect(tl.seqPos).toBeCloseTo(2);
  });
});

describe('resolving scenes', () => {
  it('uses the live settings when no sequence plays', () => {
    const s = withScenes({ arms: 5 }, {}, { enabled: false });
    expect(resolveSequence(s, 0)).toBe(s);
  });

  it('shows the scene’s look but keeps this device’s display settings', () => {
    const s = { ...withScenes({ arms: 5, renderScale: 0.5 }, {}), renderScale: 0.75 };
    const r = resolveSequence(s, 1);
    expect(r.arms).toBe(5);
    expect(r.renderScale).toBe(0.75);
  });

  it('blends numbers and colours, and switches choices half-way', () => {
    const a = look({ speed: 0, armColors: ['#000000'], mode: 'spiral', arms: 2 });
    const b = look({ speed: 2, armColors: ['#ffffff'], mode: 'concentric', arms: 6 });
    const early = blendLooks(a, b, 0.25);
    const mid = blendLooks(a, b, 0.5);
    expect(mid.speed).toBeCloseTo(1);
    expect(early.speed).toBeGreaterThan(0);
    expect(early.speed).toBeLessThan(0.5); // eased
    expect(early.mode).toBe('spiral');
    expect(early.arms).toBe(2);
    expect(blendLooks(a, b, 0.75).mode).toBe('concentric');
    expect(mid.armColors[0]).not.toBe('#000000');
    expect(blendLooks(a, b, 1)).toMatchObject({ speed: 2, armColors: ['#ffffff'], arms: 6 });
  });

  it('fades the auxiliary spiral in as it is, instead of morphing its settings', () => {
    const a = look({ s2Enabled: false, s2Arms: 1, s2Opacity: 0.8 });
    const b = look({ s2Enabled: true, s2Arms: 7, s2Opacity: 0.8 });
    const start = blendLooks(a, b, 0.01);
    expect(start.s2Enabled).toBe(true);
    expect(start.s2Arms).toBe(7);
    expect(start.s2Opacity).toBeLessThan(0.01);
    expect(blendLooks(a, b, 0.5).s2Opacity).toBeCloseTo(0.4);
  });

  it('grows a beat loop from nothing', () => {
    const a = look({ zoom: 1 });
    const b = look({ zoom: 1, loops: { zoom: { to: 2, shape: 'smooth', sharpness: 0.5, peak: 0.5, beats: 8 } } });
    expect(blendLooks(a, b, 0).loops.zoom?.to).toBe(1);
    expect(blendLooks(a, b, 0.5).loops.zoom?.to).toBeCloseTo(Math.SQRT2); // zoom glides on its log scale
    expect(blendLooks(a, b, 1).loops.zoom?.to).toBe(2);
  });

  it('blends one colour into several', () => {
    const blended = blendLooks(look({ armColors: ['#ff0000'] }), look({ armColors: ['#ff0000', '#0000ff'] }), 0.5);
    expect(blended.armColors).toHaveLength(2);
    expect(blended.armColors[0]).toBe('#ff0000');
    expect(mixColor('#ff0000', '#ff0000', 0.3)).toBe('#ff0000');
  });
});

describe('colour phases in a sequence', () => {
  it('ease back to the scene’s own colours instead of snapping', () => {
    const s = withScenes({ hueRoll: 0.2 }, { hueRoll: 0 });
    s.sequence.scenes[0].fade = 0;
    let tl = initialTimeline();
    for (let i = 0; i < 60 * 9; i++) tl = step(tl, s, 1 / 60); // hue is 0.8 round after 9 s... wrapped
    const before = tl.huePhase;
    tl = step({ ...tl, seqPos: 10.5 }, s, 1 / 60); // now in scene B
    expect(tl.huePhase).not.toBe(0);
    expect(Math.abs(tl.huePhase - before)).toBeLessThan(0.01);
    for (let i = 0; i < 60 * 4; i++) tl = step(tl, s, 1 / 60);
    expect(tl.huePhase).toBe(0);
  });
});

describe('saved sequences', () => {
  it('round-trip through a settings file', () => {
    const s = withScenes({ arms: 5 }, { mode: 'globe' });
    expect(settingsFromJson(settingsToJson(s))).toEqual(s);
  });

  it('sanitize scenes and clamp their times', () => {
    const s = sanitize({ sequence: { enabled: true, unit: 'weeks', scenes: [{ look: { arms: 99 }, hold: -3, fade: 'x' }, { name: 'no look' }] } });
    expect(s.sequence.unit).toBe('seconds');
    expect(s.sequence.scenes).toHaveLength(1);
    expect(s.sequence.scenes[0]).toMatchObject({ name: 'Scene 1', hold: 0, fade: 5 });
    expect(s.sequence.scenes[0].look.arms).toBe(16);
    expect(s.sequence.scenes[0].look).not.toHaveProperty('sequence');
  });

  it('migrate old looks inside scenes', () => {
    const s = settingsFromJson(JSON.stringify({ version: 3, sequence: { scenes: [{ look: { mode: 'tunnel' } }] } }));
    expect(s.sequence.scenes[0].look).toMatchObject({ mode: 'spiral', armCurve: 'inverse' });
  });
});
