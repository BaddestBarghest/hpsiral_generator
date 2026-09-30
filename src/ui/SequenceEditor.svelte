<script lang="ts">
  import { tick } from 'svelte';
  import { Button, Label, Select, Toggle } from 'flowbite-svelte';
  import {
    ArrowDownOutline,
    ArrowUpOutline,
    FloppyDiskOutline,
    PenOutline,
    PlayOutline,
    PlaySolid,
    PlusOutline,
    RedoOutline,
    StopSolid,
    TrashBinOutline,
  } from 'flowbite-svelte-icons';
  import {
    lookOf,
    MAX_SCENE_NAME,
    MAX_SCENE_TIME,
    MAX_SCENES,
    type Scene,
    type SequenceUnit,
    type Settings,
  } from '../settings/schema';
  import { loadLook } from '../settings/store.svelte';
  import { sequenceLength, sequenceSeconds } from '../engine/sequence';
  import SectionHeading from './SectionHeading.svelte';

  let {
    settings,
    current,
    onseek,
  }: {
    settings: Settings;
    /** Scene showing and scene being faded into (-1 when stopped). */
    current: { scene: number; next: number };
    /** Jump to the start of a scene. */
    onseek: (index: number) => void;
  } = $props();

  const seq = $derived(settings.sequence);
  const playing = $derived(seq.enabled && seq.scenes.length > 0);
  const unitLabel = $derived(seq.unit === 'beats' ? 'beats' : 's');
  /** New scenes start with these (hold, fade). */
  const DEFAULT_TIMES: Record<SequenceUnit, [number, number]> = { seconds: [20, 5], beats: [32, 8] };

  const snapshotLook = () => lookOf($state.snapshot(settings) as Settings);

  function addScene() {
    const [hold, fade] = DEFAULT_TIMES[seq.unit];
    seq.scenes.push({ name: `Scene ${seq.scenes.length + 1}`, look: snapshotLook(), hold, fade });
  }

  function move(i: number, by: number) {
    const [scene] = seq.scenes.splice(i, 1);
    seq.scenes.splice(i + by, 0, scene);
  }

  function remove(i: number) {
    seq.scenes.splice(i, 1);
    if (seq.scenes.length === 0) seq.enabled = false;
  }

  /** Starts playing from scene `i` (the sequence starts first, so the jump isn't undone by it). */
  async function playFrom(i: number) {
    seq.enabled = true;
    await tick();
    onseek(i);
  }

  function setTime(scene: Scene, key: 'hold' | 'fade', raw: string) {
    const v = Number(raw);
    scene[key] = Number.isFinite(v) ? Math.min(MAX_SCENE_TIME, Math.max(0, v)) : scene[key];
  }

  /** Switching unit converts every time at its own scene's tempo, so nothing changes length. */
  function setUnit(unit: SequenceUnit) {
    if (unit === seq.unit) return;
    for (const sc of seq.scenes) {
      const perSecond = sc.look.bpm / 60;
      const convert = (v: number) => (unit === 'beats' ? Math.round(v * perSecond) : Math.round((v / perSecond) * 10) / 10);
      sc.hold = convert(sc.hold);
      sc.fade = convert(sc.fade);
    }
    seq.unit = unit;
  }

  const fmtSeconds = (s: number) => (s >= 120 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s * 10) / 10} s`);
  const total = $derived(sequenceLength(seq));
  const totalSeconds = $derived(sequenceSeconds(settings));

  const numberInput =
    'w-16 rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white tabular-nums focus:border-primary-500 focus:ring-primary-500';
</script>

<div class="space-y-4">
  <p class="text-xs text-gray-400">
    Save looks as scenes, then play them in order. Each scene shows for its hold time, then fades into the next: numbers
    and colours glide, while choices such as the pattern, shape or font switch half-way through the fade.
  </p>

  {#if seq.scenes.length > 0}
    <div class="flex items-center gap-2">
      {#if playing}
        <Button size="sm" color="alternative" onclick={() => (seq.enabled = false)}>
          <StopSolid class="me-1.5 h-4 w-4" /> Stop
        </Button>
        <Button size="sm" color="alternative" onclick={() => onseek(0)} title="Back to the first scene">
          <RedoOutline class="me-1.5 h-4 w-4" /> Restart
        </Button>
      {:else}
        <Button size="sm" class="text-gray-900!" onclick={() => playFrom(0)}>
          <PlaySolid class="me-1.5 h-4 w-4" /> Play sequence
        </Button>
      {/if}
    </div>
    <p class="text-xs text-gray-300" role="status">
      {#if !playing}
        Stopped: the controls’ own look is showing.
      {:else if current.scene >= 0 && current.next !== current.scene}
        Fading from <span class="text-white">{seq.scenes[current.scene]?.name}</span> to
        <span class="text-white">{seq.scenes[current.next]?.name}</span>.
      {:else if current.scene >= 0}
        Showing <span class="text-white">{seq.scenes[current.scene]?.name}</span>.
      {/if}
    </p>
  {/if}

  <section class="space-y-2">
    <SectionHeading>Scenes</SectionHeading>
    {#each seq.scenes as scene, i (scene)}
      {@const showing = playing && current.scene === i}
      {@const incoming = playing && current.next === i && current.scene !== i}
      <div
        class="space-y-2 rounded-md border bg-gray-800/60 p-2 {showing
          ? 'border-primary-500'
          : incoming
            ? 'border-dashed border-primary-500/60'
            : 'border-gray-700'}"
      >
        <div class="flex items-center gap-1.5">
          <span class="w-5 shrink-0 text-center text-xs text-gray-400 tabular-nums">{i + 1}</span>
          <input
            class="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white focus:border-primary-500 focus:ring-primary-500"
            maxlength={MAX_SCENE_NAME}
            aria-label="Scene name"
            bind:value={scene.name}
          />
          <button type="button" class="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30" title="Move up" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}>
            <ArrowUpOutline class="h-4 w-4" />
          </button>
          <button type="button" class="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30" title="Move down" aria-label="Move down" disabled={i === seq.scenes.length - 1} onclick={() => move(i, 1)}>
            <ArrowDownOutline class="h-4 w-4" />
          </button>
          <button type="button" class="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-red-400" title="Delete scene" aria-label="Delete scene" onclick={() => remove(i)}>
            <TrashBinOutline class="h-4 w-4" />
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 ps-6.5">
          <label class="flex items-center gap-1.5 text-xs text-gray-300">
            Hold
            <input type="number" class={numberInput} min="0" max={MAX_SCENE_TIME} step={seq.unit === 'beats' ? 1 : 0.5} value={scene.hold} onchange={(e) => setTime(scene, 'hold', e.currentTarget.value)} />
            {unitLabel}
          </label>
          <label class="flex items-center gap-1.5 text-xs text-gray-300" title={i === seq.scenes.length - 1 && !seq.loop ? 'The last scene doesn’t fade unless the sequence loops.' : 'Blend into the next scene over this long.'}>
            Fade
            <input type="number" class="{numberInput} {i === seq.scenes.length - 1 && !seq.loop ? 'opacity-40' : ''}" min="0" max={MAX_SCENE_TIME} step={seq.unit === 'beats' ? 1 : 0.5} value={scene.fade} onchange={(e) => setTime(scene, 'fade', e.currentTarget.value)} />
            {unitLabel}
          </label>
        </div>
        <div class="flex flex-wrap gap-1.5 ps-6.5">
          <Button size="xs" color="alternative" onclick={() => playFrom(i)} title="Play the sequence from this scene">
            <PlayOutline class="me-1 h-3.5 w-3.5" /> Play here
          </Button>
          <Button size="xs" color="alternative" onclick={() => loadLook(scene.look)} title="Put this scene’s look in the controls to change it (stops the sequence)">
            <PenOutline class="me-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="xs" color="alternative" onclick={() => (scene.look = snapshotLook())} title="Replace this scene’s look with the controls’ current one">
            <FloppyDiskOutline class="me-1 h-3.5 w-3.5" /> Update
          </Button>
        </div>
      </div>
    {:else}
      <p class="text-sm text-gray-400">No scenes yet. Set up a look with the other tabs, then add it here.</p>
    {/each}
    <Button size="sm" color="alternative" class="w-full" disabled={seq.scenes.length >= MAX_SCENES} onclick={addScene}>
      <PlusOutline class="me-1.5 h-4 w-4" /> Add the current look as a scene
    </Button>
    <p class="text-xs text-gray-400">
      To change a scene: <span class="text-gray-300">Edit</span> puts its look in the controls; adjust it, then press
      <span class="text-gray-300">Update</span>.
    </p>
  </section>

  {#if seq.scenes.length > 0}
    <section class="space-y-3">
      <SectionHeading>Timing</SectionHeading>
      <div class="space-y-1.5">
        <Label for="seq-unit" class="text-sm">Times in</Label>
        <Select
          placeholder=""
          id="seq-unit"
          size="sm"
          items={[
            { name: 'Seconds', value: 'seconds' },
            { name: 'Beats (each scene’s own tempo)', value: 'beats' },
          ]}
          value={seq.unit}
          onchange={(e) => setUnit((e.currentTarget as HTMLSelectElement).value as SequenceUnit)}
        />
      </div>
      <Toggle size="small" bind:checked={seq.loop}>Loop: fade from the last scene back to the first</Toggle>
      <p class="text-xs text-gray-400 tabular-nums">
        One pass lasts
        {#if seq.unit === 'beats'}
          {Math.round(total * 10) / 10} beats (about {fmtSeconds(totalSeconds)}).
        {:else}
          {fmtSeconds(totalSeconds)}.
        {/if}
      </p>
    </section>
  {/if}
</div>
