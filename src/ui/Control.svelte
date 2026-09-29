<script lang="ts">
  import { Button, Helper, Label, Range, Select, Textarea, Toggle } from 'flowbite-svelte';
  import { CloseOutline, PlusOutline } from 'flowbite-svelte-icons';
  import type { Param } from '../settings/schema';
  import ColorEditor from './color/ColorEditor.svelte';
  import FontPicker from './FontPicker.svelte';
  import type { FontId } from '../settings/fonts';

  let {
    param,
    value,
    onchange,
    hint = null,
  }: { param: Param; value: unknown; onchange: (v: unknown) => void; hint?: string | null } = $props();

  const id = $derived(`ctl-${param.key}`);

  function fmt(n: number, step: number): string {
    const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
    return n.toFixed(decimals);
  }

  // Tap tempo: BPM from the average gap between recent taps; a 2 s pause starts over.
  const TAP_RESET_MS = 2000;
  const TAP_WINDOW = 6;
  let taps: number[] = [];
  let tapCount = $state(0);

  function tap() {
    if (param.type !== 'range') return;
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > TAP_RESET_MS) taps = [];
    taps = [...taps, now].slice(-TAP_WINDOW);
    tapCount = taps.length;
    if (taps.length < 2) return;
    const avgGap = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    onchange(Math.min(param.max, Math.max(param.min, Math.round(60000 / avgGap))));
  }

  // Index of the colour whose editor is open (0 for single-colour params), or null.
  let editing = $state<number | null>(null);

  function toggleEditor(i: number) {
    editing = editing === i ? null : i;
  }

  function setColor(i: number, c: string) {
    const next = [...(value as string[])];
    next[i] = c;
    onchange(next);
  }

  function addColor() {
    const colors = value as string[];
    onchange([...colors, '#f5cb5c']);
    editing = colors.length; // open the editor for the new colour
  }

  function removeColor(i: number) {
    onchange((value as string[]).filter((_, j) => j !== i));
    if (editing === i) editing = null;
    else if (editing !== null && editing > i) editing--;
  }
</script>

<div class="space-y-1.5">
  {#if param.type === 'range'}
    <div class="flex items-baseline justify-between">
      <Label for={id} class="text-sm">{param.label}</Label>
      <div class="flex items-center gap-2">
        <span class="text-xs tabular-nums text-gray-400">{fmt(value as number, param.step)}{param.unit ? ` ${param.unit}` : ''}</span>
        {#if param.tapTempo}
          <Button
            size="xs"
            color="alternative"
            class="px-2.5 py-1"
            onclick={tap}
            title="Tap along to the beat (at least twice)"
            aria-label={`Tap tempo${tapCount === 1 ? ' (keep tapping)' : ''}`}
          >
            Tap{tapCount === 1 ? '…' : ''}
          </Button>
        {/if}
      </div>
    </div>
    <Range
      {id}
      size="sm"
      min={param.min}
      max={param.max}
      step={param.step}
      value={value as number}
      oninput={(e) => onchange(Number(e.currentTarget.value))}
    />
  {:else if param.type === 'select' && param.picker === 'font'}
    <Label for={id} class="text-sm">{param.label}</Label>
    <FontPicker {id} value={value as FontId} onchange={(v) => onchange(v)} />
  {:else if param.type === 'select'}
    <Label for={id} class="text-sm">{param.label}</Label>
    <Select
      placeholder=""
      {id}
      size="sm"
      items={param.options.map((o) => ({ name: o.label, value: o.value }))}
      value={value as string}
      onchange={(e) => onchange(e.currentTarget.value)}
    />
  {:else if param.type === 'toggle'}
    <Toggle size="small" checked={value as boolean} onchange={(e) => onchange(e.currentTarget.checked)}>
      {param.label}
    </Toggle>
  {:else if param.type === 'textarea'}
    <Label for={id} class="text-sm">{param.label}</Label>
    <Textarea
      {id}
      rows={param.rows}
      maxlength={param.maxLength}
      spellcheck={false}
      class="w-full resize-y text-sm"
      value={value as string}
      oninput={(e) => onchange(e.currentTarget.value)}
    />
  {:else if param.type === 'color'}
    <div class="flex items-center justify-between">
      <Label for={id} class="text-sm">{param.label}</Label>
      <button
        {id}
        type="button"
        class="flex items-center gap-2 rounded-md border px-1.5 py-1 hover:border-gray-400 {editing === 0 ? 'border-primary-500' : 'border-gray-600'}"
        aria-expanded={editing === 0}
        aria-label={`${param.label}: ${String(value).toUpperCase()}. Change colour`}
        onclick={() => toggleEditor(0)}
      >
        <span class="font-mono text-xs text-gray-300 uppercase">{value}</span>
        <span class="h-6 w-6 rounded border border-black/30" style:background={value as string}></span>
      </button>
    </div>
    {#if editing === 0}
      <ColorEditor value={value as string} onchange={(c) => onchange(c)} onclose={() => (editing = null)} />
    {/if}
  {:else if param.type === 'palette'}
    {@const colors = value as string[]}
    <Label class="text-sm">{param.label}</Label>
    <div class="flex flex-wrap items-center gap-2">
      {#each colors as c, i (i)}
        <div class="relative">
          <button
            type="button"
            class="block h-9 w-9 rounded-md border-2 transition-transform hover:scale-105 {editing === i ? 'border-primary-500' : 'border-gray-600'}"
            style:background={c}
            aria-expanded={editing === i}
            aria-label={`Colour ${i + 1}: ${c.toUpperCase()}. Change colour`}
            onclick={() => toggleEditor(i)}
          ></button>
          {#if colors.length > param.minColors}
            <button
              type="button"
              aria-label={`Remove colour ${i + 1}`}
              class="absolute -top-1.5 -right-1.5 rounded-full bg-gray-800 text-gray-300 hover:text-white"
              onclick={() => removeColor(i)}
            >
              <CloseOutline class="h-3.5 w-3.5" />
            </button>
          {/if}
        </div>
      {/each}
      {#if colors.length < param.maxColors}
        <Button size="xs" color="alternative" class="h-9 w-9 p-0" aria-label="Add colour" onclick={addColor}>
          <PlusOutline class="h-4 w-4" />
        </Button>
      {/if}
    </div>
    {#if editing !== null && editing < colors.length}
      <ColorEditor value={colors[editing]} onchange={(c) => setColor(editing!, c)} onclose={() => (editing = null)} />
    {/if}
  {/if}
  {#if hint}
    <p class="flex gap-1.5 text-xs text-amber-300" role="status"><span aria-hidden="true">⚠</span><span>{hint}</span></p>
  {:else if param.help}
    <Helper class="text-xs">{param.help}</Helper>
  {/if}
</div>
