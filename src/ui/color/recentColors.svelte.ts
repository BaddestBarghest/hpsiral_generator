// Colours the user picked recently, shared by every colour editor and kept across visits.
const KEY = 'hypnogen:recent-colors:v1';
const MAX = 10;
const HEX = /^#[0-9a-f]{6}$/;

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export const recentColors: string[] = $state(load());

export function rememberColor(hex: string): void {
  const c = hex.toLowerCase();
  if (!HEX.test(c)) return;
  const next = [c, ...recentColors.filter((x) => x !== c)].slice(0, MAX);
  recentColors.splice(0, recentColors.length, ...next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}
