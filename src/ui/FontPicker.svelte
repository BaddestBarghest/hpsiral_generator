<script lang="ts">
  import { ChevronDownOutline } from 'flowbite-svelte-icons';
  import { FONT_CATEGORIES, FONTS, fontFamily, type FontId } from '../settings/fonts';
  import { loadFont } from '../render/fontLoader';

  let { id, value, onchange }: { id: string; value: FontId; onchange: (v: FontId) => void } = $props();

  let open = $state(false);
  const current = $derived(FONTS.find((f) => f.id === value) ?? FONTS[0]);
  const css = (fid: string) => `"${fontFamily(fid)}", system-ui, sans-serif`;

  // Previews need the fonts in the page too (the render worker loads its own copy).
  $effect(() => {
    void loadFont(value);
  });
  $effect(() => {
    if (open) for (const f of FONTS) void loadFont(f.id);
  });

  function pick(fid: FontId) {
    onchange(fid);
    open = false;
  }
</script>

<button
  {id}
  type="button"
  class="flex w-full items-center justify-between rounded-lg border bg-gray-700 px-3 py-2 text-left text-white hover:border-gray-400 {open ? 'border-primary-500' : 'border-gray-600'}"
  aria-expanded={open}
  onclick={() => (open = !open)}
>
  <span class="truncate text-lg leading-tight" style:font-family={css(current.id)}>{current.label}</span>
  <ChevronDownOutline class="h-4 w-4 shrink-0 text-gray-400 transition-transform {open ? 'rotate-180' : ''}" />
</button>

{#if open}
  <div class="space-y-3 rounded-lg border border-gray-700 bg-gray-800 p-3">
    {#each FONT_CATEGORIES as category (category)}
      <div>
        <p class="mb-1.5 text-[11px] font-medium tracking-wide text-gray-400 uppercase">{category}</p>
        <div class="grid grid-cols-2 gap-1.5">
          {#each FONTS.filter((f) => f.category === category) as f (f.id)}
            <button
              type="button"
              class="truncate rounded-md border px-2 py-2 text-center text-base text-white hover:border-gray-400 {f.id === value ? 'border-primary-500 bg-gray-700' : 'border-gray-600'}"
              style:font-family={css(f.id)}
              title={f.label}
              aria-pressed={f.id === value}
              onclick={() => pick(f.id)}
            >
              {f.label}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}
