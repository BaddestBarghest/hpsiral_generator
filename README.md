# HypnoGenerator

A hypnotic spiral generator that runs in the browser. It renders with WebGL2 on a single canvas, driven from a Web Worker, and can record what's on screen to video.

> ⚠️ **Photosensitivity warning:** this app shows moving patterns and changing colours that may trigger seizures in people with photosensitive epilepsy.

## Features
- Power-law, Archimedean, logarithmic and concentric patterns. Controls: arms, density, exponent, center spread, center taper (pointy core), arm width, softness, zoom, speed and direction.
- Separate colours for arms and gaps (1–3 each). Each can be static per stripe, a gradient along the arm, cycling or kaleidoscopic, with its own shift speed. Global hue roll.
- Adding colours never changes the geometry.
- Edges antialiased in the shader, with an automatic fade only where a whole stripe cycle shrinks below a pixel (no moiré)
- The render loop runs in a Web Worker (`OffscreenCanvas`), so UI work never stalls the animation. Add `?inline` to the URL to render on the main thread instead.
- Live recording to MP4 or WebM with `MediaRecorder`
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
record/              live MediaRecorder capture
ui/                  flowbite-svelte components
```

## Roadmap
Offline render (WebCodecs + mediabunny) → more patterns and post effects → tempo, strobe and flash → audio → text → presets and sequencer → PWA and polish. Background images and videos are on the backlog.
