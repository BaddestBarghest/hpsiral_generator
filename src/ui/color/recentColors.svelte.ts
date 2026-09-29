// Colours the user picked recently, shared by every colour editor and kept across visits.
import { HEX_COLOR } from '../../settings/schema';
import { readStored, writeStored } from '../../storage';

const KEY = 'hypnogen:recent-colors:v1';
const MAX = 10;

function load(): string[] {
  try {
    const raw = JSON.parse(readStored(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((c): c is string => typeof c === 'string' && HEX_COLOR.test(c)).map((c) => c.toLowerCase()).slice(0, MAX)
      : [];
  } catch {
    return []; // corrupt JSON
  }
}

export const recentColors: string[] = $state(load());

export function rememberColor(hex: string): void {
  const c = hex.toLowerCase();
  if (!HEX_COLOR.test(c)) return;
  const next = [c, ...recentColors.filter((x) => x !== c)].slice(0, MAX);
  recentColors.splice(0, recentColors.length, ...next);
  writeStored(KEY, JSON.stringify(next));
}
