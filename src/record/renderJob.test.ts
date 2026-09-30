import { describe, expect, it } from 'vitest';
import { estimateBitrate, RENDER_FORMATS, VIDEO_CODECS } from './renderJob';

describe('render formats', () => {
  it('give newer codecs less bitrate for the same quality', () => {
    const h264 = estimateBitrate(1920, 1080, 60, 'high');
    expect(estimateBitrate(1920, 1080, 60, 'high', 'avc')).toBe(h264);
    expect(estimateBitrate(1920, 1080, 60, 'high', 'hevc')).toBeLessThan(h264);
    expect(estimateBitrate(1920, 1080, 60, 'high', 'av1')).toBeLessThan(estimateBitrate(1920, 1080, 60, 'high', 'hevc'));
  });

  it('put H.264, HEVC and AV1 in MP4 and VP9 in WebM', () => {
    expect(VIDEO_CODECS.map((c) => RENDER_FORMATS[c].ext)).toEqual(['mp4', 'mp4', 'mp4', 'webm']);
  });
});
