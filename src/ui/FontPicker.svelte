<script lang="ts">
  import { ChevronDownOutline, CloseOutline, UploadOutline } from 'flowbite-svelte-icons';
  import { CUSTOM_FONT_ID, FONT_CATEGORIES, FONTS, type TextFontId } from '../settings/fonts';
  import { familyName, loadFont } from '../render/fontLoader';
  import { customFont, removeCustomFont, uploadCustomFont } from './customFont.svelte';

  let { id, value, onchange }: { id: string; value: TextFontId; onchange: (v: TextFontId) => void } = $props();

  let open = $state(false);
  let uploading = $state(false);
  let uploadError = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement>();

  const isCustom = $derived(value === CUSTOM_FONT_ID);
  const current = $derived(FONTS.find((f) => f.id === value) ?? FONTS[0]);
  const currentLabel = $derived(isCustom ? (customFont.name ?? 'Your font (none uploaded)') : current.label);
  // Reading customFont.name makes previews re-render when a new font is uploaded.
  const css = (fid: TextFontId) => `"${familyName(fid)}", system-ui, sans-serif`;

  // Previews need the fonts in the page too (the render worker loads its own copy).
  $effect(() => {
    void customFont.name;
    void loadFont(value);
  });
  $effect(() => {
    if (open) for (const f of FONTS) void loadFont(f.id);
  });

  function pick(fid: TextFontId) {
    onchange(fid);
    open = false;
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // picking the same file again should still fire
    if (!file) return;
    uploading = true;
    uploadError = null;
    try {
      await uploadCustomFont(file);
      await loadFont(CUSTOM_FONT_ID);
      pick(CUSTOM_FONT_ID);
    } catch (err) {
      uploadError = err instanceof Error ? err.message : String(err);
    } finally {
      uploading = false;
    }
  }

  async function remove() {
    await removeCustomFont();
    if (isCustom) onchange(FONTS[0].id);
  }
</script>

<button
  {id}
  type="button"
  class="flex w-full items-center justify-between rounded-lg border bg-gray-700 px-3 py-2 text-left text-white hover:border-gray-400 {open ? 'border-primary-500' : 'border-gray-600'}"
  aria-expanded={open}
  onclick={() => (open = !open)}
>
  {#key customFont.name}
    <span class="truncate text-lg leading-tight" style:font-family={css(isCustom ? CUSTOM_FONT_ID : current.id)}>{currentLabel}</span>
  {/key}
  <ChevronDownOutline class="h-4 w-4 shrink-0 text-gray-400 transition-transform {open ? 'rotate-180' : ''}" />
</button>

{#if open}
  <div class="space-y-3 rounded-lg border border-gray-700 bg-gray-800 p-3">
    <div>
      <p class="mb-1.5 text-[11px] font-medium tracking-wide text-gray-400 uppercase">Your font</p>
      <div class="flex gap-1.5">
        {#if customFont.name}
          {#key customFont.name}
            <button
              type="button"
              class="min-w-0 flex-1 truncate rounded-md border px-2 py-2 text-center text-base text-white hover:border-gray-400 {isCustom ? 'border-primary-500 bg-gray-700' : 'border-gray-600'}"
              style:font-family={css(CUSTOM_FONT_ID)}
              title={customFont.name}
              aria-pressed={isCustom}
              onclick={() => pick(CUSTOM_FONT_ID)}
            >
              {customFont.name}
            </button>
          {/key}
          <button
            type="button"
            class="shrink-0 rounded-md border border-gray-600 px-2 text-gray-400 hover:border-gray-400 hover:text-white"
            title="Remove your font"
            aria-label="Remove your font"
            onclick={remove}
          >
            <CloseOutline class="h-4 w-4" />
          </button>
        {/if}
        <button
          type="button"
          class="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-2 text-sm text-gray-200 hover:border-gray-400 {customFont.name ? '' : 'flex-1 justify-center'}"
          disabled={uploading}
          title="Use a font file from your computer (TTF, OTF, WOFF or WOFF2). It stays in this browser."
          onclick={() => fileInput?.click()}
        >
          <UploadOutline class="h-4 w-4" />
          {uploading ? 'Loading…' : customFont.name ? 'Replace' : 'Upload font…'}
        </button>
        <input bind:this={fileInput} type="file" accept=".ttf,.otf,.woff,.woff2,font/*" class="hidden" onchange={onFile} />
      </div>
      {#if uploadError}
        <p class="mt-1.5 text-xs text-red-400">{uploadError}</p>
      {/if}
    </div>

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
