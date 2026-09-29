/** Longest step a live frame may take; avoids a huge jump after a background tab resumes. */
export const MAX_LIVE_DT = 0.1;

/** Converts rAF timestamps into clamped deltas, with optional frame-rate cap. */
export class LiveClock {
  private last = -1;
  private pending = 0;

  reset(): void {
    this.last = -1;
    this.pending = 0;
  }

  /**
   * Returns the seconds to advance, or `null` if this frame should be skipped
   * to honour `maxFps` (0 = uncapped).
   */
  tick(nowMs: number, maxFps: number): number | null {
    if (this.last < 0) {
      this.last = nowMs;
      return 0;
    }
    const dt = (nowMs - this.last) / 1000;
    this.last = nowMs;
    if (maxFps <= 0) return Math.min(dt, MAX_LIVE_DT);

    this.pending += dt;
    // Small tolerance so a 60 Hz display isn't halved by rAF jitter when capped at 60.
    const interval = 1 / maxFps;
    if (this.pending < interval * 0.9) return null;
    const out = Math.min(this.pending, MAX_LIVE_DT);
    this.pending = 0;
    return out;
  }
}
