<script lang="ts">
  import { slide } from 'svelte/transition';
  import { Button } from 'flowbite-svelte';
  import { CURVE_SHAPES, curveMean, SHARP_SHAPES } from '../engine/curves';
  import { isRateLoopKey } from '../engine/modulation';
  import { LOOP_BEATS, type BeatLoop, type Param, type RangeParam } from '../settings/schema';
  import { dur, MEDIUM } from './motion';
  import Control from './Control.svelte';
  import CurvePreview from './CurvePreview.svelte';

  /** Settings of one beat loop, shown under the slider it animates. */
  let {
    param,
    value,
    loop,
    onchange,
    onremove,
  }: {
    /** The slider being animated. */
    param: RangeParam;
    /** Its own value: the loop's start and end. */
    value: number;
    loop: BeatLoop;
    onchange: (loop: BeatLoop) => void;
    onremove: () => void;
  } = $props();

  // The loop's fields, drawn with the same controls as every other setting.
  const id = $derived(`${param.key}Loop`);
  const fields = $derived({
    to: {
      ...param,
      key: `${id}To`,
      label: 'Loops to',
      loopable: false,
      help: 'The value at the peak of each cycle. The slider above sets where each cycle starts and ends.',
    },
    shape: { key: `${id}Shape`, label: 'Curve', group: param.group, type: 'select', options: CURVE_SHAPES, default: 'smooth' },
    beats: {
      key: `${id}Beats`, label: 'Cycle', group: param.group, type: 'select', default: '8',
      options: LOOP_BEATS.map((b) => ({ value: String(b), label: `${b} beats` })),
    },
    sharpness: { key: `${id}Sharpness`, label: 'Sharpness', group: param.group, type: 'range', min: 0, max: 1, step: 0.05, default: 0.5, help: 'Higher = a shorter, sharper peak.' },
    peak: { key: `${id}Peak`, label: 'Peak position', group: param.group, type: 'range', min: 0.05, max: 0.95, step: 0.05, default: 0.5, unit: 'of cycle' },
  } satisfies Record<string, Param>);

  const set = (patch: Partial<BeatLoop>) => onchange({ ...loop, ...patch });

  // For a speed, what counts over time is the average (shown as a dashed line).
  const isRate = $derived(isRateLoopKey(param.key));
  const mean = $derived(value + (loop.to - value) * curveMean(loop));

  function fmt(n: number): string {
    const decimals = param.step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(param.step)));
    return n.toFixed(decimals) + (param.unit ? ` ${param.unit}` : '');
  }
</script>

<div class="space-y-3 border-l-2 border-primary-500/40 pl-3" transition:slide={{ duration: dur(MEDIUM) }}>
  <Control param={fields.to} value={loop.to} onchange={(v) => set({ to: v as number })} />
  <div class="grid grid-cols-2 gap-2">
    <Control param={fields.shape} value={loop.shape} onchange={(v) => set({ shape: v as BeatLoop['shape'] })} />
    <Control param={fields.beats} value={String(loop.beats)} onchange={(v) => set({ beats: Number(v) })} />
  </div>
  <CurvePreview
    curve={loop}
    from={value}
    to={loop.to}
    beats={loop.beats}
    mean={isRate ? mean : null}
    note={isRate ? `average ${fmt(mean)}` : `${fmt(value)} ↔ ${fmt(loop.to)}`}
    label={`${param.label} over one cycle of ${loop.beats} beats: from ${fmt(value)} to ${fmt(loop.to)} and back`}
  />
  {#if SHARP_SHAPES.includes(loop.shape)}
    <Control param={fields.sharpness} value={loop.sharpness} onchange={(v) => set({ sharpness: v as number })} />
  {/if}
  <Control param={fields.peak} value={loop.peak} onchange={(v) => set({ peak: v as number })} />
  <Button size="xs" color="alternative" onclick={onremove}>Stop animating</Button>
</div>
