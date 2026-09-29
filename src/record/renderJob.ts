// Offline-render job description and presets. Kept free of heavy imports so the UI
// can use it without pulling in the encoder (mediabunny is loaded lazily).
import type { Settings } from '../settings/schema';

export type RenderCodec = 'avc' | 'vp9';

export const RENDER_FORMATS: Record<RenderCodec, { label: string; ext: 'mp4' | 'webm'; mimeType: string }> = {
  avc: { label: 'MP4 (H.264)', ext: 'mp4', mimeType: 'video/mp4' },
  vp9: { label: 'WebM (VP9)', ext: 'webm', mimeType: 'video/webm' },
};

export interface ResolutionPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const RESOLUTIONS: ResolutionPreset[] = [
  { id: '720p', label: '720p (1280×720)', width: 1280, height: 720 },
  { id: '1080p', label: '1080p (1920×1080)', width: 1920, height: 1080 },
  { id: '1440p', label: '1440p (2560×1440)', width: 2560, height: 1440 },
  { id: '4k', label: '4K UHD (3840×2160)', width: 3840, height: 2160 },
  { id: 'square', label: 'Square (1080×1080)', width: 1080, height: 1080 },
  { id: 'vertical', label: 'Vertical 9:16 (1080×1920)', width: 1080, height: 1920 },
];

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
  codec: RenderCodec;
  /** Bits per second. */
  bitrate: number;
  settings: Settings;
}

/** What the UI asks for; the settings snapshot is attached when the render starts. */
export type RenderRequest = Omit<RenderJob, 'settings'>;

export function frameCount(job: Pick<RenderJob, 'fps' | 'duration'>): number {
  return Math.max(1, Math.round(job.fps * job.duration));
}
