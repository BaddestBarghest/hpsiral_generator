/// <reference lib="webworker" />
import { RenderLoop } from './loop';
import type { FromRender, ToRender } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

let loop: RenderLoop | null = null;
const emit = (msg: FromRender) => self.postMessage(msg);

self.onmessage = (e: MessageEvent<ToRender>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init':
        loop = new RenderLoop(msg.canvas, msg.settings, msg.viewport, msg.playing, emit);
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
    }
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
