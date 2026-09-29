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
    output,
  }: {
    open: boolean;
    settings: Settings;
    onreset: () => void;
    /** Extra content at the end of the Output tab (recording and rendering). */
    output: Snippet;
  } = $props();

  const params = schema as readonly Param[];
  const byGroup = Object.fromEntries(groups.map((g) => [g, params.filter((p) => p.group === g)]));

  // Compact underline tabs so all six fit the drawer; the bar scrolls sideways if not.
  const tabBase = 'whitespace-nowrap border-b-2 bg-transparent px-1.5 py-3 text-sm';
  const activeTab = `${tabBase} border-primary-500 text-primary-500`;
  const inactiveTab = `${tabBase} border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200`;

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
  class="flex w-[25rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden bg-gray-900/95 p-4 pe-2 backdrop-blur"
  aria-label="Customization"
>
  <!-- Header, tab bar and footer stay put; only the tab content scrolls. -->
  <div class="mb-2 flex shrink-0 items-center justify-between pe-2">
    <h2 class="text-lg font-semibold text-white">Customization</h2>
    <CloseButton onclick={() => (open = false)} aria-label="Close customization" />
  </div>

  <Tabs
    tabStyle="underline"
    ulClass="settings-scroll me-2 flex shrink-0 space-x-0 overflow-x-auto"
    contentClass="settings-scroll mt-0 min-h-0 flex-1 overflow-y-auto rounded-none bg-transparent py-4 ps-0 pe-3"
  >
    {#each groups as group, gi (group)}
      <TabItem open={gi === 0} title={group} activeClass={activeTab} inactiveClass={inactiveTab}>
        <!-- Headings come from visible controls only, so a section with nothing to show disappears. -->
        {@const visible = byGroup[group].filter((p) => isVisible(p, settings))}
        <div class="space-y-5">
          {#each visible as p, i (p.key)}
            {#if p.section && p.section !== visible[i - 1]?.section}
              <h3 class="border-b border-gray-700 pb-1 text-xs font-semibold tracking-wider text-primary-500 uppercase {i > 0 ? 'pt-3' : ''}">
                {p.section}
              </h3>
            {/if}
            <Control param={p} value={settings[p.key as keyof Settings]} onchange={(v) => set(p.key, v)} />
          {/each}
          {#if group === 'Output'}
            {@render output()}
          {/if}
        </div>
      </TabItem>
    {/each}
  </Tabs>

  <div class="shrink-0 border-t border-gray-700 pt-3 pe-2">
    <Button size="xs" color="alternative" onclick={onreset}>
      <UndoOutline class="me-1.5 h-3.5 w-3.5" /> Reset to defaults
    </Button>
  </div>
</Drawer>
