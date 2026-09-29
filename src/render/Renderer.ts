import type { Settings } from '../settings/schema';
import { MAX_PALETTE } from '../settings/schema';
import type { TimelineState } from '../engine/timeline';
import { averageRgb, hexToRgb } from './color';
import { createContext, createProgram, FULLSCREEN_VS, type AnyCanvas, type Program } from './gl';
import sceneFs from './shaders/scene.frag.glsl?raw';

const MODES = { archimedean: 0, logarithmic: 1, concentric: 2 } as const;

/** Owns the WebGL2 context and draws one frame from (settings, timeline). Works on the main thread or in a worker. */
export class Renderer {
  private gl: WebGL2RenderingContext;
  private scene!: Program;
  private vao!: WebGLVertexArrayObject;
  private lost = false;
  private paletteBuf = new Float32Array(MAX_PALETTE * 3);

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

    const colors = s.palette.map(hexToRgb);
    colors.forEach((c, i) => this.paletteBuf.set(c, i * 3));

    gl.uniform2f(loc('uResolution'), width, height);
    gl.uniform1i(loc('uMode'), MODES[s.mode]);
    gl.uniform1f(loc('uArms'), s.arms);
    gl.uniform1f(loc('uDensity'), s.density);
    gl.uniform1f(loc('uCenterSpread'), s.centerSpread);
    gl.uniform1f(loc('uBalance'), s.balance);
    gl.uniform1f(loc('uSoftness'), s.softness);
    gl.uniform1f(loc('uZoom'), s.zoom);
    gl.uniform1f(loc('uFlowPhase'), tl.flowPhase);
    gl.uniform1f(loc('uTwist'), s.mirror ? -1 : 1);
    gl.uniform3fv(loc('uPalette'), this.paletteBuf);
    gl.uniform1i(loc('uPaletteSize'), colors.length);
    gl.uniform3fv(loc('uPaletteAvg'), averageRgb(colors));
    gl.uniform1i(loc('uColorMode'), s.colorMode === 'gradient' ? 1 : 0);
    gl.uniform1f(loc('uHueShift'), tl.huePhase * Math.PI * 2);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost as EventListener);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored as EventListener);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
