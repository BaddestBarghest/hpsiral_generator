import { defaults, migrate, sanitize, withVersion, type Settings } from './schema';
import { readStored, writeStored } from '../storage';

const KEY = 'hypnogen:settings:v1';

function load(): Settings {
  try {
    const raw = readStored(KEY);
    return raw ? sanitize(migrate(JSON.parse(raw))) : defaults();
  } catch {
    return defaults(); // corrupt JSON
  }
}

export const settings: Settings = $state(load());

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced write to localStorage; failures (private mode, quota) are ignored. */
export function persistSettings(snapshot: Settings): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeStored(KEY, JSON.stringify(withVersion(snapshot))), 300);
}

export function resetSettings(): void {
  Object.assign(settings, defaults());
}
