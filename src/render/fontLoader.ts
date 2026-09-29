import { BOLD_FONT_IDS, fontFamily, type FontId } from '../settings/fonts';
import type { Settings } from '../settings/schema';
import { FONT_FILES } from './fontFiles';

/** Used while a font downloads, or if loading fails. */
const FALLBACK = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** The document's font set on the main thread, or the worker's own (workers keep separate sets). */
function fontSet(): FontFaceSet | undefined {
  if (typeof document !== 'undefined') return document.fonts;
  return (globalThis as unknown as { fonts?: FontFaceSet }).fonts;
}

const status = new Map<string, 'loading' | 'loaded' | 'failed'>();
const pending = new Map<string, Promise<void>>();

export function fontWeight(id: FontId, bold: boolean): 400 | 700 {
  return bold && (BOLD_FONT_IDS as readonly string[]).includes(id) ? 700 : 400;
}

/** Downloads and registers a font (once). Resolves even on failure; the fallback is used then. */
export function loadFont(id: FontId, weight: 400 | 700 = 400): Promise<void> {
  const key = `${id}:${weight}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const set = fontSet();
  const url = FONT_FILES[id]?.[weight];
  if (!set || !url || typeof FontFace === 'undefined') {
    status.set(key, 'failed');
    return Promise.resolve();
  }
  status.set(key, 'loading');
  const promise = new FontFace(fontFamily(id, weight), `url(${url})`, { weight: String(weight) })
    .load()
    .then((face) => {
      set.add(face);
      status.set(key, 'loaded');
    })
    .catch(() => {
      status.set(key, 'failed');
    });
  pending.set(key, promise);
  return promise;
}

export function isFontReady(id: FontId, weight: 400 | 700): boolean {
  return status.get(`${id}:${weight}`) === 'loaded';
}

/**
 * CSS font shorthand for canvas text. Until the font has loaded, only the fallback is named:
 * Chromium permanently caches a family that a worker canvas asked for before it was
 * registered, and would keep drawing the fallback even after the font arrives.
 */
export function canvasFont(id: FontId, weight: 400 | 700, px: number): string {
  return isFontReady(id, weight) ? `${weight} ${px}px "${fontFamily(id, weight)}", ${FALLBACK}` : `${weight} ${px}px ${FALLBACK}`;
}

/** Makes sure the text font is ready before an offline render starts drawing frames. */
export async function ensureTextFont(s: Settings): Promise<void> {
  if (s.textEnabled) await loadFont(s.textFont, fontWeight(s.textFont, s.textBold));
}
