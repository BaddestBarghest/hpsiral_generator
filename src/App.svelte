<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { dur, FAST, MEDIUM } from './ui/motion';
  import { Button, Toast } from 'flowbite-svelte';
  import {
    AdjustmentsHorizontalOutline,
    CompressOutline,
    ExpandOutline,
    EyeSlashOutline,
    FileExportOutline,
    PauseSolid,
    PlaySolid,
    StopSolid,
    VideoCameraSolid,
  } from 'flowbite-svelte-icons';
  import { settings, persistSettings, resetSettings, loadSettingsFile, applySettings } from './settings/store.svelte';
  import { hasSharedSettings, settingsFromLink } from './settings/shareLink';
  import { settingsToJson } from './settings/schema';
  import { readStored, writeStored } from './storage';
  import { initCustomFont } from './ui/customFont.svelte';
  import { createRenderHost, type RenderHost } from './render/host';
  import type { FromRender, Viewport } from './render/protocol';
  import { LiveRecorder, supportedFormats, type RecordPrefs } from './record/liveRecorder';
  import { openFileSink, removeFile, saveBlob, timestampedName, type FileSink } from './record/save';
  import { frameCount, RENDER_FORMATS, type RenderRequest } from './record/renderJob';
  import Sidebar from './ui/Sidebar.svelte';
  import SafetyGate from './ui/SafetyGate.svelte';
  import RenderProgress from './ui/RenderProgress.svelte';

  const SAFETY_KEY = 'hypnogen:safety-ack:v1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;


  let canvas: HTMLCanvasElement;
  // Reactive, so effects re-send settings once the host is ready (it starts asynchronously).
  let host = $state.raw<RenderHost | null>(null);

  let safetyAck = $state(readStored(SAFETY_KEY) === '1');
  let userPlaying = $state(!reducedMotion);
  const playing = $derived(safetyAck && userPlaying);

  // Customization and Export share the right edge; opening one closes the other.
  let drawerOpen = $state(false);
  let exportOpen = $state(false);
  let drawerWidth = $state(400);
  let toolbarWidth = $state(0);
  let windowWidth = $state(innerWidth);
  const panelOpen = $derived(drawerOpen || exportOpen);
  /** Set once Export is first opened; its code is only fetched then. */
  let exportUsed = $state(false);
  $effect(() => {
    if (exportOpen) exportUsed = true;
  });
  // Beside the open panel, but never pushed off the left edge by a very wide one.
  const toolbarOffset = $derived(Math.max(12, Math.min(drawerWidth + 16, windowWidth - toolbarWidth - 12)));
  let uiHidden = $state(false);
  let isFullscreen = $state(false);
  let fps = $state(0);
  let renderMode = $state<'worker' | 'inline' | ''>('');
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);

  // Messages close themselves (errors stay longer); hovering over them pauses the timer.
  const NOTICE_MS = 4000;
  const ERROR_MS = 8000;
  let hoveringToasts = $state(false);
  $effect(() => {
    if (!notice || hoveringToasts) return;
    const id = setTimeout(() => (notice = null), NOTICE_MS);
    return () => clearTimeout(id);
  });
  $effect(() => {
    if (!error || hoveringToasts) return;
    const id = setTimeout(() => (error = null), ERROR_MS);
    return () => clearTimeout(id);
  });

  // ── Settings files ──
  function saveSettings() {
    saveBlob(new Blob([settingsToJson($state.snapshot(settings))], { type: 'application/json' }), timestampedName('hypnogen-settings', 'json'));
  }

  async function loadSettings(file: File) {
    try {
      loadSettingsFile(await file.text());
      notice = `Loaded settings from ${file.name}.`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  // ── Share links ──
  // Settings from a link's hash replace the current ones; the hash is then dropped from the
  // address, so a reload keeps any changes made since instead of going back to the link's.
  async function loadSharedSettings() {
    if (!hasSharedSettings(location.hash)) return;
    const hash = location.hash;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      applySettings(await settingsFromLink(hash, $state.snapshot(settings)));
      notice = 'Loaded settings from a shared link.';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  interface RenderState {
    frame: number;
    total: number;
    fileName: string;
    mimeType: string;
    cancelling: boolean;
  }
  let rendering = $state<RenderState | null>(null);
  /** File being streamed into (save dialog), if any; deleted again if the render doesn't finish. */
  let fileSink: FileSink | null = null;
  /** True while the save dialog is open, so a second click can't start a second render. */
  let choosingFile = $state(false);

  const formats = supportedFormats();
  let recordPrefs = $state<RecordPrefs>({ formatId: formats[0]?.id ?? '', fps: 60, bitrateMbps: 16 });
  let recorder = $state.raw<LiveRecorder | null>(null);
  let recordStart = 0;
  let recordElapsed = $state(0);

  function viewport(): Viewport {
    return { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, dpr: devicePixelRatio || 1 };
  }

  function onRenderEvent(msg: FromRender) {
    switch (msg.type) {
      case 'stats':
        fps = Math.round(msg.fps);
        break;
      case 'error':
        error = msg.message;
        break;
      case 'snapshot': {
        const name = timestampedName('hypnogen-frame', 'png');
        saveBlob(msg.png, name);
        notice = `Saved ${name}`;
        break;
      }
      case 'renderProgress':
        if (rendering) Object.assign(rendering, { frame: msg.frame, total: msg.total });
        break;
      case 'renderDone':
        if (rendering) {
          if (msg.buffer) saveBlob(new Blob([msg.buffer], { type: rendering.mimeType }), rendering.fileName);
          notice = `Saved ${rendering.fileName}`;
        }
        rendering = null;
        fileSink = null;
        break;
      case 'renderCancelled':
        rendering = null;
        notice = 'Render cancelled.';
        void discardFile();
        break;
      case 'renderError':
        rendering = null;
        error = `Render failed: ${msg.message}`;
        void discardFile();
        break;
    }
  }

  async function discardFile() {
    const sink = fileSink;
    fileSink = null;
    await sink?.discard();
  }

  async function startRender(req: RenderRequest) {
    if (!host || rendering || choosingFile) return;
    choosingFile = true;
    try {
      await beginRender(host, req);
    } finally {
      choosingFile = false;
    }
  }

  /**
   * Remembers that this browser gave us a save-dialog file it then wouldn't let us write,
   * so later renders skip the dialog and download directly instead of asking twice.
   */
  const DIRECT_DOWNLOAD_KEY = 'hypnogen:directDownload';

  async function beginRender(host: RenderHost, req: RenderRequest) {
    const format = RENDER_FORMATS[req.format];
    let fileName = timestampedName('hypno', format.ext);
    // Where supported, stream straight to a file on disk so long 4K renders don't fill memory.
    let sink: FileSink | null = null;
    if (window.showSaveFilePicker && readStored(DIRECT_DOWNLOAD_KEY) !== '1') {
      let handle: FileSystemFileHandle | undefined;
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: format.label, accept: { [format.mimeType]: [`.${format.ext}`] } }],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // user closed the dialog
        // Picker unavailable here (e.g. in an iframe): fall back to a download.
      }
      if (handle) {
        try {
          sink = await openFileSink(handle);
          fileName = handle.name;
        } catch (e) {
          // The dialog already created an empty file there; don't leave it behind.
          await removeFile(handle);
          fileName = handle.name;
          writeStored(DIRECT_DOWNLOAD_KEY, '1');
          console.warn('Writing to the chosen file failed; downloading instead.', e);
          error = `Your browser blocked saving to that folder, so ${handle.name} will download instead. Future renders download directly.`;
        }
      }
    }
    rendering = { frame: 0, total: frameCount(req), fileName, mimeType: format.mimeType, cancelling: false };
    fileSink = sink;
    host.startRender({ ...req, settings: req.settings ?? $state.snapshot(settings) }, sink?.stream);
  }

  function cancelRender() {
    if (!rendering) return;
    rendering.cancelling = true;
    host?.cancelRender();
  }

  onMount(() => {
    let disposed = false;
    createRenderHost(canvas, {
      settings: $state.snapshot(settings),
      viewport: viewport(),
      playing,
      onEvent: onRenderEvent,
    })
      .then((h) => {
        if (disposed) return h.destroy();
        host = h;
        renderMode = h.mode;
        void initCustomFont((data) => host?.setCustomFont(data));
      })
      .catch((e) => (error = e instanceof Error ? e.message : String(e)));
    const onResize = () => host?.setViewport(viewport());
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    // Browser zoom changes devicePixelRatio without resizing the element's CSS box.
    window.addEventListener('resize', onResize);
    const onFs = () => (isFullscreen = !!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    // A link pasted into this tab only changes the hash, which doesn't reload the page.
    void loadSharedSettings();
    window.addEventListener('hashchange', loadSharedSettings);
    return () => {
      disposed = true;
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('hashchange', loadSharedSettings);
      host?.destroy();
    };
  });

  $effect(() => {
    const snap = $state.snapshot(settings);
    host?.setSettings(snap);
    persistSettings(snap);
  });

  $effect(() => {
    host?.setPlaying(playing);
  });

  $effect(() => {
    if (!recorder) return;
    const id = setInterval(() => (recordElapsed = (performance.now() - recordStart) / 1000), 250);
    return () => clearInterval(id);
  });

  function acceptSafety() {
    safetyAck = true;
    writeStored(SAFETY_KEY, '1');
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  async function toggleRecording() {
    if (recorder) {
      const r = recorder;
      recorder = null;
      try {
        saveBlob(await r.stop(), timestampedName('hypno', r.format.ext));
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      return;
    }
    const format = formats.find((f) => f.id === recordPrefs.formatId) ?? formats[0];
    if (!format) {
      error = "This browser can't record canvas video.";
      return;
    }
    try {
      recorder = new LiveRecorder(canvas, { fps: recordPrefs.fps, format, bitrate: recordPrefs.bitrateMbps * 1_000_000 });
      recordStart = performance.now();
      recordElapsed = 0;
    } catch (e) {
      error = `Couldn't start recording: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  function togglePanel(which: 'customize' | 'export') {
    uiHidden = false; // panels live with the other controls
    if (which === 'customize') {
      drawerOpen = !drawerOpen;
      if (drawerOpen) exportOpen = false;
    } else {
      exportOpen = !exportOpen;
      if (exportOpen) drawerOpen = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (!safetyAck || rendering || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && panelOpen) {
      drawerOpen = exportOpen = false;
      return;
    }
    const t = e.target as HTMLElement | null;
    if (t?.closest('input, select, textarea, [contenteditable]')) return;
    // A focused button already activates on Space; handling it too would toggle twice.
    if (e.key === ' ' && t?.closest('button')) return;
    switch (e.key.toLowerCase()) {
      case ' ':
        userPlaying = !userPlaying;
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'h':
        uiHidden = !uiHidden;
        break;
      case 'c':
        togglePanel('customize');
        break;
      case 'e':
        togglePanel('export');
        break;
      case 'r':
        toggleRecording();
        break;
      default:
        return;
    }
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={onKeydown} bind:innerWidth={windowWidth} />

<canvas
  bind:this={canvas}
  class="fixed inset-0 block h-full w-full"
  class:cursor-none={uiHidden}
  onclick={() => (uiHidden = false)}
  aria-label="Animated spiral"
></canvas>

{#if !uiHidden}
  <!-- Shifts left of the open drawer (user-resizable) on screens wide enough to show both. -->
  <div
    class="fixed top-3 right-3 z-10 flex items-center gap-2 {panelOpen ? 'sm:right-[var(--drawer-offset)]' : ''}"
    style="--drawer-offset: {toolbarOffset}px"
    bind:clientWidth={toolbarWidth}
  >
    {#if recorder}
      <span class="flex items-center gap-1.5 rounded bg-red-600/90 px-2 py-1 text-xs font-medium text-white tabular-nums">
        <span class="h-2 w-2 animate-pulse rounded-full bg-white"></span>
        REC {Math.floor(recordElapsed / 60)}:{String(Math.floor(recordElapsed % 60)).padStart(2, '0')}
      </span>
    {/if}
    <span class="hidden rounded bg-black/75 px-2 py-1 text-xs text-gray-200 tabular-nums sm:inline" title="Render mode · frames per second">
      {renderMode} · {fps} fps
    </span>
    <Button size="sm" color="dark" class="p-2" onclick={() => (userPlaying = !userPlaying)} aria-label={playing ? 'Pause (Space)' : 'Play (Space)'} title={playing ? 'Pause (Space)' : 'Play (Space)'}>
      {#if playing}<PauseSolid class="h-5 w-5" />{:else}<PlaySolid class="h-5 w-5" />{/if}
    </Button>
    <Button size="sm" color={recorder ? 'red' : 'dark'} class="p-2" onclick={toggleRecording} aria-label={recorder ? 'Stop recording (R)' : 'Record (R)'} title={recorder ? 'Stop recording (R)' : 'Record (R)'} disabled={formats.length === 0 || !!rendering}>
      {#if recorder}<StopSolid class="h-5 w-5" />{:else}<VideoCameraSolid class="h-5 w-5" />{/if}
    </Button>
    <Button size="sm" color="dark" class="p-2" onclick={toggleFullscreen} aria-label="Fullscreen (F)" title="Fullscreen (F)">
      {#if isFullscreen}<CompressOutline class="h-5 w-5" />{:else}<ExpandOutline class="h-5 w-5" />{/if}
    </Button>
    <Button size="sm" color="dark" class="p-2" onclick={() => (uiHidden = true)} aria-label="Hide controls (H)" title="Hide controls (H). Click the spiral to show them again.">
      <EyeSlashOutline class="h-5 w-5" />
    </Button>
    <Button size="sm" color={exportOpen ? 'alternative' : 'dark'} class="p-2" onclick={() => togglePanel('export')} aria-label="Export video (E)" title="Export video or GIF (E)">
      <FileExportOutline class="h-5 w-5" />
    </Button>
    <Button size="sm" color={drawerOpen ? 'alternative' : 'dark'} class="p-2" onclick={() => togglePanel('customize')} aria-label="Customization (C)" title="Customization (C)">
      <AdjustmentsHorizontalOutline class="h-5 w-5" />
    </Button>
  </div>

  <Sidebar bind:open={drawerOpen} bind:width={drawerWidth} {settings} onreset={resetSettings} onsave={saveSettings} onload={loadSettings} onbeat={() => host?.alignBeat()} />
  <!-- Loaded the first time it's opened (render/record settings, loop planner). -->
  {#if exportUsed}
    {#await import('./ui/ExportPanel.svelte') then { default: ExportPanel }}
  <ExportPanel
    bind:open={exportOpen}
    bind:width={drawerWidth}
    {settings}
    renderBusy={!!rendering || !!recorder || choosingFile}
    onrender={startRender}
    bind:recordPrefs
    {formats}
    recording={!!recorder}
    elapsed={recordElapsed}
    ontogglerecording={toggleRecording}
    onsnapshot={() => host?.snapshot()}
  />
    {/await}
  {/if}
{/if}

<!-- Stacked, so a "saved" notice doesn't cover an earlier warning. -->
<div
  class="fixed bottom-4 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2"
  role="status"
  onmouseenter={() => (hoveringToasts = true)}
  onmouseleave={() => (hoveringToasts = false)}
>
  <!-- Our own transitions: the Toast's built-in one only runs when it closes itself. -->
  {#if error}
    <div in:fly={{ y: 16, duration: dur(MEDIUM) }} out:fly={{ y: 16, duration: dur(FAST) }}>
      <Toast color="red" class="max-w-md" dismissable onclose={() => (error = null)}>
        {error}
      </Toast>
    </div>
  {/if}
  {#if notice}
    <div in:fly={{ y: 16, duration: dur(MEDIUM) }} out:fly={{ y: 16, duration: dur(FAST) }}>
      <Toast color="green" class="max-w-md" dismissable onclose={() => (notice = null)}>
        {notice}
      </Toast>
    </div>
  {/if}
</div>

<RenderProgress
  open={!!rendering}
  frame={rendering?.frame ?? 0}
  total={rendering?.total ?? 0}
  fileName={rendering?.fileName ?? ''}
  cancelling={rendering?.cancelling ?? false}
  oncancel={cancelRender}
/>

<SafetyGate open={!safetyAck} {reducedMotion} onaccept={acceptSafety} />
