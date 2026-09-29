export function timestampedName(prefix: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${prefix}-${stamp}.${ext}`;
}

/** A file chosen in the save dialog, opened for streaming writes. */
export interface FileSink {
  /** Plain stream (transferable to a worker) that relays every chunk to the file. */
  stream: WritableStream;
  /** Deletes the file after a cancelled or failed render (best effort; Chromium only). */
  discard(): Promise<void>;
}

/**
 * Opens a user-picked file for writing. This must happen on the main thread: Chrome
 * refuses `createWritable()` on picker handles inside workers. The file stream itself
 * can't be transferred reliably, so a plain WritableStream forwards to it instead; write
 * chunks may be positioned `{ type: 'write', position, data }` objects.
 */
export async function openFileSink(handle: FileSystemFileHandle): Promise<FileSink> {
  const file = await handle.createWritable();
  let closed = false;
  const stream = new WritableStream({
    write: (chunk) => file.write(chunk),
    close: async () => {
      closed = true;
      await file.close();
    },
    abort: (reason) => file.abort(reason),
  });
  return {
    stream,
    async discard() {
      if (!closed) await file.abort().catch(() => {});
      const removable = handle as FileSystemFileHandle & { remove?: () => Promise<void> };
      await removable.remove?.().catch(() => {});
    },
  };
}

/** Triggers a browser download of `blob`. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
