import type { Settings } from '../settings/schema';
import { MAX_BAND_COLORS } from '../settings/schema';
import { COLOR_PERIOD, type TimelineState } from '../engine/timeline';
import { averageRgb, hexToRgb, type RGB } from './color';
import { createContext, createProgram, FULLSCREEN_VS, type AnyCanvas, type Program } from './gl';
import sceneFs from './shaders/scene.frag.glsl?raw';

const MODES = { archimedean: 0, logarithmic: 1, concentric: 2, power: 3 } as const;
const COLOR_MODES = { static: 0, gradient: 1, cycle: 2, kaleido: 3 } as const;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** Owns the WebGL2 context and draws one frame from (settings, timeline). Works on the main thread or in a worker. */
export class Renderer {
  private gl: WebGL2RenderingContext;
  private scene!: Program;
  private vao!: WebGLVertexArrayObject;
  private lost = false;
  private armBuf = new Float32Array(MAX_BAND_COLORS * 3);
  private gapBuf = new Float32Array(MAX_BAND_COLORS * 3);

  constructor(readonly canvas: AnyCanvas) {
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
    this.initResources();
    this.lost = false;
  };

  private initResources(): void {
    const gl = this.gl;
    this.scene = createProgram(gl, FULLSCREEN_VS, sceneFs);
    this.vao = gl.createVertexArray()!;
  }

  get isLost(): boolean {
    return this.lost;
  }

  /** Sets the drawing-buffer size in device pixels. */
  resize(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  draw(s: Settings, tl: TimelineState): void {
    if (this.lost) return;
    const gl = this.gl;
    const { width, height } = this.canvas;
    const { loc } = this.scene;

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.scene.program);

    const armColors = s.armColors.map(hexToRgb);
    const gapColors = s.gapColors.map(hexToRgb);
    armColors.forEach((c, i) => this.armBuf.set(c, i * 3));
    gapColors.forEach((c, i) => this.gapBuf.set(c, i * 3));
    // Area-weighted average of both bands, for the anti-moiré fade.
    const armAvg = averageRgb(armColors);
    const gapAvg = averageRgb(gapColors);
    const avg = armAvg.map((a, i) => a * s.balance + gapAvg[i] * (1 - s.balance)) as RGB;

    // Reduce the flow phase to a small period that is still a multiple of the arm count
    // (and of every colour count), keeping stripe indices stable with full float precision.
    const flowPeriod = lcm(Math.round(s.arms), COLOR_PERIOD);
    const flowPhase = tl.flowPhase % flowPeriod;

    gl.uniform2f(loc('uResolution'), width, height);
    gl.uniform1i(loc('uMode'), MODES[s.mode]);
    gl.uniform1f(loc('uArms'), s.arms);
    gl.uniform1f(loc('uDensity'), s.density);
    gl.uniform1f(loc('uExponent'), s.exponent);
    gl.uniform1f(loc('uCenterSpread'), s.centerSpread);
    gl.uniform1f(loc('uBalance'), s.balance);
    gl.uniform1f(loc('uCenterTaper'), s.centerTaper);
    gl.uniform1f(loc('uSoftness'), s.softness);
    gl.uniform1f(loc('uZoom'), s.zoom);
    gl.uniform1f(loc('uFlowPhase'), flowPhase);
    gl.uniform1f(loc('uTwist'), s.mirror ? -1 : 1);
    gl.uniform1f(loc('uHueShift'), tl.huePhase * Math.PI * 2);

    gl.uniform3fv(loc('uArmColors'), this.armBuf);
    gl.uniform3fv(loc('uGapColors'), this.gapBuf);
    gl.uniform1i(loc('uArmCount'), armColors.length);
    gl.uniform1i(loc('uGapCount'), gapColors.length);
    gl.uniform1i(loc('uArmColorMode'), COLOR_MODES[s.armColorMode]);
    gl.uniform1i(loc('uGapColorMode'), COLOR_MODES[s.gapColorMode]);
    gl.uniform1f(loc('uArmShift'), tl.armColorPhase);
    gl.uniform1f(loc('uGapShift'), tl.gapColorPhase);
    gl.uniform3fv(loc('uAvgColor'), avg);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Copies the frame just drawn into `out` (RGBA, top row first). Must run in the same
   * task as `draw`, before the browser presents the canvas.
   */
  readPixels(out: Uint8Array): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
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
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
