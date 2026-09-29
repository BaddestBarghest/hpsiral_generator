# HypnoGenerator

A hypnotic spiral generator that runs in the browser. It renders with WebGL2 on a single canvas, driven from a Web Worker, and can record what's on screen to video.

> ⚠️ **Photosensitivity warning:** this app shows moving patterns and changing colours that may trigger seizures in people with photosensitive epilepsy.

## Features
- Power-law, Archimedean, logarithmic and concentric patterns. Controls: arms, density, exponent, center spread, center taper (pointy core), arm width, softness, zoom, speed and direction.
- Round or polygon (3–12 sides) shapes for every pattern
- A second spiral drawn over the first, with its own pattern, arms, density, speed, direction and 1–3 colours, plus opacity and blend modes (normal, add, multiply, screen, difference)
- Effects: twist, wobble, afterimage trails (time-based, so the same at any frame rate; renders pre-roll so trails and loops stay seamless), vignette and a centre dot
- Separate colours for arms and gaps (1–3 each). Each can be static per stripe, a gradient along the arm, cycling or kaleidoscopic, with its own shift speed. Global hue roll.
- Adding colours never changes the geometry.
- Edges antialiased in the shader, with an automatic fade only where a whole stripe cycle shrinks below a pixel (no moiré)
- The render loop runs in a Web Worker (`OffscreenCanvas`), so UI work never stalls the animation. Add `?inline` to the URL to render on the main thread instead.
- Live recording to MP4 or WebM with `MediaRecorder`
- Offline render to MP4 (H.264) or WebM (VP9), from 720p up to 4K, square or vertical, at 24/30/60 fps. Every frame is rendered at an exact time step, so output is perfectly smooth even if your device can't play it live. Encoding uses WebCodecs + [mediabunny](https://mediabunny.dev). In Chrome/Edge the file streams straight to disk.
- Animated GIF export (up to 800 px, 20–50 fps, repeats forever). Uses one shared palette, or a palette per frame when colours animate, so there's no colour stepping.
- Seamless loops for any format. **Exact** mode uses the true repeat length: the LCM of every motion's cycle time, computed with exact fractions. **Short** mode nudges secondary speeds slightly for a short loop. The panel shows both lengths with frame counts and estimated sizes.
- Settings are saved in `localStorage`
- Photosensitivity gate. When the system asks for reduced motion, the app starts paused.

### Keyboard shortcuts
| Key | Action |
| --- | --- |
| Space | Play / pause |
| C | Customization panel |
| R | Start / stop recording |
| F | Fullscreen |
| H | Hide controls (click the spiral to show them again) |

## Development
```sh
npm install
npm run dev      # http://localhost:5173/hpsiral_generator/
npm test         # vitest
npm run check    # svelte-check / TypeScript
npm run build    # outputs to dist/
```

## Deploying to GitHub Pages
Live at https://baddestbarghest.github.io/hpsiral_generator/ 

1. The site is served under the repo name, so `base` in `vite.config.ts` must match it (`/hpsiral_generator/`).
2. In **Settings → Pages**, set **Source** to **GitHub Actions**. Pages for private repos requires GitHub Pro or higher.
3. Every push to `main` runs checks and tests, builds the site and deploys it via `.github/workflows/deploy.yml`.

## Architecture
```
settings/schema.ts   one table defines every parameter; the UI, validation and uniforms come from it
engine/timeline.ts   deterministic phase integration (live and offline renders produce the same frames)
render/              WebGL2 Renderer + RenderLoop; runs in render.worker.ts, or inline as a fallback
record/              live MediaRecorder capture; offline WebCodecs + GIF render (lazy-loaded)
engine/loop.ts       seamless-loop planning (exact LCM / short with nudged rates)
ui/                  flowbite-svelte components
```

## Roadmap
Tempo, strobe and flash → audio → text → presets and sequencer → PWA and polish. Background images and videos are on the backlog.
