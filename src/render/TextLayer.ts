import type { Settings } from '../settings/schema';
import { isWall, type TextFrame } from '../engine/text';
import { canvasFont, fontWeight, isFontReady, loadFont } from './fontLoader';

/** Wrapped lines may use this share of the screen width. */
const MAX_LINE_WIDTH = 0.9;
const LINE_HEIGHT = 1.15;
/**
 * Wall spacing, in font sizes. At the densest setting (2) phrases and rows sit this far apart
 * beyond the text's actual ink (outline included), so they never overlap; each step down in
 * density adds the slack below (density 1 adds one of each, 0.5 adds three).
 */
const WALL_MIN_GAP = 0.15;
const WALL_MIN_ROW_MARGIN = 0.08;
const WALL_GAP_SLACK = 0.6;
const WALL_ROW_SLACK = 0.3;
const WALL_MAX_DENSITY = 2;

/**
 * Renders the current phrase (or a wall of them) with Canvas 2D (an OffscreenCanvas, so it
 * works in the render worker) and keeps it in a premultiplied-alpha texture. It only redraws
 * when the text, style or size changes; fading and zooming happen in the shader. A single
 * phrase is drawn centred and positioned by the shader; a wall is drawn in place.
 */
export class TextLayer {
  private canvas = new OffscreenCanvas(1, 1);
  private ctx = this.canvas.getContext('2d')!;
  readonly texture: WebGLTexture;
  private key = '';

  /** `onFontReady` is called when a font finishes downloading, so the frame can be redrawn. */
  constructor(
    private gl: WebGL2RenderingContext,
    private onFontReady: () => void = () => {},
  ) {
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    // 1×1 transparent placeholder so the sampler is always complete.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Makes sure the texture shows `text` at the given size; cheap when nothing changed. */
  update(s: Settings, text: TextFrame, width: number, height: number): void {
    const { phrase } = text;
    if (!phrase) return;
    const weight = fontWeight(s.textFont, s.textBold);
    const ready = isFontReady(s.textFont, weight);
    if (!ready) {
      // Draw with the fallback now; redraw with the real font once it arrives.
      void loadFont(s.textFont, weight).then(() => {
        this.key = '';
        this.onFontReady();
      });
    }
    const wall = isWall(s);
    const layout = wall ? [s.textLayout, text.slot, s.textLayout === 'wallAlt' ? text.alt : '', s.textX, s.textY, s.textWallDensity] : [];
    const key = JSON.stringify([ready, phrase, s.textFont, weight, s.textSize, s.textColor, s.textOutline, s.textOutlineColor, s.textGlow, s.textGlowColor, width, height, layout]);
    if (key === this.key) return;
    this.key = key;
    this.prepare(s, width, height);
    if (wall) this.drawWall(s, text, width, height);
    else this.drawSingle(s, phrase, width, height);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  private fontPx = 0;

  private prepare(s: Settings, width: number, height: number): void {
    const { canvas, ctx } = this;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    this.fontPx = Math.max(4, s.textSize * Math.min(width, height));
    ctx.font = canvasFont(s.textFont, fontWeight(s.textFont, s.textBold), this.fontPx);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
  }

  private drawText(s: Settings, text: string, x: number, y: number): void {
    const { ctx } = this;
    if (s.textGlow > 0) {
      // The glow is the shadow of a copy of the text; a second copy makes strong glows denser.
      ctx.save();
      ctx.shadowColor = s.textGlowColor;
      ctx.shadowBlur = this.fontPx * (0.1 + 0.6 * s.textGlow);
      ctx.fillStyle = s.textGlowColor;
      for (let i = s.textGlow > 0.5 ? 2 : 1; i > 0; i--) ctx.fillText(text, x, y);
      ctx.restore();
    }
    if (s.textOutline > 0) {
      // The stroke is centred on the glyph edge, so double it for the visible outline.
      ctx.lineWidth = s.textOutline * this.fontPx * 2;
      ctx.strokeStyle = s.textOutlineColor;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = s.textColor;
    ctx.fillText(text, x, y);
  }

  /** One phrase, word-wrapped and centred on the canvas. */
  private drawSingle(s: Settings, phrase: string, width: number, height: number): void {
    const lines = wrap(this.ctx, phrase, width * MAX_LINE_WIDTH);
    const lineStep = this.fontPx * LINE_HEIGHT;
    const top = height / 2 - ((lines.length - 1) * lineStep) / 2;
    for (let i = 0; i < lines.length; i++) this.drawText(s, lines[i], width / 2, top + i * lineStep);
  }

  /**
   * Rows of the phrase (or of two alternating phrases) filling the screen. The row through
   * the anchor point always has a phrase centred on it; the other rows get a new sideways
   * offset every slot, so the wall rearranges itself each time a phrase appears.
   */
  private drawWall(s: Settings, text: TextFrame, width: number, height: number): void {
    const words = s.textLayout === 'wallAlt' && text.alt !== text.phrase ? [text.phrase, text.alt] : [text.phrase];
    const widths = words.map((w) => this.ctx.measureText(w).width);
    // Spacing from the measured ink, so the densest setting is as tight as the text allows.
    const metrics = words.map((w) => this.ctx.measureText(w));
    const outline = 2 * s.textOutline * this.fontPx; // an outline reaches this much past each pair of facing edges
    const inkHeight =
      Math.max(...metrics.map((m) => m.actualBoundingBoxAscent)) + Math.max(...metrics.map((m) => m.actualBoundingBoxDescent));
    const slack = WALL_MAX_DENSITY / s.textWallDensity - 1; // 0 at the densest, 1 at density 1
    const gap = outline + this.fontPx * (WALL_MIN_GAP + WALL_GAP_SLACK * slack);
    const rowStep = inkHeight + outline + this.fontPx * (WALL_MIN_ROW_MARGIN + WALL_ROW_SLACK * slack);
    const minRes = Math.min(width, height);
    const ax = width / 2 + (s.textX * minRes) / 2;
    const ay = height / 2 - (s.textY * minRes) / 2;
    const cell = widths[0] + gap;

    const firstRow = -Math.ceil(ay / rowStep) - 1;
    const lastRow = Math.ceil((height - ay) / rowStep) + 1;
    for (let r = firstRow; r <= lastRow; r++) {
      const y = ay + r * rowStep;
      const cx0 = ax + (r === 0 ? 0 : hash01(text.slot, r) * cell);
      const wordAt = (j: number) => ((j + r) % words.length + words.length) % words.length;
      // Centre cell, then outwards to the right and to the left.
      let k = wordAt(0);
      this.drawText(s, words[k], cx0, y);
      let right = cx0 + widths[k] / 2;
      for (let j = 1; right + gap < width; j++) {
        k = wordAt(j);
        this.drawText(s, words[k], right + gap + widths[k] / 2, y);
        right += gap + widths[k];
      }
      let left = cx0 - widths[wordAt(0)] / 2;
      for (let j = -1; left - gap > 0; j--) {
        k = wordAt(j);
        this.drawText(s, words[k], left - gap - widths[k] / 2, y);
        left -= gap + widths[k];
      }
    }
  }

  destroy(): void {
    this.gl.deleteTexture(this.texture);
  }
}

/** Greedy word wrap; a single word wider than the line is left to overflow. */
function wrap(ctx: OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Deterministic pseudo-random number in [0, 1) for a (slot, row) pair. */
function hash01(slot: number, row: number): number {
  let h = Math.imul(slot ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(row + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
