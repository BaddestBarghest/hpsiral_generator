import { BOLD_FONT_IDS, CUSTOM_FONT_ID, fontFamily, type TextFontId } from '../settings/fonts';
import type { Settings } from '../settings/schema';
import { FONT_FILES } from './fontFiles';
import { sequenceLooks } from '../engine/sequence';

/** Used while a font downloads, or if loading fails. */
const FALLBACK = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** The document's font set on the main thread, or the worker's own (workers keep separate sets). */
function fontSet(): FontFaceSet | undefined {
  if (typeof document !== 'undefined') return document.fonts;
  return (globalThis as unknown as { fonts?: FontFaceSet }).fonts;
}

const status = new Map<string, 'loading' | 'loaded' | 'failed'>();
const pending = new Map<string, Promise<void>>();

/** The user's uploaded font file, if any. Each upload gets a new version (and so a new family). */
let custom: { data: ArrayBuffer; version: number } | null = null;
let customVersion = 0;

/**
 * Sets (or with null, removes) the user's uploaded font. Called on the main thread for the
 * font picker's previews and in the render worker for drawing; each keeps its own copy.
 */
export function setCustomFont(data: ArrayBuffer | null): void {
  customVersion++;
  custom = data ? { data, version: customVersion } : null;
}

/** CSS family name a font is registered under (uploads get a fresh name per version). */
export function familyName(id: TextFontId, weight: 400 | 700 = 400): string {
  return id === CUSTOM_FONT_ID ? fontFamily(`custom-${custom?.version ?? 0}`, 400) : fontFamily(id, weight);
}

const key = (id: TextFontId, weight: 400 | 700) => `${familyName(id, weight)}`;

export function fontWeight(id: TextFontId, bold: boolean): 400 | 700 {
  return bold && (BOLD_FONT_IDS as readonly string[]).includes(id) ? 700 : 400;
}

/** Downloads and registers a font (once). Resolves even on failure; the fallback is used then. */
export function loadFont(id: TextFontId, weight: 400 | 700 = 400): Promise<void> {
  const k = key(id, weight);
  const existing = pending.get(k);
  if (existing) return existing;
  const set = fontSet();
  let source: string | ArrayBuffer | undefined;
  if (id === CUSTOM_FONT_ID) source = custom?.data.slice(0);
  else source = FONT_FILES[id]?.[weight] && `url(${FONT_FILES[id][weight]})`;
  if (!set || !source || typeof FontFace === 'undefined') {
    status.set(k, 'failed');
    return Promise.resolve();
  }
  status.set(k, 'loading');
  const promise = new FontFace(familyName(id, weight), source, { weight: String(weight) })
    .load()
    .then((face) => {
      set.add(face);
      status.set(k, 'loaded');
    })
    .catch(() => {
      status.set(k, 'failed');
    });
  pending.set(k, promise);
  return promise;
}

export function isFontReady(id: TextFontId, weight: 400 | 700): boolean {
  return status.get(key(id, weight)) === 'loaded';
}

/**
 * CSS font shorthand for canvas text. Until the font has loaded, only the fallback is named:
 * Chromium permanently caches a family that a worker canvas asked for before it was
 * registered, and would keep drawing the fallback even after the font arrives.
 */
export function canvasFont(id: TextFontId, weight: 400 | 700, px: number): string {
  return isFontReady(id, weight) ? `${weight} ${px}px "${familyName(id, weight)}", ${FALLBACK}` : `${weight} ${px}px ${FALLBACK}`;
}

/** Makes sure the text fonts (every scene's, in a sequence) are ready before an offline render starts drawing frames. */
export async function ensureTextFont(settings: Settings): Promise<void> {
  await Promise.all(
    sequenceLooks(settings)
      .filter((s) => s.textEnabled)
      .map((s) => loadFont(s.textFont, fontWeight(s.textFont, s.textBold))),
  );
}

/** Checks that `data` is a font the browser can use (for validating uploads). */
export async function isUsableFont(data: ArrayBuffer): Promise<boolean> {
  if (typeof FontFace === 'undefined') return false;
  try {
    await new FontFace('HG upload check', data.slice(0)).load();
    return true;
  } catch {
    return false;
  }
}
