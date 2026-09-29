<script lang="ts">
  import { Alert, Button, Helper, Label, Range, Select } from 'flowbite-svelte';
  import { StopSolid, VideoCameraSolid } from 'flowbite-svelte-icons';
  import type { RecordFormat, RecordPrefs } from '../record/liveRecorder';

  let {
    prefs = $bindable(),
    formats,
    recording,
    elapsed,
    ontoggle,
  }: {
    prefs: RecordPrefs;
    formats: RecordFormat[];
    recording: boolean;
    elapsed: number;
    ontoggle: () => void;
  } = $props();

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
</script>

<div class="space-y-4">
  {#if formats.length === 0}
    <Alert color="red" class="text-sm">This browser can't record canvas video (MediaRecorder isn't available).</Alert>
  {:else}
    <div class="space-y-1.5">
      <Label for="rec-format" class="text-sm">Format</Label>
      <Select
        placeholder=""
        id="rec-format"
        size="sm"
        disabled={recording}
        items={formats.map((f) => ({ name: f.label, value: f.id }))}
        bind:value={prefs.formatId}
      />
    </div>
    <div class="space-y-1.5">
      <Label for="rec-fps" class="text-sm">Frame rate</Label>
      <Select
        placeholder=""
        id="rec-fps"
        size="sm"
        disabled={recording}
        items={[{ name: '60 fps', value: 60 }, { name: '30 fps', value: 30 }, { name: '24 fps', value: 24 }]}
        bind:value={prefs.fps}
      />
    </div>
    <div class="space-y-1.5">
      <div class="flex items-baseline justify-between">
        <Label for="rec-bitrate" class="text-sm">Bitrate</Label>
        <span class="text-xs tabular-nums text-gray-400">{prefs.bitrateMbps} Mbps</span>
      </div>
      <Range id="rec-bitrate" size="sm" min={2} max={50} step={1} disabled={recording} bind:value={prefs.bitrateMbps} />
    </div>
    <Button class="w-full {recording ? '' : 'text-gray-900!'}" color={recording ? 'red' : 'primary'} onclick={ontoggle}>
      {#if recording}
        <StopSolid class="me-2 h-4 w-4" /> Stop and save ({mmss(elapsed)})
      {:else}
        <VideoCameraSolid class="me-2 h-4 w-4" /> Start recording
      {/if}
    </Button>
    <Helper class="text-xs">
      Records what's on screen in real time, without the controls. The file downloads when you stop.
    </Helper>
  {/if}
</div>
