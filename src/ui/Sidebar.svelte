<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button, CloseButton, Drawer, TabItem, Tabs } from 'flowbite-svelte';
  import { UndoOutline } from 'flowbite-svelte-icons';
  import { groups, isVisible, schema, type Param, type Settings } from '../settings/schema';
  import Control from './Control.svelte';

  let {
    open = $bindable(),
    settings,
    onreset,
    record,
  }: {
    open: boolean;
    settings: Settings;
    onreset: () => void;
    record: Snippet;
  } = $props();

  const params = schema as readonly Param[];
  const byGroup = Object.fromEntries(groups.map((g) => [g, params.filter((p) => p.group === g)]));

  function set(key: string, v: unknown) {
    (settings as Record<string, unknown>)[key] = v;
  }
</script>

<Drawer
  bind:open
  placement="right"
  modal={false}
  outsideclose={false}
  dismissable={false}
  class="flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden bg-gray-900/95 p-4 pe-2 backdrop-blur"
  aria-label="Customization"
>
  <!-- Header, tab bar and footer stay put; only the tab content scrolls. -->
  <div class="mb-2 flex shrink-0 items-center justify-between pe-2">
    <h2 class="text-lg font-semibold text-white">Customization</h2>
    <CloseButton onclick={() => (open = false)} aria-label="Close customization" />
  </div>

  <Tabs
    tabStyle="underline"
    ulClass="shrink-0 me-2"
    contentClass="settings-scroll mt-0 min-h-0 flex-1 overflow-y-auto rounded-none bg-transparent py-4 ps-0 pe-3"
  >
    {#each groups as group, gi (group)}
      <TabItem open={gi === 0} title={group}>
        <div class="space-y-5">
          {#each byGroup[group] as p, i (p.key)}
            {#if p.section && p.section !== byGroup[group][i - 1]?.section}
              <h3 class="border-b border-gray-700 pb-1 text-xs font-semibold tracking-wider text-primary-500 uppercase {i > 0 ? 'pt-3' : ''}">
                {p.section}
              </h3>
            {/if}
            {#if isVisible(p, settings)}
              <Control param={p} value={settings[p.key as keyof Settings]} onchange={(v) => set(p.key, v)} />
            {/if}
          {/each}
        </div>
      </TabItem>
    {/each}
    <TabItem title="Record">
      {@render record()}
    </TabItem>
  </Tabs>

  <div class="shrink-0 border-t border-gray-700 pt-3 pe-2">
    <Button size="xs" color="alternative" onclick={onreset}>
      <UndoOutline class="me-1.5 h-3.5 w-3.5" /> Reset to defaults
    </Button>
  </div>
</Drawer>
