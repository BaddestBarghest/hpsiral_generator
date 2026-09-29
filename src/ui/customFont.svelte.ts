// The user's uploaded text font: kept in IndexedDB (fonts are too big for localStorage),
// registered on the main thread for picker previews, and sent to the renderer.
import { isUsableFont, setCustomFont } from '../render/fontLoader';

const DB = 'hypnogen';
const STORE = 'files';
const KEY = 'customFont';
/** Larger files are almost certainly not a single text font. */
export const MAX_FONT_BYTES = 10 * 1024 * 1024;

interface Stored {
  name: string;
  data: ArrayBuffer;
}

/** Name of the uploaded font file, or null when there is none. */
export const customFont = $state<{ name: string | null }>({ name: null });

/** Where to send the font data (the render host); set by the app on start. */
let sendToRenderer: (data: ArrayBuffer | null) => void = () => {};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

function apply(font: Stored | null) {
  customFont.name = font?.name ?? null;
  setCustomFont(font ? font.data.slice(0) : null);
  sendToRenderer(font ? font.data.slice(0) : null);
}

/** Loads a previously uploaded font (if any) and hands it to the renderer. */
export async function initCustomFont(send: (data: ArrayBuffer | null) => void): Promise<void> {
  sendToRenderer = send;
  try {
    const stored = await withStore<Stored | undefined>('readonly', (s) => s.get(KEY));
    if (stored) apply(stored);
  } catch {
    /* storage unavailable: no saved font */
  }
}

/** Validates, stores and activates an uploaded font file. Throws a readable error. */
export async function uploadCustomFont(file: File): Promise<void> {
  if (file.size > MAX_FONT_BYTES) throw new Error('That file is too large to be a font (over 10 MB).');
  const data = await file.arrayBuffer();
  if (!(await isUsableFont(data))) throw new Error(`${file.name} isn't a font this browser can read. Try a TTF, OTF, WOFF or WOFF2 file.`);
  const font = { name: file.name.replace(/\.(ttf|otf|woff2?)$/i, ''), data };
  apply(font);
  try {
    await withStore('readwrite', (s) => s.put(font, KEY));
  } catch {
    /* works for this visit even if it can't be saved */
  }
}

export async function removeCustomFont(): Promise<void> {
  apply(null);
  try {
    await withStore('readwrite', (s) => s.delete(KEY));
  } catch {
    /* nothing saved */
  }
}
