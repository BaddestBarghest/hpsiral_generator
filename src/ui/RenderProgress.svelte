<script lang="ts">
  import { Button, Modal, Progressbar } from 'flowbite-svelte';

  let {
    open,
    frame,
    total,
    fileName,
    cancelling,
    oncancel,
  }: {
    open: boolean;
    frame: number;
    total: number;
    fileName: string;
    cancelling: boolean;
    oncancel: () => void;
  } = $props();

  const pct = $derived(total ? Math.floor((frame / total) * 100) : 0);
  const title = $derived(fileName.toLowerCase().endsWith('.gif') ? 'Rendering GIF' : 'Rendering video');

  // Time the estimate from the first progress report: before frame 1 the render is loading
  // fonts and warming up afterimages, which would skew the rate.
  let first = $state<{ frame: number; at: number } | null>(null);
  $effect(() => {
    if (!open) first = null;
    else if (!first && frame > 0) first = { frame, at: performance.now() };
  });

  function eta(): string {
    if (!first || frame - first.frame < 2) return 'estimating…';
    const perFrame = (performance.now() - first.at) / 1000 / (frame - first.frame);
    const remaining = Math.round(perFrame * (total - frame));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return m > 0 ? `${m} min ${s} s left` : `${s} s left`;
  }
</script>

<Modal {title} {open} dismissable={false} permanent size="sm">
  <div class="space-y-3">
    <p class="truncate text-sm text-gray-300" title={fileName}>{fileName}</p>
    <Progressbar progress={pct} size="h-2.5" animate={false} />
    <div class="flex justify-between text-xs text-gray-400 tabular-nums">
      <span>Frame {frame} of {total}</span>
      <span>{cancelling ? 'Cancelling…' : eta()}</span>
    </div>
    <p class="text-xs text-gray-500">The live preview is paused while rendering.</p>
  </div>
  {#snippet footer()}
    <Button color="alternative" disabled={cancelling} onclick={oncancel}>Cancel</Button>
  {/snippet}
</Modal>
