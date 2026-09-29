/** Longest step a live frame may take; avoids a huge jump after a background tab resumes. */
export const MAX_LIVE_DT = 0.1;

/**
 * A capped frame may be drawn once this share of its interval has built up. The leftover (or
 * shortfall) carries over to the next frame, so the average rate still matches the cap while
 * uneven frame timing (common in workers) can't make whole frames drop.
 */
const EARLY_TOLERANCE = 0.75;

/** Converts rAF timestamps into clamped deltas, with optional frame-rate cap. */
export class LiveClock {
  private last = -1;
  /** Frame-cap budget in seconds: grows with time, spent one interval per drawn frame. */
  private budget = 0;
  /** Real time since the last drawn frame (what the animation advances by). */
  private sinceDrawn = 0;

  reset(): void {
    this.last = -1;
    this.budget = 0;
    this.sinceDrawn = 0;
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

    const interval = 1 / maxFps;
    this.budget += dt;
    this.sinceDrawn += dt;
    if (this.budget < interval * EARLY_TOLERANCE) return null;
    // Carry the remainder, but never bank more than one frame (no bursts after a stall).
    this.budget = Math.min(this.budget - interval, interval);
    const out = Math.min(this.sinceDrawn, MAX_LIVE_DT);
    this.sinceDrawn = 0;
    return out;
  }
}
