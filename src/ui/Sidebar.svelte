<script lang="ts" module>
  import type { Group } from '../settings/schema';
  /** Last tab shown; survives the panel closing or the controls being hidden (per page load). */
  let lastTab: Group = 'Spiral';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button, CloseButton, Drawer, TabItem, Tabs } from 'flowbite-svelte';
  import { UndoOutline } from 'flowbite-svelte-icons';
  import { groups, isVisible, schema, type Param, type Settings } from '../settings/schema';
  import Control from './Control.svelte';
  import SectionHeading from './SectionHeading.svelte';
  import { readStored, writeStored } from '../storage';
  import { autoShiftFor, hintFor } from './hints';

  let {
    open = $bindable(),
    width = $bindable(400),
    settings,
    onreset,
    output,
  }: {
    open: boolean;
    /** Panel width in px (the user drags its left edge); bound so the toolbar can move aside. */
    width?: number;
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

  // Drawer width, dragged from its left edge and remembered per browser. 400px fits all six tabs.
  const WIDTH_KEY = 'hypnogen:drawerWidth';
  const DEFAULT_WIDTH = 400;
  const MIN_WIDTH = 300;
  const clampWidth = (w: number) => Math.round(Math.max(MIN_WIDTH, Math.min(w, window.innerWidth - 32)));
  width = clampWidth(Number(readStored(WIDTH_KEY)) || DEFAULT_WIDTH);
  const saveWidth = () => writeStored(WIDTH_KEY, String(width));

  function startResize(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = width;
    const move = (ev: PointerEvent) => (width = clampWidth(startWidth + startX - ev.clientX));
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      saveWidth();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function resizeByKey(e: KeyboardEvent) {
    const delta = e.key === 'ArrowLeft' ? 20 : e.key === 'ArrowRight' ? -20 : 0;
    if (!delta) return;
    e.preventDefault();
    width = clampWidth(width + delta);
    saveWidth();
  }

  function resetWidth() {
    width = DEFAULT_WIDTH;
    saveWidth();
  }

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

<Drawer
  bind:open
  placement="right"
  modal={false}
  outsideclose={false}
  dismissable={false}
  class="flex max-w-[calc(100vw-2rem)] flex-col overflow-clip bg-gray-900/95 p-4 pe-2 backdrop-blur"
  style="width: {width}px"
  aria-label="Customization"
>
  <!-- Drag the left edge to resize; double-click resets; arrow keys when focused. A focusable
       separator is an interactive widget in ARIA (a splitter), which the linter doesn't know. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="group absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize touch-none"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize customization panel"
    aria-valuenow={width}
    aria-valuemin={MIN_WIDTH}
    aria-valuemax={Math.max(MIN_WIDTH, innerWidth - 32)}
    tabindex="0"
    title="Drag to resize (double-click to reset)"
    onpointerdown={startResize}
    ondblclick={resetWidth}
    onkeydown={resizeByKey}
  >
    <div class="h-full w-0.5 bg-transparent transition-colors group-hover:bg-primary-500/70 group-focus-visible:bg-primary-500/70"></div>
  </div>
  <!-- Header, tab bar and footer stay put; only the tab content scrolls. -->
  <div class="mb-2 flex shrink-0 items-center justify-between pe-2">
    <h2 class="text-lg font-semibold text-white">Customization</h2>
    <CloseButton onclick={() => (open = false)} aria-label="Close customization" />
  </div>

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
          {#each visible as p, i (p.key)}
            {#if p.section && p.section !== visible[i - 1]?.section}
              <SectionHeading class={i > 0 ? 'pt-3' : ''}>{p.section}</SectionHeading>
            {/if}
            <Control
              param={p}
              value={settings[p.key as keyof Settings]}
              hint={hintFor(p.key, settings)}
              onchange={(v) => set(p.key, v)}
            />
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
