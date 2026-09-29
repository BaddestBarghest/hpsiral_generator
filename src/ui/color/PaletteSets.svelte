<script lang="ts">
  import type { Settings } from '../../settings/schema';

  let { settings }: { settings: Settings } = $props();

  /** One-click colour combinations: bright colours, black and white (arms / gaps). */
  const SETS = [
    { name: 'Classic', arms: ['#ffffff'], gaps: ['#000000'] },
    { name: 'Inverse', arms: ['#000000'], gaps: ['#ffffff'] },
    { name: 'Gold', arms: ['#f5cb5c'], gaps: ['#000000'] },
    { name: 'Blood', arms: ['#ff1744'], gaps: ['#000000'] },
    { name: 'Neon', arms: ['#d500f9', '#00e5ff'], gaps: ['#000000'] },
    { name: 'Toxic', arms: ['#76ff03', '#00e676'], gaps: ['#000000'] },
    { name: 'Fire', arms: ['#ff1744', '#ff9100', '#ffea00'], gaps: ['#000000'] },
    { name: 'Ocean', arms: ['#00e5ff', '#2979ff', '#651fff'], gaps: ['#000000'] },
    { name: 'Rainbow', arms: ['#ff1744', '#ffea00', '#2979ff'], gaps: ['#000000'] },
    { name: 'Candy', arms: ['#ff4081', '#ffffff'], gaps: ['#d500f9'] },
    { name: 'Sunset', arms: ['#ff9100', '#ff4081'], gaps: ['#651fff'] },
    { name: 'Ice', arms: ['#ffffff', '#00e5ff'], gaps: ['#2979ff'] },
  ];

  const same = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c === b[i]);

  /** Stripes preview: each arm colour followed by the gap colour. */
  function preview(arms: string[], gaps: string[]): string {
    const stops = arms.flatMap((c, i) => {
      const gap = gaps[i % gaps.length];
      const at = i * 20;
      return [`${c} ${at}px ${at + 10}px`, `${gap} ${at + 10}px ${at + 20}px`];
    });
    return `repeating-linear-gradient(115deg, ${stops.join(', ')})`;
  }

  function apply(set: (typeof SETS)[number]) {
    settings.armColors = [...set.arms];
    settings.gapColors = [...set.gaps];
  }
</script>

<div class="space-y-1.5">
  <p class="text-sm font-medium text-white">Palette sets</p>
  <div class="grid grid-cols-3 gap-1.5">
    {#each SETS as set (set.name)}
      {@const active = same(settings.armColors, set.arms) && same(settings.gapColors, set.gaps)}
      <button
        type="button"
        class="overflow-hidden rounded-md border text-left hover:border-gray-400 {active ? 'border-primary-500' : 'border-gray-600'}"
        title={`Arms ${set.arms.join(', ')}; gaps ${set.gaps.join(', ')}`}
        aria-pressed={active}
        onclick={() => apply(set)}
      >
        <span class="block h-6" style:background={preview(set.arms, set.gaps)}></span>
        <span class="block bg-gray-800 px-1.5 py-0.5 text-xs text-gray-200">{set.name}</span>
      </button>
    {/each}
  </div>
  <p class="text-xs text-gray-400">Sets the arm and gap colours; fine-tune them below.</p>
</div>
