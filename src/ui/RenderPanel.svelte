<script lang="ts">
  import { Alert, Button, Helper, Input, Label, Select, Toggle } from 'flowbite-svelte';
  import { ClapperboardPlaySolid } from 'flowbite-svelte-icons';
  import type { Settings } from '../settings/schema';
  import { exactLoop, planLoop, type LoopMode } from '../engine/loop';
  import {
    estimateBitrate,
    fpsLabel,
    GIF_FPS,
    GIF_RESOLUTIONS,
    QUALITIES,
    RENDER_FORMATS,
    VIDEO_FPS,
    VIDEO_RESOLUTIONS,
    type QualityId,
    type RenderFormat,
    type RenderRequest,
    type VideoCodec,
  } from '../record/renderJob';

  let {
    busy,
    settings,
    onrender,
  }: { busy: boolean; settings: Settings; onrender: (req: RenderRequest) => void } = $props();

  let format = $state<RenderFormat>('avc');
  let videoResId = $state('1080p');
  let gifResId = $state('gif-sq-480');
  let videoFps = $state(60);
  let gifFps = $state(25);
  let duration = $state(10);
  let quality = $state<QualityId>('high');
  let loop = $state(false);
  let loopMode = $state<'auto' | LoopMode>('auto');

  /** Exact loops longer than this are too long to be the automatic choice. */
  const AUTO_EXACT_MAX_SECONDS = 20;
  /** Hard caps on render length; GIFs balloon far sooner than video. */
  const MAX_SECONDS = 600;
  const MAX_GIF_SECONDS = 60;

  // Video codecs this browser can encode at the chosen size/rate; null while probing.
  let videoCodecs = $state<VideoCodec[] | null>(null);

  const isGif = $derived(format === 'gif');
  const resolutions = $derived(isGif ? GIF_RESOLUTIONS : VIDEO_RESOLUTIONS);
  const res = $derived(resolutions.find((r) => r.id === (isGif ? gifResId : videoResId))!);
  const fps = $derived(isGif ? gifFps : videoFps);
  const videoRes = $derived(VIDEO_RESOLUTIONS.find((r) => r.id === videoResId)!);
  const bitrate = $derived(estimateBitrate(videoRes.width, videoRes.height, videoFps, quality, isGif ? 'avc' : (format as VideoCodec)));
  // Codecs are probed at the H.264 rate (the highest), so switching format doesn't re-probe.
  const probeBitrate = $derived(estimateBitrate(videoRes.width, videoRes.height, videoFps, quality));
  const validDuration = $derived(Number.isFinite(duration) && duration >= 0.1 && duration <= MAX_SECONDS);

  const snap = $derived(loop ? $state.snapshot(settings) : null);
  // True repeat length with the speeds as set, and the shortest loop with nudged speeds.
  const exact = $derived(snap ? exactLoop(snap, fps) : null);
  const shortLoop = $derived(snap ? planLoop(snap, 0, fps, 'short') : null);
  const mode = $derived<LoopMode>(
    loopMode !== 'auto' ? loopMode : exact && exact.seconds <= AUTO_EXACT_MAX_SECONDS ? 'exact' : 'short',
  );
  const plan = $derived(snap && validDuration ? planLoop(snap, duration, fps, mode) : null);

  const finalDuration = $derived(plan ? plan.duration : duration);
  const frames = $derived(Math.max(1, Math.round(finalDuration * fps)));
  const maxSeconds = $derived(isGif ? MAX_GIF_SECONDS : MAX_SECONDS);
  const tooLong = $derived(finalDuration > maxSeconds + 1e-6);
  // While the browser is still being probed, list the usual video formats rather than a blank
  // box; rendering stays disabled until the probe confirms the chosen one.
  const formats = $derived<RenderFormat[]>([...(videoCodecs ?? (['avc', 'vp9'] as const)), 'gif']);
  const canRender = $derived(
    !busy && validDuration && !tooLong && (isGif || !!videoCodecs?.includes(format as VideoCodec)),
  );

  /** Rough output size: GIFs of these patterns run ~0.08 bytes per pixel per frame. */
  function estimateSize(seconds: number): string {
    const bytes = isGif ? res.width * res.height * Math.round(seconds * fps) * 0.08 : (bitrate * seconds) / 8;
    return bytes >= 1e9 ? `~${(bytes / 1e9).toFixed(1)} GB` : `~${Math.max(1, Math.round(bytes / 1e6))} MB`;
  }

  const fmtSeconds = (s: number) => (s >= 120 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(2)} s`);

  $effect(() => {
    const { width, height } = videoRes;
    const [f, b] = [videoFps, probeBitrate];
    let stale = false;
    videoCodecs = null;
    import('../record/offlineRender')
      .then((m) => m.supportedCodecs(width, height, f, b))
      .then((codecs) => {
        if (stale) return;
        videoCodecs = codecs;
        if (format !== 'gif' && !codecs.includes(format)) format = codecs[0] ?? 'gif';
      })
      .catch(() => !stale && (videoCodecs = []));
    return () => (stale = true);
  });

  function onFormatChange() {
    // GIFs are almost always wanted as endless loops; video defaults to a plain clip.
    loop = format === 'gif';
    if (format === 'gif' && duration > 10) duration = 4;
  }

  function start() {
    onrender({
      width: res.width,
      height: res.height,
      fps,
      duration: finalDuration,
      format,
      bitrate,
      settings: plan?.settings,
    });
  }
</script>

<div class="space-y-4">
  <div class="space-y-1.5">
    <Label for="rnd-format" class="text-sm">Format</Label>
    <Select
      placeholder=""
      id="rnd-format"
      size="sm"
      disabled={busy}
      items={formats.map((f) => ({ name: RENDER_FORMATS[f].label, value: f }))}
      bind:value={format}
      onchange={onFormatChange}
    />
    <Helper class="text-xs">{RENDER_FORMATS[format].note}</Helper>
  </div>
  <div class="space-y-1.5">
    <Label for="rnd-res" class="text-sm">Resolution</Label>
    {#if isGif}
      <Select placeholder="" id="rnd-res" size="sm" disabled={busy} items={GIF_RESOLUTIONS.map((r) => ({ name: r.label, value: r.id }))} bind:value={gifResId} />
    {:else}
      <Select placeholder="" id="rnd-res" size="sm" disabled={busy} items={VIDEO_RESOLUTIONS.map((r) => ({ name: r.label, value: r.id }))} bind:value={videoResId} />
    {/if}
  </div>
  <div class="grid grid-cols-2 gap-3">
    <div class="space-y-1.5">
      <Label for="rnd-fps" class="text-sm">Frame rate</Label>
      {#if isGif}
        <Select placeholder="" id="rnd-fps" size="sm" disabled={busy} items={GIF_FPS.map((f) => ({ name: fpsLabel(f), value: f }))} bind:value={gifFps} />
      {:else}
        <Select placeholder="" id="rnd-fps" size="sm" disabled={busy} items={VIDEO_FPS.map((f) => ({ name: fpsLabel(f), value: f }))} bind:value={videoFps} />
      {/if}
    </div>
    <div class="space-y-1.5">
      <Label for="rnd-dur" class="text-sm">Duration (s)</Label>
      <Input id="rnd-dur" size="sm" type="number" min={0.1} max={600} step={0.1} disabled={busy} bind:value={duration} />
    </div>
  </div>
  {#if !isGif}
    <div class="space-y-1.5">
      <Label for="rnd-quality" class="text-sm">Quality</Label>
      <Select placeholder="" id="rnd-quality" size="sm" disabled={busy} items={QUALITIES.map((q) => ({ name: q.label, value: q.id }))} bind:value={quality} />
    </div>
  {/if}

  <div class="space-y-1.5">
    <Toggle size="small" disabled={busy} bind:checked={loop}>Seamless loop</Toggle>
    {#if plan}
      <div class="space-y-2 rounded-md bg-gray-800 p-2.5 text-xs text-gray-300">
        {#if exact && shortLoop}
          <table class="w-full tabular-nums">
            <tbody>
              <tr class={mode === 'exact' ? 'text-white' : 'text-gray-400'}>
                <td class="pe-2">Exact loop <span class="text-gray-500">(your speeds)</span></td>
                <td class="text-right">{fmtSeconds(exact.seconds)}</td>
                <td class="ps-2 text-right">{exact.frames.toLocaleString()} fr</td>
                <td class="ps-2 text-right">{estimateSize(exact.seconds)}</td>
              </tr>
              <tr class={mode === 'short' ? 'text-white' : 'text-gray-400'}>
                <td class="pe-2">Short loop <span class="text-gray-500">(speeds tweaked)</span></td>
                <td class="text-right">{fmtSeconds(shortLoop.shortest)}</td>
                <td class="ps-2 text-right">{shortLoop.frames.toLocaleString()} fr</td>
                <td class="ps-2 text-right">{estimateSize(shortLoop.shortest)}</td>
              </tr>
            </tbody>
          </table>
          <div class="flex items-center gap-2">
            <Label for="rnd-loopmode" class="shrink-0 text-xs">Loop mode</Label>
            <Select
              placeholder=""
              id="rnd-loopmode"
              size="sm"
              disabled={busy}
              items={[
                { name: `Automatic (${mode === 'exact' ? 'exact' : 'short'})`, value: 'auto' },
                { name: 'Exact: keep my speeds', value: 'exact' },
                { name: 'Short: tweak speeds to fit', value: 'short' },
              ]}
              bind:value={loopMode}
            />
          </div>
        {/if}
        <p>
          This render: <span class="font-medium text-white tabular-nums">{fmtSeconds(plan.duration)}</span>
          ({plan.frames.toLocaleString()} frames, {estimateSize(plan.duration)}).
          {#if Math.abs(plan.duration - duration) > 0.005}
            Adjusted from {duration} s to a whole number of loops.
          {/if}
        </p>
        {#if plan.changes.length}
          <div>
            <p class="text-gray-400">Tweaked for this render only, so everything lines up:</p>
            <ul class="list-inside list-disc text-gray-400 tabular-nums">
              {#each plan.changes as c (c.key)}
                <li>{c.label}: {c.from.toFixed(3)} → {c.to.toFixed(3)}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}
    {#if tooLong}
      <Alert color="red" class="text-sm">
        {fmtSeconds(finalDuration)} is over the {fmtSeconds(maxSeconds)} limit for {isGif ? 'GIFs' : 'videos'}.
        {#if plan && mode === 'exact'}
          Choose the short loop, or use speeds that share common factors (e.g. 0.5 and 0.25).
        {:else}
          Try a shorter duration.
        {/if}
      </Alert>
    {/if}
  </div>

  {#if !isGif && videoCodecs && videoCodecs.length === 0}
    <Alert color="red" class="text-sm">
      This browser can't encode video at {videoRes.width}×{videoRes.height} {videoFps} fps. Try a lower resolution or
      frame rate, use Chrome or Edge, or render a GIF instead.
    </Alert>
  {/if}
  {#if isGif && frames > 300 && !tooLong}
    <Alert color="yellow" class="text-sm">
      {frames} frames will make a large GIF. A shorter loop, a lower frame rate or a smaller size keeps it light.
    </Alert>
  {/if}

  <Button class="w-full text-gray-900!" disabled={!canRender} onclick={start}>
    <ClapperboardPlaySolid class="me-2 h-4 w-4" /> Render {isGif ? 'GIF' : 'video'}
  </Button>
  <Helper class="text-xs">
    Renders every frame at an exact time step, so the result is perfectly smooth at any size, even if your device
    can't play it live. It starts from the beginning of the animation with the current settings.
    {#if isGif}
      GIFs use a shared 256-colour palette and repeat forever.
    {:else}
      About {(bitrate / 1e6).toFixed(0)} Mbps, roughly {Math.round((bitrate * finalDuration) / 8 / 1e6)} MB.
    {/if}
  </Helper>
</div>
