<script lang="ts">
  import { Button, Helper, Label, Range, Select, Textarea, Toggle } from 'flowbite-svelte';
  import { CloseOutline, InfoCircleOutline, PlusOutline, UndoOutline } from 'flowbite-svelte-icons';
  import { fromSlider, SLIDER_RESOLUTION, toSlider, type Param } from '../settings/schema';
  import { slide } from 'svelte/transition';
  import { dur, MEDIUM } from './motion';
  import FontPicker from './FontPicker.svelte';
  import type { TextFontId } from '../settings/fonts';

  // The colour picker (and its library) loads the first time a colour is edited.
  const colorEditor = () => import('./color/ColorEditor.svelte');

  let {
    param,
    value,
    onchange,
    onbeat,
    hint = null,
    loopTo = null,
    loopOpen = false,
    onloop,
  }: {
    param: Param;
    value: unknown;
    onchange: (v: unknown) => void;
    /** Tap tempo: called on every tap, which marks a beat. */
    onbeat?: () => void;
    hint?: string | null;
    /** The other end of this setting's beat loop, or null when it doesn't loop. */
    loopTo?: number | null;
    /** Whether the beat loop's settings are showing. */
    loopOpen?: boolean;
    /** Shows the "animate with the beat" button; called when it's pressed. */
    onloop?: () => void;
  } = $props();

  const id = $derived(`ctl-${param.key}`);

  /** Whether the help text is showing (it hides behind the ⓘ by default). */
  let helpOpen = $state(false);

  function fmt(n: number, step: number): string {
    const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
    return n.toFixed(decimals);
  }

  // Tap tempo: BPM from the median gap between recent taps (one stray tap doesn't skew it);
  // a 2 s pause starts over.
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
    onbeat?.(); // each tap is a beat: line the beat up with it
    if (taps.length < 2) return;
    const gaps = taps.slice(1).map((t, i) => t - taps[i]).sort((a, b) => a - b);
    const mid = gaps.length >> 1;
    const gap = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
    onchange(Math.min(param.max, Math.max(param.min, Math.round(60000 / gap))));
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
      {@render label()}
      <div class="flex items-center gap-2">
        <span class="text-xs tabular-nums text-gray-400"
          >{fmt(value as number, param.step)}{loopTo !== null ? ` ↔ ${fmt(loopTo, param.step)}` : ''}{param.unit ? ` ${param.unit}` : ''}</span
        >
        {#if onloop}
          <button
            type="button"
            class="rounded-md border p-0.5 transition-colors hover:bg-gray-700 {loopTo !== null ? 'border-primary-500 bg-primary-500/15 text-primary-500' : 'border-gray-500 text-gray-300 hover:text-white'}"
            onclick={onloop}
            title={loopTo === null ? 'Animate with the beat' : loopOpen ? 'Hide animation settings' : 'Show animation settings'}
            aria-label={`Animate ${param.label} with the beat`}
            aria-expanded={loopOpen}
          >
            <!-- A wave: this value rises and falls with the beat. -->
            <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
              <path d="M1 8c1.75-5 3.75-5 5.5 0s3.75 5 5.5 0 2.25-3.5 3-3.5" />
            </svg>
          </button>
        {/if}
        <!-- Always takes its space (hidden at the default) so the row doesn't shift. -->
        <button
          type="button"
          class="rounded p-0.5 text-gray-400 hover:bg-gray-700 hover:text-white {value === param.default ? 'invisible' : ''}"
          onclick={() => onchange(param.default)}
          title={`Reset to ${fmt(param.default, param.step)}${param.unit ? ` ${param.unit}` : ''}`}
          aria-label={`Reset ${param.label}`}
        >
          <UndoOutline class="h-3.5 w-3.5" />
        </button>
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
    {#if param.curve}
      <Range
        {id}
        size="sm"
        min={0}
        max={SLIDER_RESOLUTION}
        step={1}
        value={toSlider(param, value as number)}
        oninput={(e) => onchange(fromSlider(param, Number(e.currentTarget.value)))}
      />
    {:else}
      <Range
        {id}
        size="sm"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value as number}
        oninput={(e) => onchange(Number(e.currentTarget.value))}
      />
    {/if}
  {:else if param.type === 'select' && param.picker === 'font'}
    {@render label()}
    <FontPicker {id} value={value as TextFontId} onchange={(v) => onchange(v)} />
  {:else if param.type === 'select'}
    {@render label()}
    <Select
      placeholder=""
      {id}
      size="sm"
      items={param.options.map((o) => ({ name: o.label, value: o.value }))}
      value={value as string}
      onchange={(e) => onchange(e.currentTarget.value)}
    />
  {:else if param.type === 'toggle'}
    <div class="flex items-center gap-1">
      <Toggle size="small" checked={value as boolean} onchange={(e) => onchange(e.currentTarget.checked)}>
        {param.label}
      </Toggle>
      {@render info()}
    </div>
  {:else if param.type === 'textarea'}
    {@render label()}
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
      {@render label()}
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
      <div transition:slide={{ duration: dur(MEDIUM) }}>
        {#await colorEditor() then { default: ColorEditor }}
          <ColorEditor value={value as string} onchange={(c) => onchange(c)} onclose={() => (editing = null)} />
        {/await}
      </div>
    {/if}
  {:else if param.type === 'palette'}
    {@const colors = value as string[]}
    {@render label(false)}
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
      <div transition:slide={{ duration: dur(MEDIUM) }}>
        {#await colorEditor() then { default: ColorEditor }}
          <ColorEditor value={colors[editing]} onchange={(c) => setColor(editing!, c)} onclose={() => (editing = null)} />
        {/await}
      </div>
    {/if}
  {/if}
  {#if hint}
    <p class="flex gap-1.5 text-xs text-amber-300" role="status"><span aria-hidden="true">⚠</span><span>{hint}</span></p>
  {/if}
  {#if param.help && param.helpAlways}
    <Helper class="text-xs">{param.help}</Helper>
  {:else if param.help && helpOpen}
    <div id={`${id}-help`} transition:slide={{ duration: dur(MEDIUM) }}>
      <Helper class="text-xs">{param.help}</Helper>
    </div>
  {/if}
</div>

<!-- The label, with an ⓘ that shows or hides the help (kept out of sight to save room). -->
{#snippet label(forInput = true)}
  <div class="flex items-center gap-1">
    {#if forInput}
      <Label for={id} class="text-sm">{param.label}</Label>
    {:else}
      <Label class="text-sm">{param.label}</Label>
    {/if}
    {@render info()}
  </div>
{/snippet}

{#snippet info()}
  {#if param.help && !param.helpAlways}
    <button
      type="button"
      class="rounded-full border p-0.5 transition-colors hover:bg-gray-700 {helpOpen ? 'border-primary-500 text-primary-500' : 'border-gray-500 text-gray-300 hover:text-white'}"
      onclick={() => (helpOpen = !helpOpen)}
      title={param.help}
      aria-label={`About ${param.label}`}
      aria-expanded={helpOpen}
      aria-controls={`${id}-help`}
    >
      <InfoCircleOutline class="h-4 w-4" />
    </button>
  {/if}
{/snippet}
