import { describe, expect, it } from 'vitest';
import { defaults, type Settings } from './schema';
import { hasSharedSettings, settingsFromLink, settingsToLink } from './shareLink';

const PAGE = 'https://example.com/hpsiral_generator/';

const look: Settings = {
  ...defaults(),
  mode: 'spiral',
  armCurve: 'ripple',
  armColors: ['#ff00ff', '#00ffff'],
  textEnabled: true,
  textPhrases: 'Relax\nDeeper — and deeper ✨',
  loops: { glow: { to: 1.2, shape: 'pulse', sharpness: 0.4, peak: 0.3, beats: 4 } },
  maxFps: '30',
  renderScale: 0.5,
};

describe('share links', () => {
  it('carry the settings through the URL hash', async () => {
    const link = await settingsToLink(look, PAGE);
    expect(link.startsWith(`${PAGE}#s=`)).toBe(true);
    const hash = new URL(link).hash;
    expect(hasSharedSettings(hash)).toBe(true);
    const back = await settingsFromLink(hash, defaults());
    expect(back).toMatchObject({ armCurve: 'ripple', armColors: look.armColors, textPhrases: look.textPhrases, loops: look.loops });
  });

  it('keep the viewer’s own display settings', async () => {
    const hash = new URL(await settingsToLink(look, PAGE)).hash;
    const mine = { ...defaults(), maxFps: '60' as const, renderScale: 0.75 };
    const back = await settingsFromLink(hash, mine);
    expect(back.maxFps).toBe('60');
    expect(back.renderScale).toBe(0.75);
  });

  it('replace an old hash, and stay short enough to paste', async () => {
    const link = await settingsToLink(defaults(), `${PAGE}#s=old`);
    expect(link.split('#').length).toBe(2);
    expect(link.length).toBeLessThan(2000);
  });

  it('explain a damaged link', async () => {
    const link = await settingsToLink(look, PAGE);
    const cut = new URL(link).hash.slice(0, 40);
    await expect(settingsFromLink(cut, defaults())).rejects.toThrow(/damaged or incomplete/);
    expect(hasSharedSettings('#other')).toBe(false);
  });
});
