// Animated GIF render (gifenc). Loaded lazily; runs in the render worker or inline.
import { applyPalette, GIFEncoder, quantize, type Palette } from 'gifenc';
import { initialTimeline, step } from '../engine/timeline';
import { Renderer } from '../render/Renderer';
import { frameCount, type RenderJob } from './renderJob';
import { RenderCancelled } from './renderErrors';

const PALETTE_SAMPLES = 8;
/** Every Nth pixel of each sample frame feeds the palette; plenty for 256 colours. */
const SAMPLE_STRIDE = 3;

/**
 * Renders `job` as a GIF that repeats forever. Returns the bytes, or `null` when they
 * were written to `fileHandle`.
 */
export async function renderGif(
  job: RenderJob,
  fileHandle: FileSystemFileHandle | undefined,
  signal: AbortSignal,
  onProgress: (frame: number, total: number) => void,
): Promise<ArrayBuffer | null> {
  const { width, height, settings } = job;
  const canvas = new OffscreenCanvas(width, height);
  const renderer = new Renderer(canvas);
  renderer.resize(width, height);
  const pixels = new Uint8Array(width * height * 4);
  const total = frameCount(job);
  const dt = 1 / job.fps;
  const delayMs = Math.round(100 / job.fps) * 10; // GIF stores hundredths of a second

  try {
    // Colours that change over time can't be covered by one 256-colour palette without
    // visibly stepping, so those GIFs get a palette per frame. Otherwise one shared palette
    // avoids edge flicker between frames and keeps the file smaller.
    const sharedPalette = colorsAnimate(job) ? null : buildPalette(renderer, pixels, job, total);
    const gif = GIFEncoder();
    let tl = initialTimeline();
    let lastReport = 0;
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new RenderCancelled();
      renderer.draw(settings, tl);
      renderer.readPixels(pixels);
      const palette = sharedPalette ?? quantize(pixels, 256);
      const index = applyPalette(pixels, palette);
      // The first frame carries the (global) palette and the loop-forever flag; later frames
      // only pass a palette when it's per-frame (written as a local colour table).
      gif.writeFrame(
        index,
        width,
        height,
        i === 0 ? { palette, delay: delayMs, repeat: 0 } : sharedPalette ? { delay: delayMs } : { palette, delay: delayMs },
      );
      tl = step(tl, settings, dt);
      const now = performance.now();
      if (now - lastReport > 100 || i === total - 1) {
        onProgress(i + 1, total);
        lastReport = now;
        await yieldToEvents(); // lets a cancel message through
      }
    }
    gif.finish();
    const bytes = gif.bytes();

    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      await writable.write(bytes as Uint8Array<ArrayBuffer>);
      await writable.close();
      return null;
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } catch (err) {
    const removable = fileHandle as (FileSystemFileHandle & { remove?: () => Promise<void> }) | undefined;
    await removable?.remove?.().catch(() => {});
    throw signal.aborted ? new RenderCancelled() : err;
  } finally {
    renderer.destroy();
  }
}

/** Whether any colour changes over time (hue roll, or shifting through several colours). */
function colorsAnimate({ settings: s }: RenderJob): boolean {
  return (
    s.hueRoll !== 0 || (s.armColors.length > 1 && s.armShift !== 0) || (s.gapColors.length > 1 && s.gapShift !== 0)
  );
}

/**
 * One palette for the whole GIF, built from frames spread across the loop, so colours
 * don't flicker between frames the way per-frame palettes would.
 */
function buildPalette(renderer: Renderer, pixels: Uint8Array, job: RenderJob, total: number): Palette {
  const samples = Math.min(PALETTE_SAMPLES, total);
  const pixelCount = job.width * job.height;
  const perFrame = Math.ceil(pixelCount / SAMPLE_STRIDE);
  const pool = new Uint8Array(samples * perFrame * 4);
  const wanted = new Set(Array.from({ length: samples }, (_, i) => Math.floor((i * total) / samples)));
  let tl = initialTimeline();
  let o = 0;
  for (let i = 0; i < total && wanted.size; i++) {
    if (wanted.delete(i)) {
      renderer.draw(job.settings, tl);
      renderer.readPixels(pixels);
      for (let p = 0; p < pixelCount; p += SAMPLE_STRIDE) {
        pool.set(pixels.subarray(p * 4, p * 4 + 4), o);
        o += 4;
      }
    }
    tl = step(tl, job.settings, 1 / job.fps);
  }
  return quantize(pool.subarray(0, o), 256);
}

const yieldToEvents = () => new Promise<void>((r) => setTimeout(r, 0));
