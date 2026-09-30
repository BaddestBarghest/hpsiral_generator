import { schema, settingsFromJson, withVersion, type Param, type Settings } from './schema';

/**
 * Share links: the settings travel in the URL's hash (`#s=…`), compressed. The hash never
 * reaches a server, so nothing is uploaded anywhere; opening the link loads the settings.
 * Display settings are left out: they suit the viewer's device, not the look.
 */

const PREFIX = 's=';
/** Code formats: deflate-compressed, or plain JSON where the browser can't compress. */
const DEFLATE = '1.';
const PLAIN = '0.';

/** Settings that belong to the viewer's device rather than the look (the Display tab). */
export const DEVICE_KEYS = (schema as readonly Param[]).filter((p) => p.group === 'Display').map((p) => p.key as keyof Settings);

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** A link to `page` (the app's own address) that opens with these settings. */
export async function settingsToLink(s: Settings, page: string): Promise<string> {
  const look: Record<string, unknown> = { ...withVersion(s) };
  for (const key of DEVICE_KEYS) delete look[key];
  const json = new TextEncoder().encode(JSON.stringify(look));
  const code = canCompress() ? DEFLATE + toBase64Url(await pipe(json, new CompressionStream('deflate-raw'))) : PLAIN + toBase64Url(json);
  return `${page.split('#')[0]}#${PREFIX}${code}`;
}

/** Whether a URL hash (`#…`) carries shared settings. */
export const hasSharedSettings = (hash: string) => hash.replace(/^#/, '').startsWith(PREFIX);

/**
 * The settings in a URL hash made by `settingsToLink`, with the device settings from
 * `current`. Throws a readable Error when the link is damaged.
 */
export async function settingsFromLink(hash: string, current: Settings): Promise<Settings> {
  const code = hash.replace(/^#/, '').slice(PREFIX.length);
  let json: string;
  try {
    const bytes = fromBase64Url(code.slice(2));
    if (code.startsWith(DEFLATE)) json = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
    else if (code.startsWith(PLAIN)) json = new TextDecoder().decode(bytes);
    else throw new Error('unknown format');
  } catch {
    throw new Error('That link’s settings are damaged or incomplete; it may have been cut off when it was copied.');
  }
  const shared = settingsFromJson(json);
  const out = { ...shared } as Record<string, unknown>;
  for (const key of DEVICE_KEYS) out[key] = current[key];
  return out as Settings;
}
