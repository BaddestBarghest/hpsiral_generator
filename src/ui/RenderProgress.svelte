<script lang="ts">
  import { Button, Modal, Progressbar } from 'flowbite-svelte';

  let {
    open,
    frame,
    total,
    startedAt,
    fileName,
    cancelling,
    oncancel,
  }: {
    open: boolean;
    frame: number;
    total: number;
    startedAt: number;
    fileName: string;
    cancelling: boolean;
    oncancel: () => void;
  } = $props();

  const pct = $derived(total ? Math.floor((frame / total) * 100) : 0);

  function eta(): string {
    if (frame < 2) return 'estimating…';
    const elapsed = (performance.now() - startedAt) / 1000;
    const remaining = (elapsed / frame) * (total - frame);
    const m = Math.floor(remaining / 60);
    const s = Math.round(remaining % 60);
    return m > 0 ? `${m} min ${s} s left` : `${s} s left`;
  }
</script>

<Modal title="Rendering video" {open} dismissable={false} permanent size="sm">
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
