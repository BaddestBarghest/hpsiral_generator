// Text fonts: bundled open-licence (SIL OFL) Google Fonts, so text looks the same on every
// device and works offline. The files live in render/fontFiles.ts and load on demand.
// The first four ids predate the bundled fonts and are kept so saved settings still work.

export const FONT_CATEGORIES = ['Clean', 'Bold', 'Retro & sci-fi', 'Elegant', 'Handwritten', 'Spooky', 'Code'] as const;
export type FontCategory = (typeof FONT_CATEGORIES)[number];

export const FONTS = [
  { id: 'sans', label: 'Inter', category: 'Clean', bold: true },
  { id: 'montserrat', label: 'Montserrat', category: 'Clean', bold: true },
  { id: 'oswald', label: 'Oswald', category: 'Clean', bold: true },
  { id: 'bebas', label: 'Bebas Neue', category: 'Bold', bold: false },
  { id: 'impact', label: 'Anton', category: 'Bold', bold: false },
  { id: 'bungee', label: 'Bungee', category: 'Bold', bold: false },
  { id: 'righteous', label: 'Righteous', category: 'Retro & sci-fi', bold: false },
  { id: 'monoton', label: 'Monoton', category: 'Retro & sci-fi', bold: false },
  { id: 'audiowide', label: 'Audiowide', category: 'Retro & sci-fi', bold: false },
  { id: 'orbitron', label: 'Orbitron', category: 'Retro & sci-fi', bold: true },
  { id: 'pixel', label: 'Press Start 2P', category: 'Retro & sci-fi', bold: false },
  { id: 'serif', label: 'Playfair Display', category: 'Elegant', bold: true },
  { id: 'cinzel', label: 'Cinzel', category: 'Elegant', bold: true },
  { id: 'pacifico', label: 'Pacifico', category: 'Handwritten', bold: false },
  { id: 'greatvibes', label: 'Great Vibes', category: 'Handwritten', bold: false },
  { id: 'caveat', label: 'Caveat', category: 'Handwritten', bold: true },
  { id: 'creepster', label: 'Creepster', category: 'Spooky', bold: false },
  { id: 'mono', label: 'JetBrains Mono', category: 'Code', bold: true },
] as const satisfies readonly { id: string; label: string; category: FontCategory; bold: boolean }[];

export type FontId = (typeof FONTS)[number]['id'];

/** Ids of fonts that have a real bold weight (the Bold switch only shows for these). */
export const BOLD_FONT_IDS = FONTS.filter((f) => f.bold).map((f) => f.id);

/**
 * CSS family name used when registering a font, unique to this app. Each weight gets its own
 * family so a not-yet-loaded bold can never be confused with the loaded regular weight.
 */
export const fontFamily = (id: string, weight: 400 | 700 = 400) => `HG ${id} ${weight}`;
