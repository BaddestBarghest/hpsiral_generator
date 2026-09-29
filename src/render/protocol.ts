import type { Settings } from '../settings/schema';

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
  | { type: 'playing'; playing: boolean };

export type FromRender =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'stats'; fps: number };
