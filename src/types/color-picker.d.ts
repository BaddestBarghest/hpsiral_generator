// Typings for the vanilla-colorful custom element as used in Svelte templates, and the
// EyeDropper API (Chromium only), which TypeScript's DOM lib doesn't declare yet.
import type { HTMLAttributes } from 'svelte/elements';

declare module 'svelte/elements' {
  interface SvelteHTMLElements {
    'hex-color-picker': HTMLAttributes<HTMLElement> & { color?: string };
  }
}

declare global {
  interface EyeDropperResult {
    sRGBHex: string;
  }
  interface EyeDropper {
    open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
  }
  // eslint-disable-next-line no-var
  var EyeDropper: { new (): EyeDropper } | undefined;
}
