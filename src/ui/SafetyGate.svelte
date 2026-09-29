<script lang="ts">
  import { Button, Modal } from 'flowbite-svelte';

  let { open, reducedMotion, onaccept }: { open: boolean; reducedMotion: boolean; onaccept: () => void } = $props();
</script>

<Modal title="Photosensitivity warning" {open} dismissable={false} permanent size="sm">
  <div class="space-y-3 text-sm text-gray-300">
    <p>
      This app shows moving spirals, flashing and rapidly changing colours. These can trigger seizures in people with
      photosensitive epilepsy, and can cause dizziness or discomfort in others.
    </p>
    {#if reducedMotion}
      <p class="font-medium text-amber-300">
        Your system asks for reduced motion, so the animation will start paused. Press Play when you're ready.
      </p>
    {/if}
    <p>Stop immediately if you feel unwell. Don't use it while driving or operating machinery.</p>
  </div>
  {#snippet footer()}
    <Button class="text-gray-900!" onclick={onaccept}>I understand</Button>
  {/snippet}
</Modal>
