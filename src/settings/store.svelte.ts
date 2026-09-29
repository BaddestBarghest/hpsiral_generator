import { defaults, migrate, sanitize, type Settings } from './schema';

const KEY = 'hypnogen:settings:v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(migrate(JSON.parse(raw))) : defaults();
  } catch {
    return defaults();
  }
}

export const settings: Settings = $state(load());

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced write to localStorage; failures (private mode, quota) are ignored. */
export function persistSettings(snapshot: Settings): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {
      /* storage unavailable */
    }
  }, 300);
}

export function resetSettings(): void {
  Object.assign(settings, defaults());
}
