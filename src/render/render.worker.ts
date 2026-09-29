/// <reference lib="webworker" />
import { RenderLoop } from './loop';
import { RenderTask } from './renderTask';
import type { Emit, ToRender } from './protocol';
import { setCustomFont } from './fontLoader';

declare const self: DedicatedWorkerGlobalScope;

let loop: RenderLoop | null = null;
let task: RenderTask | null = null;
const emit: Emit = (msg, transfer = []) => self.postMessage(msg, transfer);

self.onmessage = (e: MessageEvent<ToRender>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init':
        loop = new RenderLoop(msg.canvas, msg.settings, msg.viewport, msg.playing, emit);
        task = new RenderTask(loop, emit);
        emit({ type: 'ready' });
        break;
      case 'settings':
        loop?.setSettings(msg.settings);
        break;
      case 'viewport':
        loop?.setViewport(msg.viewport);
        break;
      case 'playing':
        loop?.setPlaying(msg.playing);
        break;
      case 'alignBeat':
        loop?.alignBeat();
        break;
      case 'customFont':
        setCustomFont(msg.data);
        loop?.redraw();
        break;
      case 'render':
        void task?.start(msg.job, msg.output);
        break;
      case 'cancelRender':
        task?.cancel();
        break;
    }
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
