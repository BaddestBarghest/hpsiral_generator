// Font files for settings/fonts.ts (latin subset). Vite turns each import into a hashed
// asset URL, so a font is only downloaded when it is actually used.
import sans400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import sans700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import montserrat400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url';
import montserrat700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import oswald400 from '@fontsource/oswald/files/oswald-latin-400-normal.woff2?url';
import oswald700 from '@fontsource/oswald/files/oswald-latin-700-normal.woff2?url';
import bebas400 from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
import impact400 from '@fontsource/anton/files/anton-latin-400-normal.woff2?url';
import bungee400 from '@fontsource/bungee/files/bungee-latin-400-normal.woff2?url';
import righteous400 from '@fontsource/righteous/files/righteous-latin-400-normal.woff2?url';
import monoton400 from '@fontsource/monoton/files/monoton-latin-400-normal.woff2?url';
import audiowide400 from '@fontsource/audiowide/files/audiowide-latin-400-normal.woff2?url';
import orbitron400 from '@fontsource/orbitron/files/orbitron-latin-400-normal.woff2?url';
import orbitron700 from '@fontsource/orbitron/files/orbitron-latin-700-normal.woff2?url';
import pixel400 from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?url';
import serif400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import serif700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import cinzel400 from '@fontsource/cinzel/files/cinzel-latin-400-normal.woff2?url';
import cinzel700 from '@fontsource/cinzel/files/cinzel-latin-700-normal.woff2?url';
import pacifico400 from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff2?url';
import greatvibes400 from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url';
import caveat400 from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url';
import caveat700 from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import creepster400 from '@fontsource/creepster/files/creepster-latin-400-normal.woff2?url';
import mono400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';
import mono700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?url';

import type { FontId } from '../settings/fonts';

/** Weight → file URL for every bundled font. */
export const FONT_FILES: Record<FontId, { 400: string; 700?: string }> = {
  sans: { 400: sans400, 700: sans700 },
  montserrat: { 400: montserrat400, 700: montserrat700 },
  oswald: { 400: oswald400, 700: oswald700 },
  bebas: { 400: bebas400 },
  impact: { 400: impact400 },
  bungee: { 400: bungee400 },
  righteous: { 400: righteous400 },
  monoton: { 400: monoton400 },
  audiowide: { 400: audiowide400 },
  orbitron: { 400: orbitron400, 700: orbitron700 },
  pixel: { 400: pixel400 },
  serif: { 400: serif400, 700: serif700 },
  cinzel: { 400: cinzel400, 700: cinzel700 },
  pacifico: { 400: pacifico400 },
  greatvibes: { 400: greatvibes400 },
  caveat: { 400: caveat400, 700: caveat700 },
  creepster: { 400: creepster400 },
  mono: { 400: mono400, 700: mono700 },
};
