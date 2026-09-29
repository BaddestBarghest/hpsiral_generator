import type { Settings } from '../settings/schema';
import { initialTimeline, step, type TimelineState } from '../engine/timeline';
import { trailWarmupFrames, type Renderer } from '../render/Renderer';

/**
 * Afterimages are built by feedback, one blend per drawn frame. At low frame rates (GIFs,
 * 25–30 fps video) the pattern jumps so far between frames that the trail becomes a few
 * separate faded copies (dark bands) instead of a smooth smear. Offline renders therefore
 * draw unsaved in-between frames so the feedback runs at least this often, as live playback does.
 */
const TRAIL_RATE = 60;

/** Feedback steps per output frame: 1 without afterimages, else enough to reach TRAIL_RATE. */
export function subSteps(settings: Settings, fps: number): number {
  const trails = settings.trails > 0 || (settings.textEnabled && settings.textTrails > 0);
  return trails ? Math.max(1, Math.ceil(TRAIL_RATE / fps - 1e-9)) : 1;
}

/**
 * Advances the timeline by one output frame (`1 / fps`), drawing the unsaved in-between
 * frames so the afterimages see every sub-step. The next saved frame is then drawn with
 * `dt = 1 / (fps * subSteps)`.
 */
export function advance(renderer: Renderer, settings: Settings, tl: TimelineState, fps: number): TimelineState {
  const n = subSteps(settings, fps);
  const dt = 1 / (fps * n);
  for (let k = 1; k < n; k++) {
    tl = step(tl, settings, dt);
    renderer.draw(settings, tl, dt, false);
  }
  return step(tl, settings, dt);
}

/**
 * Renders (without recording) enough frames for afterimage trails to build up, so the
 * first recorded frame already looks like live playback. Returns the timeline to start
 * recording from. Loops stay seamless: a loop is periodic, so any start point works.
 */
export function warmUp(renderer: Renderer, settings: Settings, fps: number): TimelineState {
  const rate = fps * subSteps(settings, fps);
  const dt = 1 / rate;
  let tl = initialTimeline();
  for (let i = trailWarmupFrames(settings, rate); i > 0; i--) {
    renderer.draw(settings, tl, dt, false);
    tl = step(tl, settings, dt);
  }
  return tl;
}
