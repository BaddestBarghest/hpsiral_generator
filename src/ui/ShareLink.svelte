<script lang="ts">
  import { Button, Input } from 'flowbite-svelte';
  import { CheckOutline, ClipboardOutline } from 'flowbite-svelte-icons';
  import type { Settings } from '../settings/schema';
  import { CUSTOM_FONT_ID } from '../settings/fonts';
  import { settingsToLink } from '../settings/shareLink';

  /** A link that opens the app with the current settings, with a copy button. */
  let { settings }: { settings: Settings } = $props();

  let link = $state('');
  let copied = $state(false);
  let field = $state<HTMLInputElement>();

  // Rebuilt shortly after the settings stop changing (dragging a slider changes them a lot).
  $effect(() => {
    const snap = $state.snapshot(settings) as Settings;
    const id = setTimeout(() => {
      // The page itself, without this tab's query flags (e.g. ?inline).
      void settingsToLink(snap, location.origin + location.pathname).then((l) => (link = l));
    }, 250);
    return () => clearTimeout(id);
  });

  // "Copied" shows until the link changes, or for a couple of seconds.
  $effect(() => {
    void link;
    copied = false;
  });
  $effect(() => {
    if (!copied) return;
    const id = setTimeout(() => (copied = false), 2500);
    return () => clearTimeout(id);
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API unavailable or blocked: fall back to copying the selected field.
      field?.select();
      if (!document.execCommand('copy')) return;
    }
    copied = true;
  }

  const customFont = $derived(settings.textEnabled && settings.textFont === CUSTOM_FONT_ID);
</script>

<div class="space-y-2">
  <div class="flex gap-2">
    <Input
      bind:elementRef={field}
      size="sm"
      readonly
      value={link}
      aria-label="Link to these settings"
      class="min-w-0 flex-1 truncate font-mono text-xs"
      onfocus={() => field?.select()}
    />
    <Button size="xs" color={copied ? 'green' : 'alternative'} class="shrink-0" onclick={copy} disabled={!link}>
      {#if copied}
        <CheckOutline class="me-1.5 h-3.5 w-3.5" /> Copied
      {:else}
        <ClipboardOutline class="me-1.5 h-3.5 w-3.5" /> Copy
      {/if}
    </Button>
  </div>
  {#if customFont}
    <p class="flex gap-1.5 text-xs text-amber-300" role="status">
      <span aria-hidden="true">⚠</span><span>Your uploaded font isn’t in the link; people opening it see the default font.</span>
    </p>
  {/if}
</div>
