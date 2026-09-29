import type { RenderJob } from '../record/renderJob';
import type { RenderLoop } from './loop';
import type { Emit } from './protocol';

/** Runs one offline render next to the live loop, which is suspended meanwhile so they don't compete for the GPU. */
export class RenderTask {
  private controller: AbortController | null = null;

  constructor(
    private loop: RenderLoop,
    private emit: Emit,
  ) {}

  get busy(): boolean {
    return this.controller !== null;
  }

  async start(job: RenderJob, fileHandle?: FileSystemFileHandle): Promise<void> {
    if (this.controller) {
      this.emit({ type: 'renderError', message: 'A render is already in progress.' });
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    this.loop.setSuspended(true);
    try {
      const render =
        job.format === 'gif'
          ? (await import('../record/gifRender')).renderGif
          : (await import('../record/offlineRender')).renderOffline;
      const buffer = await render(job, fileHandle, controller.signal, (frame, total) =>
        this.emit({ type: 'renderProgress', frame, total }),
      );
      this.emit({ type: 'renderDone', buffer }, buffer ? [buffer] : []);
    } catch (err) {
      if (controller.signal.aborted) this.emit({ type: 'renderCancelled' });
      else this.emit({ type: 'renderError', message: err instanceof Error ? err.message : String(err) });
    } finally {
      this.controller = null;
      this.loop.setSuspended(false);
    }
  }

  cancel(): void {
    this.controller?.abort();
  }
}
