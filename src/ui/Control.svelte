<script lang="ts">
  import { Button, Helper, Label, Range, Select, Toggle } from 'flowbite-svelte';
  import { CloseOutline, PlusOutline } from 'flowbite-svelte-icons';
  import type { Param } from '../settings/schema';

  let { param, value, onchange }: { param: Param; value: unknown; onchange: (v: unknown) => void } = $props();

  const id = $derived(`ctl-${param.key}`);

  function fmt(n: number, step: number): string {
    const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
    return n.toFixed(decimals);
  }

  function setColor(i: number, c: string) {
    const next = [...(value as string[])];
    next[i] = c;
    onchange(next);
  }
</script>

<div class="space-y-1.5">
  {#if param.type === 'range'}
    <div class="flex items-baseline justify-between">
      <Label for={id} class="text-sm">{param.label}</Label>
      <span class="text-xs tabular-nums text-gray-400">{fmt(value as number, param.step)}{param.unit ? ` ${param.unit}` : ''}</span>
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
  {:else if param.type === 'color'}
    <div class="flex items-center justify-between">
      <Label for={id} class="text-sm">{param.label}</Label>
      <div class="flex items-center gap-2">
        <span class="font-mono text-xs text-gray-400 uppercase">{value}</span>
        <input
          {id}
          type="color"
          class="h-8 w-8 cursor-pointer rounded border border-gray-600 bg-transparent p-0.5"
          value={value as string}
          oninput={(e) => onchange(e.currentTarget.value)}
        />
      </div>
    </div>
  {:else if param.type === 'palette'}
    {@const colors = value as string[]}
    <Label class="text-sm">{param.label}</Label>
    <div class="flex flex-wrap items-center gap-2">
      {#each colors as c, i (i)}
        <div class="relative">
          <input
            type="color"
            aria-label={`Colour ${i + 1}`}
            class="h-9 w-9 cursor-pointer rounded border border-gray-600 bg-transparent p-0.5"
            value={c}
            oninput={(e) => setColor(i, e.currentTarget.value)}
          />
          {#if colors.length > param.minColors}
            <button
              type="button"
              aria-label={`Remove colour ${i + 1}`}
              class="absolute -top-1.5 -right-1.5 rounded-full bg-gray-800 text-gray-300 hover:text-white"
              onclick={() => onchange(colors.filter((_, j) => j !== i))}
            >
              <CloseOutline class="h-3.5 w-3.5" />
            </button>
          {/if}
        </div>
      {/each}
      {#if colors.length < param.maxColors}
        <Button
          size="xs"
          color="alternative"
          class="h-9 w-9 p-0"
          aria-label="Add colour"
          onclick={() => onchange([...colors, '#f5cb5c'])}
        >
          <PlusOutline class="h-4 w-4" />
        </Button>
      {/if}
    </div>
  {/if}
  {#if param.help}
    <Helper class="text-xs">{param.help}</Helper>
  {/if}
</div>
