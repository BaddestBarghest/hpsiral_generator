// Deterministic frame-by-frame render to MP4/WebM with WebCodecs (via mediabunny).
// Loaded lazily; runs in the render worker (or on the main thread in inline mode).
import {
  BufferTarget,
  CanvasSource,
  canEncodeVideo,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  WebMOutputFormat,
  type Target,
} from 'mediabunny';
import { step } from '../engine/timeline';
import { Renderer } from '../render/Renderer';
import { frameCount, type RenderJob, type VideoCodec } from './renderJob';
import { RenderCancelled } from './renderErrors';
import { warmUp } from './warmup';

/** Which codecs this browser can encode at the given size/rate. */
export async function supportedCodecs(width: number, height: number, fps: number, bitrate: number): Promise<VideoCodec[]> {
  if (typeof VideoEncoder === 'undefined') return [];
  const codecs: VideoCodec[] = ['avc', 'vp9'];
  const ok = await Promise.all(
    codecs.map((c) => canEncodeVideo(c, { width, height, bitrate, frameRate: fps }).catch(() => false)),
  );
  return codecs.filter((_, i) => ok[i]);
}

/**
 * Renders `job` and returns the file as an ArrayBuffer, or `null` when it was
 * streamed straight into `fileHandle`.
 */
export async function renderOffline(
  job: RenderJob,
  fileHandle: FileSystemFileHandle | undefined,
  signal: AbortSignal,
  onProgress: (frame: number, total: number) => void,
): Promise<ArrayBuffer | null> {
  const codec = job.format;
  if (codec === 'gif') throw new Error('GIF jobs are rendered by renderGif.');
  const canvas = new OffscreenCanvas(job.width, job.height);
  const renderer = new Renderer(canvas);
  renderer.resize(job.width, job.height);

  const writable = fileHandle ? await fileHandle.createWritable() : undefined;
  const target: Target = writable ? new StreamTarget(writable, { chunked: true }) : new BufferTarget();
  const format =
    codec === 'avc'
      ? // Streaming can seek back to write the index at the end; in-memory puts it up front for fast playback start.
        new Mp4OutputFormat({ fastStart: writable ? false : 'in-memory' })
      : new WebMOutputFormat();
  const output = new Output({ format, target });
  const source = new CanvasSource(canvas, {
    codec,
    bitrate: job.bitrate,
    keyFrameInterval: 2,
    latencyMode: 'quality',
  });
  output.addVideoTrack(source, { frameRate: job.fps });

  const total = frameCount(job);
  const dt = 1 / job.fps;
  try {
    await output.start();
    let tl = warmUp(renderer, job.settings, job.fps);
    let lastReport = 0;
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new RenderCancelled();
      renderer.draw(job.settings, tl, dt);
      await source.add(i * dt, dt); // captures the canvas synchronously, then waits for encoder backpressure
      tl = step(tl, job.settings, dt);
      const now = performance.now();
      if (now - lastReport > 100 || i === total - 1) {
        onProgress(i + 1, total);
        lastReport = now;
      }
    }
    source.close();
    await output.finalize();
    return target instanceof BufferTarget ? target.buffer : null;
  } catch (err) {
    if (output.state !== 'canceled' && output.state !== 'finalized') await output.cancel().catch(() => {});
    // Don't leave a partial file behind (FileSystemHandle.remove is Chromium-only).
    const removable = fileHandle as (FileSystemFileHandle & { remove?: () => Promise<void> }) | undefined;
    await removable?.remove?.().catch(() => {});
    throw signal.aborted ? new RenderCancelled() : err;
  } finally {
    renderer.destroy();
  }
}
