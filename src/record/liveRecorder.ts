export interface RecordFormat {
  id: string;
  label: string;
  mimeType: string;
  ext: 'mp4' | 'webm';
}

const CANDIDATES: RecordFormat[] = [
  { id: 'mp4', label: 'MP4 (H.264)', mimeType: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { id: 'webm-vp9', label: 'WebM (VP9)', mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
  { id: 'webm-vp8', label: 'WebM (VP8)', mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
  { id: 'webm', label: 'WebM', mimeType: 'video/webm', ext: 'webm' },
];

export function supportedFormats(): RecordFormat[] {
  if (typeof MediaRecorder === 'undefined') return [];
  return CANDIDATES.filter((f) => MediaRecorder.isTypeSupported(f.mimeType));
}

/** User-facing recording choices (UI state). */
export interface RecordPrefs {
  formatId: string;
  fps: number;
  bitrateMbps: number;
}

export interface LiveRecordOptions {
  fps: number;
  format: RecordFormat;
  /** Video bitrate in bits per second. */
  bitrate: number;
}

/** Real-time capture of the visible canvas via MediaRecorder. Works when the canvas is driven from a worker. */
export class LiveRecorder {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private stream: MediaStream;
  readonly format: RecordFormat;

  constructor(canvas: HTMLCanvasElement, opts: LiveRecordOptions) {
    this.format = opts.format;
    this.stream = canvas.captureStream(opts.fps);
    this.recorder = new MediaRecorder(this.stream, {
      mimeType: opts.format.mimeType,
      videoBitsPerSecond: opts.bitrate,
    });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(1000);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.recorder.onstop = () => {
        this.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this.chunks, { type: this.format.mimeType.split(';')[0] });
        if (blob.size === 0) reject(new Error('The recording is empty. No frames were captured.'));
        else resolve(blob);
      };
      this.recorder.onerror = (e) => reject((e as ErrorEvent).error ?? new Error('Recording failed.'));
      this.recorder.stop();
    });
  }
}
