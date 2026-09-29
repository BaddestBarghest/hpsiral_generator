export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function averageRgb(colors: RGB[]): RGB {
  const sum: RGB = [0, 0, 0];
  for (const c of colors) for (let i = 0; i < 3; i++) sum[i] += c[i];
  return sum.map((x) => x / Math.max(1, colors.length)) as RGB;
}
