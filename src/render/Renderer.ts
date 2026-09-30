import type { Settings } from '../settings/schema';
import { COLOR_PERIOD, type TimelineState } from '../engine/timeline';
import { colorStepPhase, pulses, type Pulses } from '../engine/rhythm';
import { isWall, textFrame, type TextFrame } from '../engine/text';
import { lcm } from '../engine/math';
import { applyBeatLoops, loopMax } from '../engine/modulation';
import { resolveSequence, sequenceActive } from '../engine/sequence';
import { heartRadii } from './shapes';
import { ARM_CURVE_CODES, armShape } from './armCurves';
import { TextLayer } from './TextLayer';
import { averageRgb, hexToRgb, PALETTE_CYCLE, PALETTE_SAMPLES, paletteStrip, type RGB } from './color';
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
import sceneSrc from './shaders/scene.frag.glsl?raw';
import postSrc from './shaders/post.frag.glsl?raw';
import finishSrc from './shaders/finish.glsl?raw';
import blurSrc from './shaders/blur.frag.glsl?raw';

// GLSL has no includes; splice the shared finishing code into both shaders.
const withFinish = (src: string) => src.replace('#include "finish.glsl"', finishSrc);
const SOURCES = { scene: withFinish(sceneSrc), post: withFinish(postSrc), blur: blurSrc };

/**
 * Compile-time switches for a shader variant. Features that are off are left out of the
 * shader entirely rather than skipped by a runtime branch, which some drivers still pay for.
 */
interface SceneVariant {
  /** The globe's code is only compiled when a spiral uses it. */
  GLOBE: 0 | 1;
  /** Draw the auxiliary spiral. */
  S2: 0 | 1;
  /** Outline shape. */
  SHAPE: (typeof SHAPES)[keyof typeof SHAPES];
  /** Straight to the screen: apply the finishing steps (vignette, text, pulses, dither). */
  FINISH: 0 | 1;
  TEXT_MODE: TextMode;
}
interface PostVariant {
  /** 0 spiral afterimage, 1 final output, 2 text afterimage. */
  PASS: 0 | 1 | 2;
  TEXT_MODE: TextMode;
  /** Final pass: add the glow. */
  GLOW: 0 | 1;
}

/** The glow is blurred at this fraction of the screen resolution (it's soft anyway). */
const GLOW_SCALE = 0.25;

/** Echoes fall below one 8-bit level after about this many half-lives. */
const TRAIL_HALF_LIVES_TO_FADE = 8;

/** How the finishing step gets its text (see finish.glsl). */
const TEXT_MODE = { none: 0, texture: 1, layer: 2 } as const;
type TextMode = (typeof TEXT_MODE)[keyof typeof TEXT_MODE];

const MODES = { spiral: 0, concentric: 2, globe: 5 } as const;
const SHAPES = { round: 0, polygon: 1, star: 2, heart: 3 } as const;
/** Outline tables for the shapes without a formula. */
const OUTLINES: Partial<Record<Settings['shape'], Float32Array>> = { heart: heartRadii() };
const COLOR_MODES = { static: 0, gradient: 1, cycle: 2, kaleido: 3 } as const;
const BLENDS = { normal: 0, add: 1, multiply: 2, screen: 3, difference: 4 } as const;

/**
 * Weight of the previous afterimage for a frame lasting `dt` seconds. `trails` is the
 * afterimage's half-life in seconds (time-based, so fps-independent).
 */
export function trailWeight(trails: number, dt: number): number {
  return trails > 0 && dt > 0 ? Math.pow(0.5, dt / trails) : 0;
}

/** Frames to render before recording so the afterimages have built up (fade below 1/255). */
export function trailWarmupFrames(live: Settings, fps: number): number {
  const s = resolveSequence(live, 0); // renders start at the first scene
  const w = trailWeight(Math.max(loopMax(s, 'trails'), s.textEnabled ? s.textTrails : 0), 1 / fps);
  if (w <= 0) return 0;
  return Math.min(1200, Math.ceil(Math.log(1 / 255) / Math.log(w)));
}

/**
 * Owns the WebGL2 context and draws one frame from (settings, timeline). Works on the main
 * thread or in a worker. Without afterimages everything (spirals, vignette, text, pulses)
 * is drawn in one pass straight to the screen. An afterimage needs the frame kept: the
 * spirals then render to a texture, fading text to a layer of its own, and a final pass
 * composites them.
 */
export class Renderer {
  private gl: WebGL2RenderingContext;
  /** Compiled shader variants, built the first time each is needed. */
  private programs = new Map<string, Program>();
  private vao!: WebGLVertexArrayObject;
  private text!: TextLayer;
  private lost = false;
  /** Palette strips (one row per colour band), rebuilt only when a palette changes. */
  private palette!: WebGLTexture;
  private paletteKey = '';
  private paletteBuf = new Uint8Array(PALETTE_CYCLE * PALETTE_SAMPLES * 3 * 4);

  private sceneTarget: RenderTarget | null = null;
  /** Ping-pong afterimage buffers: history[0] is the latest. */
  private history: [RenderTarget | null, RenderTarget | null] = [null, null];
  private historyValid = false;
  /** Ping-pong text layer (premultiplied), holding the text's own afterimage. */
  private textHistory: [RenderTarget | null, RenderTarget | null] = [null, null];
  private textHistoryValid = false;
  /** Seconds since text was last on screen; the text layer is dropped once its echoes fade. */
  private textHiddenFor = Infinity;
  /** Reduced-resolution targets for the glow: downscaled image and blur ping-pong; [0] ends up blurred. */
  private glowTargets: [RenderTarget | null, RenderTarget | null] = [null, null];

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
    this.programs.clear();
    this.sceneTarget = null;
    this.history = [null, null];
    this.historyValid = false;
    this.textHistory = [null, null];
    this.textHistoryValid = false;
    this.glowTargets = [null, null];
    this.initResources();
    this.lost = false;
  };

  private initResources(): void {
    const gl = this.gl;
    this.vao = gl.createVertexArray()!;
    this.palette = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, PALETTE_CYCLE * PALETTE_SAMPLES, 3);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // palettes wrap round
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.paletteKey = '';
    this.text = new TextLayer(gl, () => this.onNeedsRedraw());
  }

  /** The shader variant for these switches, compiled on first use. */
  private program(kind: 'scene', v: SceneVariant): Program;
  private program(kind: 'post', v: PostVariant): Program;
  private program(kind: 'blur', v: { DOWNSAMPLE: 0 | 1 }): Program;
  private program(kind: keyof typeof SOURCES, v: SceneVariant | PostVariant | { DOWNSAMPLE: 0 | 1 }): Program {
    const key = kind + JSON.stringify(v);
    let prog = this.programs.get(key);
    if (!prog) {
      const defines = Object.entries(v).map(([k, x]) => `#define ${k} ${x}\n`).join('');
      const src = SOURCES[kind].replace(/^#version 300 es\r?\n/, (line) => line + defines);
      prog = createProgram(this.gl, FULLSCREEN_VS, src);
      this.programs.set(key, prog);
    }
    this.gl.useProgram(prog.program);
    return prog;
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
    deleteTarget(gl, this.textHistory[0]);
    deleteTarget(gl, this.textHistory[1]);
    deleteTarget(gl, this.glowTargets[0]);
    deleteTarget(gl, this.glowTargets[1]);
    const gw = Math.max(1, Math.round(width * GLOW_SCALE));
    const gh = Math.max(1, Math.round(height * GLOW_SCALE));
    this.glowTargets = [createTarget(gl, gw, gh, true), createTarget(gl, gw, gh, true)];
    this.sceneTarget = createTarget(gl, width, height);
    this.history = [createTarget(gl, width, height), createTarget(gl, width, height)];
    this.historyValid = false;
    this.textHistory = [createTarget(gl, width, height), createTarget(gl, width, height)];
    this.textHistoryValid = false;
  }

  /**
   * Draws one frame. `dt` is the time since the previous frame, which drives the
   * afterimage fade; 0 (e.g. a redraw while paused) shows the scene without trails.
   * `show = false` only updates the afterimages (an unsaved in-between frame of a render).
   */
  draw(live: Settings, tl: TimelineState, dt = 0, show = true): void {
    if (this.lost) return;
    const gl = this.gl;
    const { width, height } = this.canvas;
    // The scene showing when a sequence plays; everything below sees the beat-looped values.
    const settings = resolveSequence(live, tl.seqPos);
    const s = applyBeatLoops(settings, tl.beatPhase);
    const pulse = pulses(s, tl.beatPhase);

    const text = textFrame(s, tl.time, tl.beatPhase);
    const textOn = s.textEnabled && text.phrase !== '' && text.alpha > 0;
    if (textOn) this.text.update(s, text, width, height);
    this.textHiddenFor = textOn ? 0 : this.textHiddenFor + dt;
    // The text layer only needs keeping while it has echoes left to fade.
    const textTrail =
      s.textEnabled && s.textTrails > 0 && this.textHiddenFor <= s.textTrails * TRAIL_HALF_LIVES_TO_FADE;
    // Decided from the loop's highest value, so a loop dipping to 0 doesn't reset the afterimage.
    const spiralTrail = loopMax(settings, 'trails') > 0;
    const glow = loopMax(settings, 'glow') > 0;

    gl.viewport(0, 0, width, height);
    gl.bindVertexArray(this.vao);
    const S2 = s.s2Enabled ? 1 : 0;
    const SHAPE = SHAPES[s.shape];
    const GLOBE = s.mode === 'globe' || (s.s2Enabled && s.s2Mode === 'globe') ? 1 : 0;

    if (!spiralTrail && !textTrail && !glow) {
      // Nothing to keep or blur: one pass straight to the screen.
      this.historyValid = false;
      this.textHistoryValid = false;
      if (!show) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const prog = this.program('scene', { GLOBE, S2, SHAPE, FINISH: 1, TEXT_MODE: textOn ? TEXT_MODE.texture : TEXT_MODE.none });
      this.setScene(prog, s, tl, width, height);
      this.setFinish(prog, s, pulse, text, this.text.texture);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }

    this.ensureTargets(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneTarget!.framebuffer);
    this.setScene(this.program('scene', { GLOBE, S2, SHAPE, FINISH: 0, TEXT_MODE: TEXT_MODE.none }), s, tl, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    let present = this.sceneTarget!;
    if (spiralTrail) {
      // Feedback: new afterimage = mix(scene, previous afterimage), written to the other buffer.
      const [prev, next] = this.history;
      const p = this.program('post', { PASS: 0, TEXT_MODE: TEXT_MODE.none, GLOW: 0 });
      gl.bindFramebuffer(gl.FRAMEBUFFER, next!.framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget!.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, prev!.texture);
      gl.uniform2f(p.loc('uResolution'), width, height);
      gl.uniform1i(p.loc('uSource'), 0);
      gl.uniform1i(p.loc('uHistory'), 1);
      gl.uniform1f(p.loc('uTrailMix'), this.historyValid ? trailWeight(s.trails, dt) : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.history = [next, prev];
      this.historyValid = true;
      present = next!;
    } else {
      this.historyValid = false;
    }

    let textMode: TextMode = textOn ? TEXT_MODE.texture : TEXT_MODE.none;
    let textSource = this.text.texture;
    if (textTrail) {
      // Text layer: the current text over its own fading afterimage.
      const [prev, next] = this.textHistory;
      const p = this.program('post', { PASS: 2, TEXT_MODE: TEXT_MODE.none, GLOW: 0 });
      gl.bindFramebuffer(gl.FRAMEBUFFER, next!.framebuffer);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, prev!.texture);
      gl.uniform2f(p.loc('uResolution'), width, height);
      gl.uniform1i(p.loc('uHistory'), 1);
      this.setFinish(p, s, pulse, text, this.text.texture);
      gl.uniform1f(p.loc('uTrailMix'), this.textHistoryValid ? trailWeight(s.textTrails, dt) : 0);
      gl.uniform1f(p.loc('uTextAlpha'), textOn ? text.alpha : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.textHistory = [next, prev];
      this.textHistoryValid = true;
      textMode = TEXT_MODE.layer;
      textSource = next!.texture;
    } else {
      this.textHistoryValid = false;
    }

    if (!show) return;

    if (glow) this.blurForGlow(present, s.glowSize * Math.min(width, height));

    // Final: glow, vignette, text, pulses and dither to the screen.
    const p = this.program('post', { PASS: 1, TEXT_MODE: textMode, GLOW: glow ? 1 : 0 });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, present.texture);
    gl.uniform2f(p.loc('uResolution'), width, height);
    gl.uniform1i(p.loc('uSource'), 0);
    if (glow) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.glowTargets[0]!.texture);
      gl.uniform1i(p.loc('uBloom'), 3);
      gl.uniform1f(p.loc('uGlow'), s.glow);
      gl.uniform3fv(p.loc('uGlowColor'), hexToRgb(s.glowColor));
    }
    this.setFinish(p, s, pulse, text, textSource);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Blurs `source` into glowTargets[0] at reduced resolution: average 4x4 blocks down into
   * [0], blur horizontally into [1], then vertically back into [0]. `radius` is the spread
   * in screen pixels.
   */
  private blurForGlow(source: RenderTarget, radius: number): void {
    const gl = this.gl;
    const [a, b] = this.glowTargets as [RenderTarget, RenderTarget];
    gl.viewport(0, 0, a.width, a.height);
    gl.activeTexture(gl.TEXTURE0);

    let p = this.program('blur', { DOWNSAMPLE: 1 });
    gl.uniform2f(p.loc('uResolution'), a.width, a.height);
    gl.uniform1i(p.loc('uSource'), 0);
    gl.uniform2f(p.loc('uStep'), 1 / source.width, 1 / source.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    // Screen-sized targets are nearest-filtered; the bilinear taps need linear for this read.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // 9 taps cover ±2 sigma; sigma = radius / 2, so taps are radius / 4 apart (in small-target texels).
    const tap = (radius / 4) * GLOW_SCALE;
    p = this.program('blur', { DOWNSAMPLE: 0 });
    gl.uniform2f(p.loc('uResolution'), a.width, a.height);
    gl.uniform1i(p.loc('uSource'), 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, a.texture);
    gl.uniform2f(p.loc('uStep'), tap / a.width, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, b.texture);
    gl.uniform2f(p.loc('uStep'), 0, tap / a.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Uniforms of the shared finishing step (finish.glsl) on `prog`, which must be in use:
   * vignette, text placement, pulses, flashes and dither. Binds `textTexture` to unit 2.
   */
  private setFinish(prog: Program, s: Settings, pulse: Pulses, text: TextFrame, textTexture: WebGLTexture): void {
    const gl = this.gl;
    const { loc } = prog;
    const { width, height } = this.canvas;
    gl.uniform1f(loc('uVignette'), s.vignette);
    gl.uniform1f(loc('uVignetteSize'), s.vignetteSize);
    gl.uniform3fv(loc('uVignetteColor'), hexToRgb(s.vignetteColor));

    const minRes = Math.min(width, height);
    // A single phrase is drawn centred in its texture and moved here; a wall is drawn in place.
    const anchor = [width / 2 + (s.textX * minRes) / 2, height / 2 + (s.textY * minRes) / 2];
    const origin = isWall(s) ? anchor : [width / 2, height / 2];
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.uniform1i(loc('uText'), 2);
    gl.uniform1f(loc('uTextAlpha'), text.alpha);
    gl.uniform1f(loc('uTextScale'), text.scale);
    gl.uniform2fv(loc('uTextAnchor'), anchor);
    gl.uniform2fv(loc('uTextOrigin'), origin);

    gl.uniform1f(loc('uInvert'), pulse.invert);
    gl.uniform1f(loc('uFlash'), pulse.flash);
    gl.uniform3fv(loc('uFlashColor'), hexToRgb(s.flashColor));
    gl.uniform1f(loc('uTextFlash'), text.flash);
    gl.uniform3fv(loc('uTextFlashColor'), hexToRgb(s.textFlashColor));
    gl.uniform1i(loc('uDither'), 1);
  }

  /** Sets the spiral uniforms on `prog`, a scene variant in use; the caller draws. */
  private setScene(prog: Program, s: Settings, tl: TimelineState, width: number, height: number): void {
    const gl = this.gl;
    const { loc } = prog;

    // Bands: 0 = spiral 1 arms, 1 = spiral 1 gaps, 2 = spiral 2 arms.
    const bands = [s.armColors, s.gapColors, s.s2Colors].map((list) => list.map(hexToRgb));
    const key = JSON.stringify([s.armColors, s.gapColors, s.s2Colors]);
    if (key !== this.paletteKey) {
      this.paletteKey = key;
      const row = PALETTE_CYCLE * PALETTE_SAMPLES * 4;
      bands.forEach((list, band) => paletteStrip(list, this.paletteBuf, band * row));
      gl.bindTexture(gl.TEXTURE_2D, this.palette);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, PALETTE_CYCLE * PALETTE_SAMPLES, 3, gl.RGBA, gl.UNSIGNED_BYTE, this.paletteBuf);
    }
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.uniform1i(loc('uPalette'), 4);
    const [armAvg, gapAvg, s2Avg] = bands.map(averageRgb);
    // Area-weighted average of arms and gaps, for the anti-moiré fade.
    const avg1 = armAvg.map((a, i) => a * s.balance + gapAvg[i] * (1 - s.balance)) as RGB;

    gl.uniform2f(loc('uResolution'), width, height);
    gl.uniform1f(loc('uZoom'), s.zoom * pulses(s, tl.beatPhase).zoom);
    gl.uniform2f(loc('uCenter'), s.centerX, s.centerY);
    // Sampling the pattern turned back by the angle turns what's drawn forwards (anticlockwise).
    const angle = (s.rotation * Math.PI) / 180;
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    gl.uniformMatrix2fv(loc('uRotate'), false, [cos, -sin, sin, cos]);
    gl.uniform1f(loc('uSides'), s.sides);
    gl.uniform1f(loc('uShapeDepth'), s.shapeDepth);
    const outline = OUTLINES[s.shape];
    if (outline) gl.uniform1fv(loc('uOutline[0]'), outline);
    gl.uniform1f(loc('uCenterSpread'), s.centerSpread);
    gl.uniform1f(loc('uCenterTaper'), s.centerTaper);
    gl.uniform1f(loc('uOuterTaper'), s.outerTaper);
    gl.uniform1f(loc('uGradientScale'), s.gradientScale);
    gl.uniform1f(loc('uGlobeTilt'), (s.globeTilt * Math.PI) / 180);
    gl.uniform1f(loc('uSoftness'), s.softness);
    gl.uniform1f(loc('uTwist'), s.twist);
    gl.uniform1f(loc('uWobble'), s.wobble);
    gl.uniform1f(loc('uWobbleFreq'), s.wobbleFreq);
    gl.uniform1f(loc('uWobblePhase'), tl.wobblePhase);

    const spirals = [
      { mode: s.mode, shape: armShape(s, false), arms: s.arms, density: s.density, flow: tl.flowPhase, mirror: s.mirror, width: s.balance },
      { mode: s.s2Mode, shape: armShape(s, true), arms: s.s2Arms, density: s.s2Density, flow: tl.flowPhase2, mirror: s.s2Mirror, width: s.s2Width },
    ];
    spirals.forEach((sp, i) => {
      const u = `uSpiral[${i}].`;
      // Reduce the flow phase to a small period that is still a multiple of the arm count
      // (and of every colour count), keeping stripe indices stable with full float precision.
      const period = lcm(Math.round(sp.arms), COLOR_PERIOD);
      gl.uniform1i(loc(u + 'mode'), MODES[sp.mode]);
      gl.uniform1i(loc(u + 'curve'), ARM_CURVE_CODES[sp.shape.curve]);
      gl.uniform1f(loc(u + 'curveA'), sp.shape.a);
      gl.uniform1f(loc(u + 'curveB'), sp.shape.b);
      gl.uniform1f(loc(u + 'arms'), sp.arms);
      gl.uniform1f(loc(u + 'density'), sp.density);
      gl.uniform1f(loc(u + 'flow'), sp.flow % period);
      gl.uniform1f(loc(u + 'mirror'), sp.mirror ? -1 : 1);
      gl.uniform1f(loc(u + 'width'), sp.width);
    });

    gl.uniform1iv(loc('uColorMode'), [s.armColorMode, s.gapColorMode, s.s2ColorMode].map((m) => COLOR_MODES[m]));
    // A speed of 0 means your exact colours, even while paused (the timeline only resets
    // these phases when it advances). In a sequence the timeline eases them back instead.
    const still = (speed: number) => speed === 0 && !sequenceActive(s);
    // Beat-locked: every shifting palette moves one whole colour per step, on the beat.
    const step = s.colorStep ? colorStepPhase(s, tl.beatPhase) : 0;
    gl.uniform1fv(loc('uShift'), [
      still(s.armShift) ? 0 : s.colorStep && s.armShift !== 0 ? step : tl.armColorPhase,
      still(s.gapShift) ? 0 : s.colorStep && s.gapShift !== 0 ? step : tl.gapColorPhase,
      still(s.s2Shift) ? 0 : s.colorStep && s.s2Shift !== 0 ? step : tl.s2ColorPhase,
    ]);
    gl.uniform1f(loc('uKaleidoTurn'), still(s.kaleidoSpin) && !s.loops.kaleidoSpin ? 0 : tl.kaleidoPhase);
    gl.uniform1f(loc('uKaleidoSectors'), s.kaleidoSectors);
    gl.uniform3fv(loc('uAvg1'), avg1);
    gl.uniform3fv(loc('uAvg2'), s2Avg);

    gl.uniform1f(loc('uS2Opacity'), s.s2Opacity);
    gl.uniform1i(loc('uS2Blend'), BLENDS[s.s2Blend]);


    gl.uniform1f(loc('uHueShift'), still(s.hueRoll) ? 0 : tl.huePhase * Math.PI * 2);
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
