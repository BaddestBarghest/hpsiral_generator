<script lang="ts" module>
  import type { Group } from '../settings/schema';
  /** Last tab shown; survives the panel closing or the controls being hidden (per page load). */
  let lastTab: Group = 'Spiral';
</script>

<script lang="ts">
  import { Button, TabItem, Tabs } from 'flowbite-svelte';
  import { UndoOutline } from 'flowbite-svelte-icons';
  import { groups, isVisible, schema, type Param, type Settings } from '../settings/schema';
  import Control from './Control.svelte';
  import PanelDrawer from './PanelDrawer.svelte';
  import SectionHeading from './SectionHeading.svelte';
  import PaletteSets from './color/PaletteSets.svelte';
  import { autoShiftFor, hintFor } from './hints';

  let {
    open = $bindable(),
    width = $bindable(400),
    settings,
    onreset,
    onbeat,
  }: {
    open: boolean;
    width?: number;
    settings: Settings;
    onreset: () => void;
    /** Tap tempo marked a beat. */
    onbeat: () => void;
  } = $props();

  const params = schema as readonly Param[];
  const byGroup = Object.fromEntries(groups.map((g) => [g, params.filter((p) => p.group === g)]));

  // Compact underline tabs so all six fit the drawer; the bar scrolls sideways if not.
  const tabBase = 'whitespace-nowrap border-b-2 bg-transparent px-1.5 py-3 text-sm';
  const activeTab = `${tabBase} border-primary-500 text-primary-500`;
  const inactiveTab = `${tabBase} border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200`;

  // Which tab is open, starting from the one shown last time.
  const tabOpen = $state(Object.fromEntries(groups.map((g) => [g, g === lastTab])) as Record<Group, boolean>);
  $effect(() => {
    const shown = groups.find((g) => tabOpen[g]);
    if (shown) lastTab = shown;
  });

  function set(key: string, v: unknown) {
    const extra = autoShiftFor(key, v, settings);
    (settings as Record<string, unknown>)[key] = v;
    if (extra) Object.assign(settings, extra);
  }
</script>

<PanelDrawer bind:open bind:width title="Customization">
  <Tabs
    tabStyle="underline"
    ulClass="settings-scroll me-2 flex shrink-0 space-x-0 overflow-x-auto"
    contentClass="settings-scroll relative mt-0 min-h-0 flex-1 overflow-y-auto rounded-none bg-transparent py-4 ps-0 pe-3"
  >
    {#each groups as group (group)}
      <TabItem bind:open={tabOpen[group]} title={group} activeClass={activeTab} inactiveClass={inactiveTab}>
        <!-- Headings come from visible controls only, so a section with nothing to show disappears. -->
        {@const visible = byGroup[group].filter((p) => isVisible(p, settings))}
        <div class="space-y-5">
          {#if group === 'Colour'}
            <PaletteSets {settings} />
          {/if}
          {#each visible as p, i (p.key)}
            {#if p.section && p.section !== visible[i - 1]?.section}
              <SectionHeading class={i > 0 ? 'pt-3' : ''}>{p.section}</SectionHeading>
            {/if}
            <Control
              param={p}
              value={settings[p.key as keyof Settings]}
              hint={hintFor(p.key, settings)}
              onchange={(v) => set(p.key, v)}
              {onbeat}
            />
          {/each}
        </div>
      </TabItem>
    {/each}
  </Tabs>

  {#snippet footer()}
    <Button size="xs" color="alternative" onclick={onreset}>
      <UndoOutline class="me-1.5 h-3.5 w-3.5" /> Reset to defaults
    </Button>
  {/snippet}
</PanelDrawer>
