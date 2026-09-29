import type { Settings } from '../settings/schema';
import type { RenderJob } from '../record/renderJob';

/** Canvas size in CSS pixels plus the device pixel ratio; the loop derives the backing size. */
export interface Viewport {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
}

export type ToRender =
  | { type: 'init'; canvas: OffscreenCanvas; settings: Settings; viewport: Viewport; playing: boolean }
  | { type: 'settings'; settings: Settings }
  | { type: 'viewport'; viewport: Viewport }
  | { type: 'playing'; playing: boolean }
  | { type: 'alignBeat' }
  /** The user's uploaded font file, or null when removed. */
  | { type: 'customFont'; data: ArrayBuffer | null }
  /** `output`: stream to write the file into (transferred); omitted = return the bytes. */
  | { type: 'render'; job: RenderJob; output?: WritableStream }
  | { type: 'cancelRender' };

export type FromRender =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'stats'; fps: number }
  | { type: 'renderProgress'; frame: number; total: number }
  /** `buffer` is null when the file was streamed straight to disk. */
  | { type: 'renderDone'; buffer: ArrayBuffer | null }
  | { type: 'renderCancelled' }
  | { type: 'renderError'; message: string };

export type Emit = (msg: FromRender, transfer?: Transferable[]) => void;
