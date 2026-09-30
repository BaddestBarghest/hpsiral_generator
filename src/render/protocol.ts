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
  /** Jump to the start of a scene of the sequence. */
  | { type: 'seekScene'; index: number }
  /** Save the next live frame as a PNG (answered with `snapshot`). */
  | { type: 'snapshot' }
  /** The user's uploaded font file, or null when removed. */
  | { type: 'customFont'; data: ArrayBuffer | null }
  /** `output`: stream to write the file into (transferred); omitted = return the bytes. */
  | { type: 'render'; job: RenderJob; output?: WritableStream }
  | { type: 'cancelRender' };

export type FromRender =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'stats'; fps: number }
  /** The sequence moved to another scene or fade; `scene` is -1 when no sequence plays. */
  | { type: 'sequence'; scene: number; next: number }
  | { type: 'snapshot'; png: Blob }
  | { type: 'renderProgress'; frame: number; total: number }
  /** `buffer` is null when the file was streamed straight to disk. */
  | { type: 'renderDone'; buffer: ArrayBuffer | null }
  | { type: 'renderCancelled' }
  | { type: 'renderError'; message: string };

export type Emit = (msg: FromRender, transfer?: Transferable[]) => void;
