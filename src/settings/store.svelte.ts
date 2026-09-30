import { defaults, settingsFromJson, settingsToJson, type Settings } from './schema';
import { readStored, writeStored } from '../storage';

const KEY = 'hypnogen:settings:v1';

function load(): Settings {
  const raw = readStored(KEY);
  try {
    return raw ? settingsFromJson(raw) : defaults();
  } catch {
    return defaults(); // corrupt save
  }
}

export const settings: Settings = $state(load());

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced write to localStorage; failures (private mode, quota) are ignored. */
export function persistSettings(snapshot: Settings): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeStored(KEY, settingsToJson(snapshot)), 300);
}

export function resetSettings(): void {
  Object.assign(settings, defaults());
}

/** Replaces every setting (e.g. with those from a share link). */
export function applySettings(next: Settings): void {
  Object.assign(settings, next);
}

/** Replaces every setting with those in a saved settings file; throws if it isn't one. */
export function loadSettingsFile(text: string): void {
  Object.assign(settings, settingsFromJson(text));
}
