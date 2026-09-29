// Text fonts: bundled open-licence (SIL OFL) Google Fonts, so text looks the same on every
// device and works offline. Clean sans-serifs only — no novelty or serif faces. The files
// live in render/fontFiles.ts and load on demand. Earlier ids that no longer exist fall back
// to the default via `sanitize`.

export const FONT_CATEGORIES = ['Clean', 'Geometric', 'Condensed & heavy'] as const;
export type FontCategory = (typeof FONT_CATEGORIES)[number];

export const FONTS = [
  { id: 'sans', label: 'Inter', category: 'Clean', bold: true },
  { id: 'manrope', label: 'Manrope', category: 'Clean', bold: true },
  { id: 'dmsans', label: 'DM Sans', category: 'Clean', bold: true },
  { id: 'worksans', label: 'Work Sans', category: 'Clean', bold: true },
  { id: 'raleway', label: 'Raleway', category: 'Clean', bold: true },
  { id: 'montserrat', label: 'Montserrat', category: 'Geometric', bold: true },
  { id: 'poppins', label: 'Poppins', category: 'Geometric', bold: true },
  { id: 'outfit', label: 'Outfit', category: 'Geometric', bold: true },
  { id: 'spartan', label: 'League Spartan', category: 'Geometric', bold: true },
  { id: 'josefin', label: 'Josefin Sans', category: 'Geometric', bold: true },
  { id: 'oswald', label: 'Oswald', category: 'Condensed & heavy', bold: true },
  { id: 'barlow', label: 'Barlow Condensed', category: 'Condensed & heavy', bold: true },
  { id: 'bebas', label: 'Bebas Neue', category: 'Condensed & heavy', bold: false },
  { id: 'impact', label: 'Anton', category: 'Condensed & heavy', bold: false },
  { id: 'archivo', label: 'Archivo Black', category: 'Condensed & heavy', bold: false },
] as const satisfies readonly { id: string; label: string; category: FontCategory; bold: boolean }[];

export type FontId = (typeof FONTS)[number]['id'];

/** Ids of fonts that have a real bold weight (the Bold switch only shows for these). */
export const BOLD_FONT_IDS = FONTS.filter((f) => f.bold).map((f) => f.id);

/**
 * CSS family name used when registering a font, unique to this app. Each weight gets its own
 * family so a not-yet-loaded bold can never be confused with the loaded regular weight.
 */
export const fontFamily = (id: string, weight: 400 | 700 = 400) => `HG ${id} ${weight}`;
