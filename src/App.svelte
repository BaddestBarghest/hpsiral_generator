<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Toast } from 'flowbite-svelte';
  import {
    AdjustmentsHorizontalOutline,
    CompressOutline,
    ExpandOutline,
    EyeSlashOutline,
    PauseSolid,
    PlaySolid,
    StopSolid,
    VideoCameraSolid,
  } from 'flowbite-svelte-icons';
  import { settings, persistSettings, resetSettings } from './settings/store.svelte';
  import { createRenderHost, type RenderHost } from './render/host';
  import type { FromRender, Viewport } from './render/protocol';
  import { LiveRecorder, supportedFormats, type RecordPrefs } from './record/liveRecorder';
  import { saveBlob, timestampedName } from './record/save';
  import Sidebar from './ui/Sidebar.svelte';
  import SafetyGate from './ui/SafetyGate.svelte';
  import RecordPanel from './ui/RecordPanel.svelte';

  const SAFETY_KEY = 'hypnogen:safety-ack:v1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function readAck(): boolean {
    try {
      return localStorage.getItem(SAFETY_KEY) === '1';
    } catch {
      return false;
    }
  }

  let canvas: HTMLCanvasElement;
  let host: RenderHost | null = null;

  let safetyAck = $state(readAck());
  let userPlaying = $state(!reducedMotion);
  const playing = $derived(safetyAck && userPlaying);

  let drawerOpen = $state(false);
  let uiHidden = $state(false);
  let isFullscreen = $state(false);
  let fps = $state(0);
  let renderMode = $state<'worker' | 'inline' | ''>('');
  let error = $state<string | null>(null);

  const formats = supportedFormats();
  let recordPrefs = $state<RecordPrefs>({ formatId: formats[0]?.id ?? '', fps: 60, bitrateMbps: 16 });
  let recorder = $state.raw<LiveRecorder | null>(null);
  let recordStart = 0;
  let recordElapsed = $state(0);

  function viewport(): Viewport {
    return { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, dpr: devicePixelRatio || 1 };
  }

  function onRenderEvent(msg: FromRender) {
    if (msg.type === 'stats') fps = Math.round(msg.fps);
    else if (msg.type === 'error') error = msg.message;
  }

  onMount(() => {
    try {
      host = createRenderHost(canvas, {
        settings: $state.snapshot(settings),
        viewport: viewport(),
        playing,
        onEvent: onRenderEvent,
      });
      renderMode = host.mode;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      return;
    }
    const onResize = () => host?.setViewport(viewport());
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    // Browser zoom changes devicePixelRatio without resizing the element's CSS box.
    window.addEventListener('resize', onResize);
    const onFs = () => (isFullscreen = !!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
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
    try {
      localStorage.setItem(SAFETY_KEY, '1');
    } catch {
      /* storage unavailable */
    }
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

  function onKeydown(e: KeyboardEvent) {
    if (!safetyAck || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && drawerOpen) {
      drawerOpen = false;
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
        drawerOpen = !drawerOpen;
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

<svelte:window onkeydown={onKeydown} />

<canvas
  bind:this={canvas}
  class="fixed inset-0 block h-full w-full"
  class:cursor-none={uiHidden}
  onclick={() => (uiHidden = false)}
  aria-label="Animated spiral"
></canvas>

{#if !uiHidden}
  <!-- Shifts left of the open drawer (w-96 = 24rem) on screens wide enough to show both. -->
  <div class="fixed top-3 right-3 z-10 flex items-center gap-2 transition-[right] duration-200 {drawerOpen ? 'sm:right-[25rem]' : ''}">
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
    <Button size="sm" color={recorder ? 'red' : 'dark'} class="p-2" onclick={toggleRecording} aria-label={recorder ? 'Stop recording (R)' : 'Record (R)'} title={recorder ? 'Stop recording (R)' : 'Record (R)'} disabled={formats.length === 0}>
      {#if recorder}<StopSolid class="h-5 w-5" />{:else}<VideoCameraSolid class="h-5 w-5" />{/if}
    </Button>
    <Button size="sm" color="dark" class="p-2" onclick={toggleFullscreen} aria-label="Fullscreen (F)" title="Fullscreen (F)">
      {#if isFullscreen}<CompressOutline class="h-5 w-5" />{:else}<ExpandOutline class="h-5 w-5" />{/if}
    </Button>
    <Button size="sm" color="dark" class="p-2" onclick={() => (uiHidden = true)} aria-label="Hide controls (H)" title="Hide controls (H). Click the spiral to show them again.">
      <EyeSlashOutline class="h-5 w-5" />
    </Button>
    <Button size="sm" color="dark" class="p-2" onclick={() => (drawerOpen = !drawerOpen)} aria-label="Customization (C)" title="Customization (C)">
      <AdjustmentsHorizontalOutline class="h-5 w-5" />
    </Button>
  </div>

  <Sidebar bind:open={drawerOpen} {settings} onreset={resetSettings}>
    {#snippet record()}
      <RecordPanel
        bind:prefs={recordPrefs}
        {formats}
        recording={!!recorder}
        elapsed={recordElapsed}
        ontoggle={toggleRecording}
      />
    {/snippet}
  </Sidebar>
{/if}

{#if error}
  <Toast color="red" class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2" dismissable onclose={() => (error = null)}>
    {error}
  </Toast>
{/if}

<SafetyGate open={!safetyAck} {reducedMotion} onaccept={acceptSafety} />
