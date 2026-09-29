<script lang="ts">
  import type { Snippet } from 'svelte';
  import { CloseButton, Drawer } from 'flowbite-svelte';
  import { readStored, writeStored } from '../storage';

  let {
    open = $bindable(),
    width = $bindable(400),
    title,
    children,
    footer,
  }: {
    open: boolean;
    /** Panel width in px (the user drags its left edge); bound so the toolbar can move aside. */
    width?: number;
    title: string;
    /** The panel body; it should scroll itself (the header and footer stay put). */
    children: Snippet;
    footer?: Snippet;
  } = $props();

  // Width is shared by every panel and remembered per browser. 400px fits all the tabs.
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
</script>

<Drawer
  bind:open
  placement="right"
  modal={false}
  outsideclose={false}
  dismissable={false}
  class="flex max-w-[calc(100vw-2rem)] flex-col overflow-clip bg-gray-900/95 p-4 pe-2 backdrop-blur"
  style="width: {width}px"
  aria-label={title}
>
  <!-- Drag the left edge to resize; double-click resets; arrow keys when focused. A focusable
       separator is an interactive widget in ARIA (a splitter), which the linter doesn't know. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="group absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize touch-none"
    role="separator"
    aria-orientation="vertical"
    aria-label={`Resize ${title.toLowerCase()} panel`}
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

  <div class="mb-2 flex shrink-0 items-center justify-between pe-2">
    <h2 class="text-lg font-semibold text-white">{title}</h2>
    <!-- Opening focuses Close rather than the first control, so single-key shortcuts (C, E, Space)
         keep working; they're ignored while a form field has focus. -->
    <CloseButton data-autofocus onclick={() => (open = false)} aria-label={`Close ${title.toLowerCase()}`} />
  </div>

  {@render children()}

  {#if footer}
    <div class="shrink-0 border-t border-gray-700 pt-3 pe-2">
      {@render footer()}
    </div>
  {/if}
</Drawer>
