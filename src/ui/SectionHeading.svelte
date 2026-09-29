<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, class: className = '' }: { children: Snippet; class?: string } = $props();
</script>

<h3 class="border-b border-gray-700 pb-1 text-xs font-semibold tracking-wider text-primary-500 uppercase {className}">
  {@render children()}
</h3>
