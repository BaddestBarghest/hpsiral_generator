<script lang="ts">
  import type { Snippet } from 'svelte';
  import { slide } from 'svelte/transition';
  import { ChevronRightOutline } from 'flowbite-svelte-icons';
  import { dur, MEDIUM } from './motion';

  let {
    title,
    count,
    open,
    ontoggle,
    children,
  }: {
    title: string;
    /** Number of settings inside, shown while folded. */
    count: number;
    open: boolean;
    ontoggle: () => void;
    children: Snippet;
  } = $props();
</script>

<section class="rounded-lg border border-gray-700 bg-gray-800/40">
  <button
    type="button"
    class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-gray-100 transition-colors duration-150 hover:bg-gray-800 {open ? 'rounded-b-none' : ''}"
    aria-expanded={open}
    onclick={ontoggle}
  >
    <ChevronRightOutline class="h-4 w-4 shrink-0 text-primary-500 transition-transform duration-200 motion-reduce:transition-none {open ? 'rotate-90' : ''}" />
    <span class="flex-1">{title}</span>
    {#if !open}
      <span class="text-xs font-normal text-gray-500">{count} {count === 1 ? 'setting' : 'settings'}</span>
    {/if}
  </button>
  {#if open}
    <div class="space-y-5 border-t border-gray-700 px-3 pt-3 pb-4" transition:slide={{ duration: dur(MEDIUM) }}>
      {@render children()}
    </div>
  {/if}
</section>
