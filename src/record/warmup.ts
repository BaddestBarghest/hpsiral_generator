import type { Settings } from '../settings/schema';
import { initialTimeline, step, type TimelineState } from '../engine/timeline';
import { trailWarmupFrames, type Renderer } from '../render/Renderer';

/**
 * Renders (without recording) enough frames for afterimage trails to build up, so the
 * first recorded frame already looks like live playback. Returns the timeline to start
 * recording from. Loops stay seamless: a loop is periodic, so any start point works.
 */
export function warmUp(renderer: Renderer, settings: Settings, fps: number): TimelineState {
  const dt = 1 / fps;
  let tl = initialTimeline();
  for (let i = trailWarmupFrames(settings.trails, fps); i > 0; i--) {
    renderer.draw(settings, tl, dt);
    tl = step(tl, settings, dt);
  }
  return tl;
}
