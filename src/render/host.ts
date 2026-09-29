import type { Settings } from '../settings/schema';
import type { RenderJob } from '../record/renderJob';
import type { FromRender, ToRender, Viewport } from './protocol';

/** Main-thread handle to the render loop, whether it runs in a worker or inline. */
export interface RenderHost {
  readonly mode: 'worker' | 'inline';
  setSettings(s: Settings): void;
  setViewport(v: Viewport): void;
  setPlaying(p: boolean): void;
  /** Makes this moment a beat (tap tempo). */
  alignBeat(): void;
  /** Sends the user's uploaded font (null = removed) to wherever the text is drawn. */
  setCustomFont(data: ArrayBuffer | null): void;
  /** Starts an offline render; progress and the result arrive through `onEvent`. */
  startRender(job: RenderJob, output?: WritableStream): void;
  cancelRender(): void;
  destroy(): void;
}

export interface HostInit {
  settings: Settings;
  viewport: Viewport;
  playing: boolean;
  onEvent: (msg: FromRender) => void;
}

function workerSupported(canvas: HTMLCanvasElement): boolean {
  if (typeof Worker === 'undefined' || !('transferControlToOffscreen' in canvas)) return false;
  // `?inline` forces main-thread rendering (debugging and fallback testing).
  return !new URLSearchParams(location.search).has('inline');
}

/**
 * Starts rendering. Normally in a worker; only browsers that can't render off the main
 * thread download the renderer into the page (it's a separate chunk, loaded on demand).
 */
export async function createRenderHost(canvas: HTMLCanvasElement, init: HostInit): Promise<RenderHost> {
  if (workerSupported(canvas)) {
    const worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
    const post = (msg: ToRender, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);
    worker.onmessage = (e: MessageEvent<FromRender>) => init.onEvent(e.data);
    worker.onerror = (e) => init.onEvent({ type: 'error', message: e.message || 'Render worker failed to start.' });

    const offscreen = canvas.transferControlToOffscreen();
    post({ type: 'init', canvas: offscreen, settings: init.settings, viewport: init.viewport, playing: init.playing }, [offscreen]);

    return {
      mode: 'worker',
      setSettings: (settings) => post({ type: 'settings', settings }),
      setViewport: (viewport) => post({ type: 'viewport', viewport }),
      setPlaying: (playing) => post({ type: 'playing', playing }),
      alignBeat: () => post({ type: 'alignBeat' }),
      setCustomFont: (data) => post({ type: 'customFont', data }),
      startRender: (job, output) => post({ type: 'render', job, output }, output ? [output] : []),
      cancelRender: () => post({ type: 'cancelRender' }),
      destroy: () => worker.terminate(),
    };
  }

  const [{ RenderLoop }, { RenderTask }] = await Promise.all([import('./loop'), import('./renderTask')]);
  const loop = new RenderLoop(canvas, init.settings, init.viewport, init.playing, init.onEvent);
  const task = new RenderTask(loop, init.onEvent);
  queueMicrotask(() => init.onEvent({ type: 'ready' }));
  return {
    mode: 'inline',
    setSettings: (s) => loop.setSettings(s),
    setViewport: (v) => loop.setViewport(v),
    setPlaying: (p) => loop.setPlaying(p),
    alignBeat: () => loop.alignBeat(),
    // Inline, the main thread's copy (set by ui/customFont) is the one drawn with.
    setCustomFont: () => loop.redraw(),
    startRender: (job, output) => void task.start(job, output),
    cancelRender: () => task.cancel(),
    destroy: () => loop.destroy(),
  };
}
