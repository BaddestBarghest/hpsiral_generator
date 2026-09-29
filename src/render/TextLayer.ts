import type { Settings } from '../settings/schema';
import { canvasFont, fontWeight, isFontReady, loadFont } from './fontLoader';

/** Wrapped lines may use this share of the screen width. */
const MAX_LINE_WIDTH = 0.9;
const LINE_HEIGHT = 1.15;

/**
 * Renders the current phrase with Canvas 2D (an OffscreenCanvas, so it works in the render
 * worker) and keeps it in a premultiplied-alpha texture. It only redraws when the phrase,
 * style or size changes; fading, zooming and positioning happen in the shader.
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

  /** Makes sure the texture shows `phrase` at the given size; cheap when nothing changed. */
  update(s: Settings, phrase: string, width: number, height: number): void {
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
    const key = JSON.stringify([ready, phrase, s.textFont, weight, s.textSize, s.textColor, s.textOutline, s.textOutlineColor, width, height]);
    if (key === this.key) return;
    this.key = key;
    this.draw(s, phrase, width, height);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  private draw(s: Settings, phrase: string, width: number, height: number): void {
    const { canvas, ctx } = this;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const fontPx = Math.max(4, s.textSize * Math.min(width, height));
    ctx.font = canvasFont(s.textFont, fontWeight(s.textFont, s.textBold), fontPx);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const lines = wrap(ctx, phrase, width * MAX_LINE_WIDTH);
    const lineStep = fontPx * LINE_HEIGHT;
    const top = height / 2 - ((lines.length - 1) * lineStep) / 2;
    for (let i = 0; i < lines.length; i++) {
      const y = top + i * lineStep;
      if (s.textOutline > 0) {
        // The stroke is centred on the glyph edge, so double it for the visible outline.
        ctx.lineWidth = s.textOutline * fontPx * 2;
        ctx.strokeStyle = s.textOutlineColor;
        ctx.strokeText(lines[i], width / 2, y);
      }
      ctx.fillStyle = s.textColor;
      ctx.fillText(lines[i], width / 2, y);
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
