import type { Settings } from '../settings/schema';
import { MAX_BAND_COLORS } from '../settings/schema';
import { COLOR_PERIOD, type TimelineState } from '../engine/timeline';
import { pulses } from '../engine/rhythm';
import { textFrame } from '../engine/text';
import { TextLayer } from './TextLayer';
import { averageRgb, hexToRgb, type RGB } from './color';
import {
  createContext,
  createProgram,
  createTarget,
  deleteTarget,
  FULLSCREEN_VS,
  type AnyCanvas,
  type Program,
  type RenderTarget,
} from './gl';
import sceneFs from './shaders/scene.frag.glsl?raw';
import postFs from './shaders/post.frag.glsl?raw';

const MODES = { archimedean: 0, logarithmic: 1, concentric: 2, power: 3 } as const;
const COLOR_MODES = { static: 0, gradient: 1, cycle: 2, kaleido: 3 } as const;
const BLENDS = { normal: 0, add: 1, multiply: 2, screen: 3, difference: 4 } as const;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** The trails slider is the fraction of the afterimage kept per 1/60 s. */
const TRAIL_REFERENCE_FPS = 60;

/** Weight of the previous afterimage for a frame lasting `dt` seconds (time-based, so fps-independent). */
export function trailWeight(trails: number, dt: number): number {
  return trails > 0 && dt > 0 ? Math.pow(trails, dt * TRAIL_REFERENCE_FPS) : 0;
}

/** Frames to render before recording so the afterimage has built up (fades below 1/255). */
export function trailWarmupFrames(trails: number, fps: number): number {
  const w = trailWeight(trails, 1 / fps);
  if (w <= 0) return 0;
  return Math.min(1200, Math.ceil(Math.log(1 / 255) / Math.log(w)));
}

/**
 * Owns the WebGL2 context and draws one frame from (settings, timeline). Works on the main
 * thread or in a worker. With trails or a vignette active, the scene renders to a texture and
 * post passes composite it; otherwise it draws straight to the screen.
 */
export class Renderer {
  private gl: WebGL2RenderingContext;
  private scene!: Program;
  private post!: Program;
  private vao!: WebGLVertexArrayObject;
  private text!: TextLayer;
  private lost = false;
  private colorBuf = new Float32Array(3 * MAX_BAND_COLORS * 3);

  private sceneTarget: RenderTarget | null = null;
  /** Ping-pong afterimage buffers: history[0] is the latest. */
  private history: [RenderTarget | null, RenderTarget | null] = [null, null];
  private historyValid = false;

  /** `onNeedsRedraw`: something changed asynchronously (e.g. a font finished loading). */
  constructor(
    readonly canvas: AnyCanvas,
    private onNeedsRedraw: () => void = () => {},
  ) {
    this.gl = createContext(canvas);
    this.canvas.addEventListener('webglcontextlost', this.onLost as EventListener);
    this.canvas.addEventListener('webglcontextrestored', this.onRestored as EventListener);
    this.initResources();
  }

  private onLost = (e: Event) => {
    e.preventDefault(); // allow restoration
    this.lost = true;
  };

  private onRestored = () => {
    // Old GL objects died with the context.
    this.sceneTarget = null;
    this.history = [null, null];
    this.historyValid = false;
    this.initResources();
    this.lost = false;
  };

  private initResources(): void {
    const gl = this.gl;
    this.scene = createProgram(gl, FULLSCREEN_VS, sceneFs);
    this.post = createProgram(gl, FULLSCREEN_VS, postFs);
    this.vao = gl.createVertexArray()!;
    this.text = new TextLayer(gl, () => this.onNeedsRedraw());
  }

  get isLost(): boolean {
    return this.lost;
  }

  /** Sets the drawing-buffer size in device pixels. */
  resize(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  /** (Re)creates the offscreen targets when the canvas size changed. */
  private ensureTargets(width: number, height: number): void {
    const gl = this.gl;
    if (this.sceneTarget?.width === width && this.sceneTarget.height === height) return;
    deleteTarget(gl, this.sceneTarget);
    deleteTarget(gl, this.history[0]);
    deleteTarget(gl, this.history[1]);
    this.sceneTarget = createTarget(gl, width, height);
    this.history = [createTarget(gl, width, height), createTarget(gl, width, height)];
    this.historyValid = false;
  }

  /**
   * Draws one frame. `dt` is the time since the previous frame, which drives the
   * afterimage fade; 0 (e.g. a redraw while paused) shows the scene without trails.
   */
  draw(s: Settings, tl: TimelineState, dt = 0): void {
    if (this.lost) return;
    const gl = this.gl;
    const { width, height } = this.canvas;
    const trailMix = trailWeight(s.trails, dt);
    const needsPost = s.trails > 0 || s.vignette > 0;

    gl.viewport(0, 0, width, height);
    gl.bindVertexArray(this.vao);

    if (!needsPost) {
      this.historyValid = false;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.drawScene(s, tl, width, height, true);
      return;
    }

    this.ensureTargets(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneTarget!.framebuffer);
    this.drawScene(s, tl, width, height, false);

    const p = this.post;
    gl.useProgram(p.program);
    gl.uniform2f(p.loc('uResolution'), width, height);
    gl.uniform1i(p.loc('uSource'), 0);
    gl.uniform1i(p.loc('uHistory'), 1);

    let present = this.sceneTarget!;
    if (s.trails > 0) {
      // Feedback: new afterimage = mix(scene, previous afterimage), written to the other buffer.
      const [prev, next] = this.history;
      gl.bindFramebuffer(gl.FRAMEBUFFER, next!.framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget!.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, prev!.texture);
      gl.uniform1i(p.loc('uPass'), 0);
      gl.uniform1f(p.loc('uTrailMix'), this.historyValid ? trailMix : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.history = [next, prev];
      this.historyValid = true;
      present = next!;
    } else {
      this.historyValid = false;
    }

    // Final: vignette + dither to the screen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, present.texture);
    gl.uniform1i(p.loc('uPass'), 1);
    gl.uniform1f(p.loc('uVignette'), s.vignette);
    gl.uniform1f(p.loc('uVignetteSize'), s.vignetteSize);
    gl.uniform3fv(p.loc('uVignetteColor'), hexToRgb(s.vignetteColor));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private drawScene(s: Settings, tl: TimelineState, width: number, height: number, dither: boolean): void {
    const gl = this.gl;
    const { loc, program } = this.scene;
    gl.useProgram(program);

    // Bands: 0 = spiral 1 arms, 1 = spiral 1 gaps, 2 = spiral 2 arms.
    const bands = [s.armColors, s.gapColors, s.s2Colors].map((list) => list.map(hexToRgb));
    bands.forEach((list, band) => list.forEach((c, i) => this.colorBuf.set(c, (band * MAX_BAND_COLORS + i) * 3)));
    const [armAvg, gapAvg, s2Avg] = bands.map(averageRgb);
    // Area-weighted average of arms and gaps, for the anti-moiré fade.
    const avg1 = armAvg.map((a, i) => a * s.balance + gapAvg[i] * (1 - s.balance)) as RGB;

    const pulse = pulses(s, tl.beatPhase);

    gl.uniform2f(loc('uResolution'), width, height);
    gl.uniform1f(loc('uZoom'), s.zoom * pulse.zoom);
    gl.uniform1i(loc('uShape'), s.shape === 'polygon' ? 1 : 0);
    gl.uniform1f(loc('uSides'), s.sides);
    gl.uniform1f(loc('uExponent'), s.exponent);
    gl.uniform1f(loc('uCenterSpread'), s.centerSpread);
    gl.uniform1f(loc('uCenterTaper'), s.centerTaper);
    gl.uniform1f(loc('uSoftness'), s.softness);
    gl.uniform1f(loc('uTwist'), s.twist);
    gl.uniform1f(loc('uWobble'), s.wobble);
    gl.uniform1f(loc('uWobbleFreq'), s.wobbleFreq);
    gl.uniform1f(loc('uWobblePhase'), tl.wobblePhase);

    const spirals = [
      { mode: s.mode, arms: s.arms, density: s.density, flow: tl.flowPhase, mirror: s.mirror, width: s.balance },
      { mode: s.s2Mode, arms: s.s2Arms, density: s.s2Density, flow: tl.flowPhase2, mirror: s.s2Mirror, width: s.s2Width },
    ];
    spirals.forEach((sp, i) => {
      const u = `uSpiral[${i}].`;
      // Reduce the flow phase to a small period that is still a multiple of the arm count
      // (and of every colour count), keeping stripe indices stable with full float precision.
      const period = lcm(Math.round(sp.arms), COLOR_PERIOD);
      gl.uniform1i(loc(u + 'mode'), MODES[sp.mode]);
      gl.uniform1f(loc(u + 'arms'), sp.arms);
      gl.uniform1f(loc(u + 'density'), sp.density);
      gl.uniform1f(loc(u + 'flow'), sp.flow % period);
      gl.uniform1f(loc(u + 'mirror'), sp.mirror ? -1 : 1);
      gl.uniform1f(loc(u + 'width'), sp.width);
    });

    gl.uniform3fv(loc('uColors'), this.colorBuf);
    gl.uniform1iv(loc('uCount'), bands.map((b) => b.length));
    gl.uniform1iv(loc('uColorMode'), [s.armColorMode, s.gapColorMode, s.s2ColorMode].map((m) => COLOR_MODES[m]));
    gl.uniform1fv(loc('uShift'), [tl.armColorPhase, tl.gapColorPhase, tl.s2ColorPhase]);
    gl.uniform3fv(loc('uAvg1'), avg1);
    gl.uniform3fv(loc('uAvg2'), s2Avg);

    gl.uniform1i(loc('uS2Enabled'), s.s2Enabled ? 1 : 0);
    gl.uniform1f(loc('uS2Opacity'), s.s2Opacity);
    gl.uniform1i(loc('uS2Blend'), BLENDS[s.s2Blend]);


    gl.uniform1f(loc('uHueShift'), tl.huePhase * Math.PI * 2);
    gl.uniform1f(loc('uFlash'), pulse.flash);
    gl.uniform3fv(loc('uFlashColor'), hexToRgb(s.flashColor));
    gl.uniform1f(loc('uInvert'), pulse.invert);

    const text = textFrame(s, tl.time, tl.beatPhase);
    const textOn = text.phrase !== '' && text.alpha > 0;
    if (textOn) this.text.update(s, text.phrase, width, height);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.text.texture);
    gl.uniform1i(loc('uText'), 2);
    gl.uniform1i(loc('uTextOn'), textOn ? 1 : 0);
    gl.uniform1f(loc('uTextAlpha'), text.alpha);
    gl.uniform1f(loc('uTextScale'), text.scale);
    gl.uniform1f(loc('uTextY'), s.textY);
    gl.uniform1f(loc('uTextFlash'), text.flash);
    gl.uniform3fv(loc('uTextFlashColor'), hexToRgb(s.textFlashColor));
    gl.uniform1i(loc('uDither'), dither ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Copies the frame just drawn into `out` (RGBA, top row first). Must run in the same
   * task as `draw`, before the browser presents the canvas.
   */
  readPixels(out: Uint8Array): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, out);
    // GL rows run bottom-up; flip in place.
    const stride = width * 4;
    const row = new Uint8Array(stride);
    for (let top = 0, bottom = height - 1; top < bottom; top++, bottom--) {
      const a = top * stride;
      const b = bottom * stride;
      row.set(out.subarray(a, a + stride));
      out.copyWithin(a, b, b + stride);
      out.set(row, b);
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost as EventListener);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored as EventListener);
    this.text.destroy();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
