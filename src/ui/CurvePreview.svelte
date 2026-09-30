<script lang="ts">
  import { curveAt, type Curve } from '../engine/curves';

  /** Preview of a looping curve: the value across one cycle, from `from` (ends) to `to` (peak). */
  let {
    curve,
    from,
    to,
    beats,
    mean = null,
    note,
    label,
  }: {
    curve: Curve;
    from: number;
    to: number;
    beats: number;
    /** Draws a dashed line at this value. */
    mean?: number | null;
    /** Caption between the cycle's start and end. */
    note: string;
    /** Accessible description. */
    label: string;
  } = $props();

  const W = 240;
  const H = 72;
  const PAD = 4;
  const POINTS = 120;

  // Scale from 0 (or below, for negative values) to the highest value, so the curve fills the height.
  const lo = $derived(Math.min(0, from, to));
  const hi = $derived(Math.max(from, to, lo + 1e-6));
  const y = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - lo) / (hi - lo));

  const line = $derived.by(() => {
    const pts: string[] = [];
    for (let i = 0; i <= POINTS; i++) {
      const f = i / POINTS;
      pts.push(`${(f * W).toFixed(1)},${y(from + (to - from) * curveAt(curve, f)).toFixed(1)}`);
    }
    return pts.join(' ');
  });
  const area = $derived(`0,${H} ${line} ${W},${H}`);
</script>

<figure class="space-y-1">
  <svg
    viewBox="0 0 {W} {H}"
    class="h-18 w-full overflow-visible rounded-md border border-gray-700 bg-gray-800/60 text-primary-500"
    preserveAspectRatio="none"
    role="img"
    aria-label={label}
  >
    <polygon points={area} fill="currentColor" fill-opacity="0.15" />
    {#if mean !== null}
      <line x1="0" x2={W} y1={y(mean)} y2={y(mean)} class="text-gray-500" stroke="currentColor" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
    {/if}
    <polyline points={line} fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
  </svg>
  <figcaption class="flex justify-between text-xs tabular-nums text-gray-400">
    <span>0</span>
    <span>{note}</span>
    <span>{beats} beats</span>
  </figcaption>
</figure>
