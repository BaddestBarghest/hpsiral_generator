// Animated GIF render (gifenc). Loaded lazily; runs in the render worker or inline.
import { applyPalette, GIFEncoder, quantize, type Palette } from 'gifenc';
import { initialTimeline, step } from '../engine/timeline';
import { loopMax, loopsChangeColours } from '../engine/modulation';
import { sequenceLooks } from '../engine/sequence';
import { Renderer } from '../render/Renderer';
import { frameCount, type RenderJob } from './renderJob';
import { RenderCancelled } from './renderErrors';
import { advance, subSteps, warmUp } from './warmup';
import { ensureTextFont } from '../render/fontLoader';

const PALETTE_SAMPLES = 8;
/** Every Nth pixel of each sample frame feeds the palette; plenty for 256 colours. */
const SAMPLE_STRIDE = 3;

/**
 * Renders `job` as a GIF that repeats forever. Returns the bytes, or `null` when they
 * were written to `output` (closed on success, aborted on failure).
 */
export async function renderGif(
  job: RenderJob,
  output: WritableStream | undefined,
  signal: AbortSignal,
  onProgress: (frame: number, total: number) => void,
): Promise<ArrayBuffer | null> {
  const { width, height, settings } = job;
  const canvas = new OffscreenCanvas(width, height);
  const renderer = new Renderer(canvas);
  renderer.resize(width, height);
  const pixels = new Uint8Array(width * height * 4);
  const total = frameCount(job);
  const trailDt = 1 / (job.fps * subSteps(settings, job.fps));
  const delayMs = Math.round(100 / job.fps) * 10; // GIF stores hundredths of a second

  try {
    await ensureTextFont(settings);
    // Colours that change over time can't be covered by one 256-colour palette without
    // visibly stepping, so those GIFs get a palette per frame. Otherwise one shared palette
    // avoids edge flicker between frames and keeps the file smaller.
    const sharedPalette = colorsAnimate(job) ? null : buildPalette(renderer, pixels, job, total);
    const gif = GIFEncoder();
    let tl = warmUp(renderer, settings, job.fps);
    let lastReport = 0;
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new RenderCancelled();
      renderer.draw(settings, tl, trailDt);
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
      tl = advance(renderer, settings, tl, job.fps);
      const now = performance.now();
      if (now - lastReport > 100 || i === total - 1) {
        onProgress(i + 1, total);
        lastReport = now;
        await yieldToEvents(); // lets a cancel message through
      }
    }
    gif.finish();
    const bytes = gif.bytes();

    if (output) {
      const writer = output.getWriter();
      await writer.write(bytes);
      await writer.close();
      return null;
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } catch (err) {
    // Nothing was written yet (the GIF is written in one go at the end); release the file.
    if (output && !output.locked) await output.abort(err).catch(() => {});
    throw signal.aborted ? new RenderCancelled() : err;
  } finally {
    renderer.destroy();
  }
}

/**
 * Whether colours change over time (hue roll, trails, beat loops, shifting through several
 * colours, or a sequence moving between scenes).
 */
function colorsAnimate({ settings }: RenderJob): boolean {
  const looks = sequenceLooks(settings);
  if (looks.length > 1) return true;
  const s = looks[0];
  return (
    s.hueRoll !== 0 ||
    loopMax(s, 'trails') > 0 || // blended echoes create colours no sample frame contains
    loopsChangeColours(s) || // e.g. a pulsing glow blends through in-between colours
    s.textEnabled || // text (and its fades/flash) may not appear in any sample frame
    (s.armColors.length > 1 && s.armShift !== 0) ||
    (s.gapColors.length > 1 && s.gapShift !== 0) ||
    (s.s2Enabled && s.s2Colors.length > 1 && s.s2Shift !== 0)
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
