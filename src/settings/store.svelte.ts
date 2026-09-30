import { defaults, DEVICE_KEYS, settingsFromJson, settingsToJson, type Look, type Settings } from './schema';
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

/** Resets the controls; the scenes are kept, but stop playing so the reset look shows. */
export function resetSettings(): void {
  Object.assign(settings, { ...defaults(), sequence: { ...$state.snapshot(settings.sequence), enabled: false } });
}

/**
 * Replaces every setting (e.g. with those from a share link or a file). Settings without
 * scenes keep the current ones, stopped so the new look shows.
 */
export function applySettings(next: Settings): void {
  const sequence = next.sequence.scenes.length ? next.sequence : { ...$state.snapshot(settings.sequence), enabled: false };
  Object.assign(settings, { ...next, sequence });
}

/** Replaces every setting with those in a saved settings file; throws if it isn't one. */
export function loadSettingsFile(text: string): void {
  applySettings(settingsFromJson(text));
}

/** Shows a scene's look in the controls (for editing), stopping the sequence so it's visible. */
export function loadLook(look: Look): void {
  const next: Record<string, unknown> = { ...$state.snapshot(look) };
  for (const key of DEVICE_KEYS) delete next[key];
  Object.assign(settings, next);
  settings.sequence.enabled = false;
}
