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
import { Renderer } from '../render/Renderer';
import { frameCount, type RenderJob, type VideoCodec } from './renderJob';
import { RenderCancelled } from './renderErrors';
import { advance, subSteps, warmUp } from './warmup';
import { ensureTextFont } from '../render/fontLoader';

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
 * streamed into `output` (which is closed on success and aborted on failure).
 */
export async function renderOffline(
  job: RenderJob,
  output: WritableStream | undefined,
  signal: AbortSignal,
  onProgress: (frame: number, total: number) => void,
): Promise<ArrayBuffer | null> {
  const codec = job.format;
  if (codec === 'gif') throw new Error('GIF jobs are rendered by renderGif.');
  const canvas = new OffscreenCanvas(job.width, job.height);
  const renderer = new Renderer(canvas);
  renderer.resize(job.width, job.height);

  const target: Target = output ? new StreamTarget(output, { chunked: true }) : new BufferTarget();
  const format =
    codec === 'avc'
      ? // Streaming can seek back to write the index at the end; in-memory puts it up front for fast playback start.
        new Mp4OutputFormat({ fastStart: output ? false : 'in-memory' })
      : new WebMOutputFormat();
  const muxer = new Output({ format, target });
  const source = new CanvasSource(canvas, {
    codec,
    bitrate: job.bitrate,
    keyFrameInterval: 2,
    latencyMode: 'quality',
  });
  muxer.addVideoTrack(source, { frameRate: job.fps });

  const total = frameCount(job);
  const dt = 1 / job.fps;
  const trailDt = dt / subSteps(job.settings, job.fps);
  try {
    await ensureTextFont(job.settings);
    await muxer.start();
    let tl = warmUp(renderer, job.settings, job.fps);
    let lastReport = 0;
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new RenderCancelled();
      renderer.draw(job.settings, tl, trailDt);
      await source.add(i * dt, dt); // captures the canvas synchronously, then waits for encoder backpressure
      tl = advance(renderer, job.settings, tl, job.fps);
      const now = performance.now();
      if (now - lastReport > 100 || i === total - 1) {
        onProgress(i + 1, total);
        lastReport = now;
      }
    }
    source.close();
    await muxer.finalize();
    return target instanceof BufferTarget ? target.buffer : null;
  } catch (err) {
    // Cancelling the muxer aborts the output stream; the caller deletes the partial file.
    if (muxer.state !== 'canceled' && muxer.state !== 'finalized') await muxer.cancel().catch(() => {});
    throw signal.aborted ? new RenderCancelled() : err;
  } finally {
    renderer.destroy();
  }
}
