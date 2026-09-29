// Minimal typings for gifenc (https://github.com/mattdesl/gifenc), which ships none.
declare module 'gifenc' {
  export type Palette = number[][];
  export type PixelFormat = 'rgb565' | 'rgb444' | 'rgba4444';

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: PixelFormat; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): Palette;

  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: PixelFormat): Uint8Array;

  export interface GifFrameOptions {
    palette?: Palette;
    /** Milliseconds (stored as hundredths of a second). */
    delay?: number;
    /** 0 = loop forever, -1 = play once. */
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: GifFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder;
}
