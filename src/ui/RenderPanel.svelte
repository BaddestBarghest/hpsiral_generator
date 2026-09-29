<script lang="ts">
  import { Alert, Button, Helper, Input, Label, Select } from 'flowbite-svelte';
  import { ClapperboardPlaySolid } from 'flowbite-svelte-icons';
  import {
    estimateBitrate,
    QUALITIES,
    RENDER_FORMATS,
    RESOLUTIONS,
    type QualityId,
    type RenderCodec,
    type RenderRequest,
  } from '../record/renderJob';


  let { busy, onrender }: { busy: boolean; onrender: (req: RenderRequest) => void } = $props();

  let resolutionId = $state('1080p');
  let fps = $state(60);
  let duration = $state(10);
  let quality = $state<QualityId>('high');
  let codec = $state<RenderCodec>('avc');

  // null = still probing the encoder
  let supported = $state<RenderCodec[] | null>(null);

  const res = $derived(RESOLUTIONS.find((r) => r.id === resolutionId)!);
  const bitrate = $derived(estimateBitrate(res.width, res.height, fps, quality));
  const validDuration = $derived(Number.isFinite(duration) && duration >= 1 && duration <= 600);
  const sizeMb = $derived(Math.round((bitrate * (validDuration ? duration : 0)) / 8 / 1e6));

  // Probe which codecs WebCodecs can encode at this size/rate (loads the encoder module on demand).
  $effect(() => {
    const { width, height } = res;
    const [f, b] = [fps, bitrate];
    let stale = false;
    supported = null;
    import('../record/offlineRender')
      .then((m) => m.supportedCodecs(width, height, f, b))
      .then((codecs) => {
        if (stale) return;
        supported = codecs;
        if (codecs.length && !codecs.includes(codec)) codec = codecs[0];
      })
      .catch(() => !stale && (supported = []));
    return () => (stale = true);
  });

  function start() {
    onrender({ width: res.width, height: res.height, fps, duration, codec, bitrate });
  }
</script>

<div class="space-y-4">
  <div class="space-y-1.5">
    <Label for="rnd-res" class="text-sm">Resolution</Label>
    <Select placeholder="" id="rnd-res" size="sm" disabled={busy} items={RESOLUTIONS.map((r) => ({ name: r.label, value: r.id }))} bind:value={resolutionId} />
  </div>
  <div class="grid grid-cols-2 gap-3">
    <div class="space-y-1.5">
      <Label for="rnd-fps" class="text-sm">Frame rate</Label>
      <Select
        placeholder=""
        id="rnd-fps"
        size="sm"
        disabled={busy}
        items={[{ name: '60 fps', value: 60 }, { name: '30 fps', value: 30 }, { name: '24 fps', value: 24 }]}
        bind:value={fps}
      />
    </div>
    <div class="space-y-1.5">
      <Label for="rnd-dur" class="text-sm">Duration (s)</Label>
      <Input id="rnd-dur" size="sm" type="number" min={1} max={600} step={1} disabled={busy} bind:value={duration} />
    </div>
  </div>
  <div class="grid grid-cols-2 gap-3">
    <div class="space-y-1.5">
      <Label for="rnd-quality" class="text-sm">Quality</Label>
      <Select placeholder="" id="rnd-quality" size="sm" disabled={busy} items={QUALITIES.map((q) => ({ name: q.label, value: q.id }))} bind:value={quality} />
    </div>
    <div class="space-y-1.5">
      <Label for="rnd-format" class="text-sm">Format</Label>
      <Select
        placeholder=""
        id="rnd-format"
        size="sm"
        disabled={busy || !supported?.length}
        items={(supported ?? ['avc', 'vp9']).map((c) => ({ name: RENDER_FORMATS[c].label, value: c }))}
        bind:value={codec}
      />
    </div>
  </div>

  {#if supported && supported.length === 0}
    <Alert color="red" class="text-sm">
      This browser can't encode video at {res.width}×{res.height} {fps} fps. Try a lower resolution or frame rate, or use Chrome or Edge.
    </Alert>
  {/if}

  <Button class="w-full text-gray-900!" disabled={busy || !supported?.length || !validDuration} onclick={start}>
    <ClapperboardPlaySolid class="me-2 h-4 w-4" /> Render video
  </Button>
  <Helper class="text-xs">
    Renders every frame at an exact time step, so the video is perfectly smooth at any resolution, even if your
    device can't play it live. It starts from the beginning of the animation with the current settings.
    About {(bitrate / 1e6).toFixed(0)} Mbps, roughly {sizeMb} MB.
  </Helper>
</div>
