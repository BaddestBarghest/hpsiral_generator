// Font files for settings/fonts.ts (latin subset). Vite turns each import into a hashed
// asset URL, so a font is only downloaded when it is actually used.
import sans400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import sans700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import manrope400 from '@fontsource/manrope/files/manrope-latin-400-normal.woff2?url';
import manrope700 from '@fontsource/manrope/files/manrope-latin-700-normal.woff2?url';
import dmsans400 from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url';
import dmsans700 from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2?url';
import worksans400 from '@fontsource/work-sans/files/work-sans-latin-400-normal.woff2?url';
import worksans700 from '@fontsource/work-sans/files/work-sans-latin-700-normal.woff2?url';
import raleway400 from '@fontsource/raleway/files/raleway-latin-400-normal.woff2?url';
import raleway700 from '@fontsource/raleway/files/raleway-latin-700-normal.woff2?url';
import montserrat400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url';
import montserrat700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import poppins400 from '@fontsource/poppins/files/poppins-latin-400-normal.woff2?url';
import poppins700 from '@fontsource/poppins/files/poppins-latin-700-normal.woff2?url';
import outfit400 from '@fontsource/outfit/files/outfit-latin-400-normal.woff2?url';
import outfit700 from '@fontsource/outfit/files/outfit-latin-700-normal.woff2?url';
import spartan400 from '@fontsource/league-spartan/files/league-spartan-latin-400-normal.woff2?url';
import spartan700 from '@fontsource/league-spartan/files/league-spartan-latin-700-normal.woff2?url';
import josefin400 from '@fontsource/josefin-sans/files/josefin-sans-latin-400-normal.woff2?url';
import josefin700 from '@fontsource/josefin-sans/files/josefin-sans-latin-700-normal.woff2?url';
import oswald400 from '@fontsource/oswald/files/oswald-latin-400-normal.woff2?url';
import oswald700 from '@fontsource/oswald/files/oswald-latin-700-normal.woff2?url';
import barlow400 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-400-normal.woff2?url';
import barlow700 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?url';
import bebas400 from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
import impact400 from '@fontsource/anton/files/anton-latin-400-normal.woff2?url';
import archivo400 from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url';

import type { FontId } from '../settings/fonts';

/** Weight → file URL for every bundled font. */
export const FONT_FILES: Record<FontId, { 400: string; 700?: string }> = {
  sans: { 400: sans400, 700: sans700 },
  manrope: { 400: manrope400, 700: manrope700 },
  dmsans: { 400: dmsans400, 700: dmsans700 },
  worksans: { 400: worksans400, 700: worksans700 },
  raleway: { 400: raleway400, 700: raleway700 },
  montserrat: { 400: montserrat400, 700: montserrat700 },
  poppins: { 400: poppins400, 700: poppins700 },
  outfit: { 400: outfit400, 700: outfit700 },
  spartan: { 400: spartan400, 700: spartan700 },
  josefin: { 400: josefin400, 700: josefin700 },
  oswald: { 400: oswald400, 700: oswald700 },
  barlow: { 400: barlow400, 700: barlow700 },
  bebas: { 400: bebas400 },
  impact: { 400: impact400 },
  archivo: { 400: archivo400 },
};
