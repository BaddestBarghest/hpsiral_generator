/**
 * localStorage access that never throws. Storage can be unavailable (private windows,
 * blocked site data, quota), and everything saved this way is a convenience the app can
 * run without.
 */

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
