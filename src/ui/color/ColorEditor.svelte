<script lang="ts">
  import { untrack } from 'svelte';
  import 'vanilla-colorful/hex-color-picker.js';
  import { Button, Input } from 'flowbite-svelte';
  import { recentColors, rememberColor } from './recentColors.svelte';

  let {
    value,
    onchange,
    onclose,
  }: { value: string; onchange: (hex: string) => void; onclose: () => void } = $props();

  /** A few useful starting points: neutrals, the app's charcoal and gold, and bold hues. */
  const PRESETS = [
    '#ffffff', '#000000', '#e8eddf', '#333533', '#242423', '#f5cb5c',
    '#e63946', '#ff006e', '#8338ec', '#3a86ff', '#1d3557', '#06d6a0',
  ];

  let picker = $state<HTMLElement>();
  let hexText = $state('');
  // Colour when the editor opened; if it changed by "Done", it goes into the recent list.
  const startValue = untrack(() => value);

  // Keep the text box in sync when the colour changes from the picker or a swatch.
  $effect(() => {
    hexText = value.toUpperCase();
  });

  $effect(() => {
    const el = picker;
    if (!el) return;
    const onColor = (e: Event) => onchange((e as CustomEvent<{ value: string }>).detail.value);
    el.addEventListener('color-changed', onColor);
    return () => el.removeEventListener('color-changed', onColor);
  });

  function parseHex(text: string): string | null {
    let t = text.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(t)) t = t.replace(/(.)/g, '$1$1');
    return /^[0-9a-f]{6}$/i.test(t) ? `#${t.toLowerCase()}` : null;
  }

  function onHexInput(e: Event) {
    hexText = (e.currentTarget as HTMLInputElement).value;
    const hex = parseHex(hexText);
    if (hex) onchange(hex);
  }

  const hasEyeDropper = typeof EyeDropper !== 'undefined';
  async function pickFromScreen() {
    if (!EyeDropper) return;
    try {
      const { sRGBHex } = await new EyeDropper().open();
      const hex = parseHex(sRGBHex);
      if (hex) onchange(hex);
    } catch {
      /* cancelled */
    }
  }

  function done() {
    if (value !== startValue) rememberColor(value);
    onclose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.stopPropagation(); // don't also close the whole panel
      done();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="space-y-3 rounded-lg border border-gray-700 bg-gray-800 p-3" onkeydown={onKeydown}>
  <hex-color-picker bind:this={picker} color={value} class="color-area"></hex-color-picker>

  <div class="flex items-center gap-2">
    <span class="h-8 w-8 shrink-0 rounded-md border border-gray-600" style:background={value}></span>
    <Input
      size="sm"
      class="font-mono uppercase"
      aria-label="Hex colour"
      maxlength={7}
      spellcheck={false}
      value={hexText}
      oninput={onHexInput}
    />
    {#if hasEyeDropper}
      <Button size="xs" color="alternative" class="h-8 shrink-0 px-2" onclick={pickFromScreen} title="Pick a colour from the screen" aria-label="Pick a colour from the screen">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
        </svg>
      </Button>
    {/if}
  </div>

  {#snippet swatches(list: string[], label: string)}
    <div>
      <p class="mb-1.5 text-[11px] font-medium tracking-wide text-gray-400 uppercase">{label}</p>
      <div class="flex flex-wrap gap-1.5">
        {#each list as c (c)}
          <button
            type="button"
            class="h-7 w-7 rounded-md border border-gray-600 transition-transform hover:scale-110 {c === value ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''}"
            style:background={c}
            title={c.toUpperCase()}
            aria-label={`Use ${c.toUpperCase()}`}
            onclick={() => onchange(c)}
          ></button>
        {/each}
      </div>
    </div>
  {/snippet}

  {@render swatches(PRESETS, 'Presets')}
  {#if recentColors.length}
    {@render swatches(recentColors.slice(0, 6), 'Recent')}
  {/if}

  <Button size="xs" class="w-full text-gray-900!" onclick={done}>Done</Button>
</div>

<style>
  .color-area {
    width: 100%;
    height: 160px;
  }
  .color-area::part(saturation) {
    border-radius: 6px 6px 0 0;
    border-bottom: none;
  }
  .color-area::part(hue) {
    height: 14px;
    margin-top: 8px;
    border-radius: 7px;
  }
  .color-area::part(saturation-pointer),
  .color-area::part(hue-pointer) {
    width: 18px;
    height: 18px;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.4), 0 1px 3px rgb(0 0 0 / 0.5);
  }
</style>
