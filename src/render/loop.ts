import type { Settings } from '../settings/schema';
import { LiveClock } from '../engine/clock';
import { alignBeat, initialTimeline, step, type TimelineState } from '../engine/timeline';
import { Renderer } from './Renderer';
import type { AnyCanvas } from './gl';
import type { Emit, Viewport } from './protocol';

const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 1000 / 60) as unknown as number;

const caf: (id: number) => void =
  typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

/** Live animation loop. Identical code runs inside the render worker or inline on the main thread. */
export class RenderLoop {
  private renderer: Renderer;
  private clock = new LiveClock();
  private tl: TimelineState = initialTimeline();
  private frameId = 0;
  private dirty = true;
  private frames = 0;
  private statsStart = 0;
  private suspended = false;

  constructor(
    canvas: AnyCanvas,
    private settings: Settings,
    private viewport: Viewport,
    private playing: boolean,
    private emit: Emit,
  ) {
    this.renderer = new Renderer(canvas, () => (this.dirty = true));
    this.applySize();
    this.frameId = raf(this.frame);
  }

  setSettings(s: Settings): void {
    const sizeChanged = s.renderScale !== this.settings.renderScale || s.maxDpr !== this.settings.maxDpr;
    this.settings = s;
    if (sizeChanged) this.applySize();
    this.dirty = true;
  }

  setViewport(v: Viewport): void {
    this.viewport = v;
    this.applySize();
    this.dirty = true;
  }

  setPlaying(p: boolean): void {
    this.playing = p;
    this.clock.reset();
  }

  /** Draws again even while paused (e.g. the text font changed). */
  redraw(): void {
    this.dirty = true;
  }

  /** Makes this moment a beat (tap tempo), so beat effects line up with the taps. */
  alignBeat(): void {
    this.tl = alignBeat(this.tl);
    this.dirty = true;
  }

  /** Freezes the live animation (e.g. during an offline render); resumes without a time jump. */
  setSuspended(s: boolean): void {
    this.suspended = s;
    this.clock.reset();
    this.dirty = true;
  }

  private applySize(): void {
    const { cssWidth, cssHeight, dpr } = this.viewport;
    const k = Math.min(dpr, this.settings.maxDpr) * this.settings.renderScale;
    this.renderer.resize(Math.max(1, Math.round(cssWidth * k)), Math.max(1, Math.round(cssHeight * k)));
  }

  private frame = (now: number) => {
    this.frameId = raf(this.frame);
    if (this.suspended) return;
    const dt = this.clock.tick(now, Number(this.settings.maxFps));
    if (dt === null) return;
    if (this.playing) this.tl = step(this.tl, this.settings, dt);
    if (this.playing || this.dirty) {
      this.renderer.draw(this.settings, this.tl, this.playing ? dt : 0);
      this.dirty = false;
      this.countFrame(now);
    }
  };

  private countFrame(now: number): void {
    if (this.frames === 0) this.statsStart = now;
    this.frames++;
    const elapsed = now - this.statsStart;
    if (elapsed >= 1000) {
      this.emit({ type: 'stats', fps: ((this.frames - 1) * 1000) / elapsed });
      this.frames = 0;
    }
  }

  destroy(): void {
    caf(this.frameId);
    this.renderer.destroy();
  }
}
