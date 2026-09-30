<script lang="ts" module>
  import type { Group } from '../settings/schema';
  /** Last tab shown; survives the panel closing or the controls being hidden (per page load). */
  let lastTab: Group = 'Spiral';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { dur, MEDIUM } from './motion';
  import { Button, TabItem, Tabs } from 'flowbite-svelte';
  import { ChevronLeftOutline, ChevronRightOutline, FloppyDiskOutline, FolderOpenOutline, UndoOutline } from 'flowbite-svelte-icons';
  import { groups, isVisible, newBeatLoop, schema, type LoopableKey, type Param, type RangeParam, type Settings } from '../settings/schema';
  import Control from './Control.svelte';
  import PanelDrawer from './PanelDrawer.svelte';
  import AccordionSection from './AccordionSection.svelte';
  import PaletteSets from './color/PaletteSets.svelte';
  import BeatLoopEditor from './BeatLoopEditor.svelte';
  import ArmPreview from './ArmPreview.svelte';
  import { autoShiftFor, hintFor } from './hints';
  import { readStored, writeStored } from '../storage';

  let {
    open = $bindable(),
    width = $bindable(400),
    settings,
    onreset,
    onsave,
    onload,
    onbeat,
  }: {
    open: boolean;
    width?: number;
    settings: Settings;
    onreset: () => void;
    /** Save the settings to a file. */
    onsave: () => void;
    /** Load settings from a file the user picked. */
    onload: (file: File) => void;
    /** Tap tempo marked a beat. */
    onbeat: () => void;
  } = $props();

  const params = schema as readonly Param[];
  const byGroup = Object.fromEntries(groups.map((g) => [g, params.filter((p) => p.group === g)]));

  // Compact underline tabs; the bar scrolls sideways (wheel, arrows, or swipe) when they don't fit.
  const tabBase = 'whitespace-nowrap border-b-2 bg-transparent px-1.5 py-3 text-sm transition-colors duration-200';
  const activeTab = `${tabBase} border-primary-500 text-primary-500`;
  const inactiveTab = `${tabBase} border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200`;

  // Which tab is open, starting from the one shown last time.
  const tabOpen = $state(Object.fromEntries(groups.map((g) => [g, g === lastTab])) as Record<Group, boolean>);
  $effect(() => {
    const shown = groups.find((g) => tabOpen[g]);
    if (shown) lastTab = shown;
  });

  // ── Accordion sections ──
  // Only each tab's first section starts open, so tabs start short; whatever the user opens
  // or closes is remembered per browser.
  const OPEN_KEY = 'hypnogen:openSections';
  let opened = $state<Record<string, boolean>>(
    (() => {
      try {
        return JSON.parse(readStored(OPEN_KEY) ?? '{}');
      } catch {
        return {};
      }
    })(),
  );
  const firstSection = Object.fromEntries(groups.map((g) => [g, byGroup[g].find((p) => p.section)?.section]));
  const sectionKey = (group: Group, section: string) => `${group}/${section}`;
  const isOpen = (group: Group, section: string) => opened[sectionKey(group, section)] ?? section === firstSection[group];
  function toggleSection(group: Group, section: string) {
    opened[sectionKey(group, section)] = !isOpen(group, section);
    writeStored(OPEN_KEY, JSON.stringify(opened));
  }

  /** Visible settings in order, split into unsectioned ones and runs of one section. */
  function blocks(visible: Param[]): { section: string | null; params: Param[] }[] {
    const out: { section: string | null; params: Param[] }[] = [];
    for (const p of visible) {
      const section = p.section ?? null;
      const last = out[out.length - 1];
      if (last && last.section === section) last.params.push(p);
      else out.push({ section, params: [p] });
    }
    return out;
  }

  // ── Scrollable tab bar ──
  let bar = $state<HTMLDivElement>();
  let canLeft = $state(false);
  let canRight = $state(false);
  const tablist = () => bar?.querySelector<HTMLElement>('[role="tablist"]') ?? null;

  function updateArrows() {
    const t = tablist();
    if (!t) return;
    canLeft = t.scrollLeft > 2;
    canRight = t.scrollLeft + t.clientWidth < t.scrollWidth - 2;
  }

  $effect(() => {
    const t = tablist();
    if (!t) return;
    updateArrows();
    t.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(t);
    return () => {
      t.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  });

  // A vertical mouse wheel over the tab bar scrolls it sideways.
  function onWheel(e: WheelEvent) {
    const t = tablist();
    if (!t || !t.contains(e.target as Node) || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    t.scrollLeft += e.deltaY;
    e.preventDefault();
  }

  const scrollTabs = (dir: number) => tablist()?.scrollBy({ left: dir * 160, behavior: 'smooth' });

  // Keep the open tab in view (e.g. when the panel reopens on a tab that was scrolled away).
  $effect(() => {
    void groups.map((g) => tabOpen[g]);
    void tick().then(() =>
      bar?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    );
  });

  let fileInput = $state<HTMLInputElement>();
  function picked() {
    const file = fileInput?.files?.[0];
    if (file) onload(file);
    if (fileInput) fileInput.value = ''; // so picking the same file again still loads it
  }

  // ── Beat loops ──
  // The ∿ button starts a loop and opens its settings; after that it shows or hides them.
  let loopOpen = $state<Record<string, boolean>>({});
  function toggleLoop(p: RangeParam) {
    const key = p.key as LoopableKey;
    if (!settings.loops[key]) {
      settings.loops[key] = newBeatLoop(p, settings[key]);
      loopOpen[key] = true;
    } else {
      loopOpen[key] = !loopOpen[key];
    }
  }
  function removeLoop(key: LoopableKey) {
    delete settings.loops[key];
    loopOpen[key] = false;
  }

  function set(key: string, v: unknown) {
    const extra = autoShiftFor(key, v, settings);
    (settings as Record<string, unknown>)[key] = v;
    if (extra) Object.assign(settings, extra);
  }
</script>

<PanelDrawer bind:open bind:width title="Customization">
  <!-- The tab bar scrolls sideways; arrows appear at whichever end has more tabs. -->
  <div bind:this={bar} class="relative flex min-h-0 flex-1 flex-col" onwheel={onWheel}>
  {#if canLeft}
    <button
      type="button"
      class="absolute top-0 left-0 z-10 flex h-11 w-8 items-center justify-start bg-gradient-to-r from-gray-900 via-gray-900/90 to-transparent text-gray-300 hover:text-white"
      aria-label="Scroll tabs left"
      onclick={() => scrollTabs(-1)}
    >
      <ChevronLeftOutline class="h-4 w-4" />
    </button>
  {/if}
  {#if canRight}
    <button
      type="button"
      class="absolute top-0 right-2 z-10 flex h-11 w-8 items-center justify-end bg-gradient-to-l from-gray-900 via-gray-900/90 to-transparent text-gray-300 hover:text-white"
      aria-label="Scroll tabs right"
      onclick={() => scrollTabs(1)}
    >
      <ChevronRightOutline class="h-4 w-4" />
    </button>
  {/if}
  <Tabs
    tabStyle="underline"
    ulClass="no-scrollbar me-2 flex shrink-0 space-x-0 overflow-x-auto scroll-smooth"
    contentClass="settings-scroll relative mt-0 min-h-0 flex-1 overflow-y-auto rounded-none bg-transparent py-4 ps-0 pe-3"
  >
    {#each groups as group (group)}
      <TabItem bind:open={tabOpen[group]} title={group} activeClass={activeTab} inactiveClass={inactiveTab}>
        <!-- Headings come from visible controls only, so a section with nothing to show disappears. -->
        {@const visible = byGroup[group].filter((p) => isVisible(p, settings))}
        <div class="space-y-3" in:fly|global={{ y: 8, duration: dur(MEDIUM) }}>
          {#if group === 'Colour'}
            <PaletteSets {settings} />
          {/if}
          {#snippet control(p: Param)}
            {@const loop = p.type === 'range' && p.loopable ? settings.loops[p.key as LoopableKey] : undefined}
            <Control
              param={p}
              value={settings[p.key as keyof Settings]}
              hint={hintFor(p.key, settings)}
              onchange={(v) => set(p.key, v)}
              {onbeat}
              loopTo={loop?.to ?? null}
              loopOpen={!!loopOpen[p.key]}
              onloop={p.type === 'range' && p.loopable ? () => toggleLoop(p) : undefined}
            />
            {#if loop && loopOpen[p.key] && p.type === 'range'}
              <BeatLoopEditor
                param={p}
                value={settings[p.key as LoopableKey]}
                {loop}
                onchange={(l) => (settings.loops[p.key as LoopableKey] = l)}
                onremove={() => removeLoop(p.key as LoopableKey)}
              />
            {/if}
            {#if p.key === 'armCurve' || p.key === 's2ArmCurve'}
              <ArmPreview {settings} s2={p.key === 's2ArmCurve'} />
            {/if}
          {/snippet}
          {#each blocks(visible) as block, bi (`${bi}:${block.section ?? ''}`)}
            {#if block.section}
              {@const section = block.section}
              <AccordionSection
                title={section}
                count={block.params.length}
                open={isOpen(group, section)}
                ontoggle={() => toggleSection(group, section)}
              >
                {#each block.params as p (p.key)}
                  {@render control(p)}
                {/each}
              </AccordionSection>
            {:else}
              {#each block.params as p (p.key)}
                {@render control(p)}
              {/each}
            {/if}
          {/each}
        </div>
      </TabItem>
    {/each}
  </Tabs>
  </div>

  {#snippet footer()}
    <div class="flex flex-wrap gap-2">
      <Button size="xs" color="alternative" onclick={onsave} title="Save these settings to a file">
        <FloppyDiskOutline class="me-1.5 h-3.5 w-3.5" /> Save
      </Button>
      <Button size="xs" color="alternative" onclick={() => fileInput?.click()} title="Load settings from a saved file">
        <FolderOpenOutline class="me-1.5 h-3.5 w-3.5" /> Load
      </Button>
      <Button size="xs" color="alternative" class="ms-auto" onclick={onreset}>
        <UndoOutline class="me-1.5 h-3.5 w-3.5" /> Reset to defaults
      </Button>
    </div>
    <input bind:this={fileInput} type="file" accept=".json,application/json" class="hidden" onchange={picked} />
  {/snippet}
</PanelDrawer>
