// Offline-render job description and presets. Kept free of heavy imports so the UI
// can use it without pulling in the encoders (mediabunny/gifenc are loaded lazily).
import type { Settings } from '../settings/schema';

/** Video codecs go through WebCodecs; GIF is encoded in JavaScript and works everywhere. */
export type VideoCodec = 'avc' | 'vp9';
export type RenderFormat = VideoCodec | 'gif';

export const RENDER_FORMATS: Record<RenderFormat, { label: string; ext: 'mp4' | 'webm' | 'gif'; mimeType: string }> = {
  avc: { label: 'MP4 (H.264)', ext: 'mp4', mimeType: 'video/mp4' },
  vp9: { label: 'WebM (VP9)', ext: 'webm', mimeType: 'video/webm' },
  gif: { label: 'GIF (animated)', ext: 'gif', mimeType: 'image/gif' },
};

export interface ResolutionPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const VIDEO_RESOLUTIONS: ResolutionPreset[] = [
  { id: '720p', label: '720p (1280×720)', width: 1280, height: 720 },
  { id: '1080p', label: '1080p (1920×1080)', width: 1920, height: 1080 },
  { id: '1440p', label: '1440p (2560×1440)', width: 2560, height: 1440 },
  { id: '4k', label: '4K UHD (3840×2160)', width: 3840, height: 2160 },
  { id: 'square', label: 'Square (1080×1080)', width: 1080, height: 1080 },
  { id: 'vertical', label: 'Vertical 9:16 (1080×1920)', width: 1080, height: 1920 },
];

/** GIFs grow quickly with size, so presets stay small. */
export const GIF_RESOLUTIONS: ResolutionPreset[] = [
  { id: 'gif-sq-480', label: 'Square 480×480', width: 480, height: 480 },
  { id: 'gif-sq-640', label: 'Square 640×640', width: 640, height: 640 },
  { id: 'gif-sq-800', label: 'Square 800×800', width: 800, height: 800 },
  { id: 'gif-360p', label: 'Wide 640×360', width: 640, height: 360 },
  { id: 'gif-480p', label: 'Wide 854×480', width: 854, height: 480 },
];

export const VIDEO_FPS = [60, 30, 24];
/** GIF frame delays are whole hundredths of a second: 2, 3, 4, 5 cs. */
export const GIF_FPS = [50, 100 / 3, 25, 20];

export function fpsLabel(fps: number): string {
  return `${Number.isInteger(fps) ? fps : fps.toFixed(1)} fps`;
}

export const QUALITIES = [
  { id: 'standard', label: 'Standard', bitsPerPixel: 0.1 },
  { id: 'high', label: 'High', bitsPerPixel: 0.2 },
  { id: 'max', label: 'Maximum', bitsPerPixel: 0.35 },
] as const;
export type QualityId = (typeof QUALITIES)[number]['id'];

/** High-contrast moving stripes compress poorly, so bitrate scales with pixels per second. */
export function estimateBitrate(width: number, height: number, fps: number, quality: QualityId): number {
  const bpp = QUALITIES.find((q) => q.id === quality)!.bitsPerPixel;
  return Math.round(Math.min(200e6, Math.max(2e6, width * height * fps * bpp)));
}

export interface RenderJob {
  width: number;
  height: number;
  fps: number;
  /** Seconds. */
  duration: number;
  format: RenderFormat;
  /** Bits per second (video only). */
  bitrate: number;
  settings: Settings;
}

/** What the UI asks for; `settings` is set when a seamless loop adjusted the rates. */
export type RenderRequest = Omit<RenderJob, 'settings'> & { settings?: Settings };

export function frameCount(job: Pick<RenderJob, 'fps' | 'duration'>): number {
  return Math.max(1, Math.round(job.fps * job.duration));
}
