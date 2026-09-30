<script lang="ts">
  import type { Settings } from '../settings/schema';
  import { armRadial, armShape } from '../render/armCurves';

  /**
   * Picture of a spiral's arms out to the edge of the screen's short side: the centre line of
   * each arm, where the pattern coordinate is whole (see spiralField in scene.frag.glsl).
   * Ignores the outline shape, wobble and zoom; it's about how the arms wind.
   */
  let { settings, s2 = false }: { settings: Settings; s2?: boolean } = $props();

  const POINTS = 1200;
  const R0 = 0.01;

  const arms = $derived(Math.round(s2 ? settings.s2Arms : settings.arms));
  const paths = $derived.by(() => {
    const shape = armShape(settings, s2);
    const density = s2 ? settings.s2Density : settings.density;
    const mirror = (s2 ? settings.s2Mirror : settings.mirror) ? -1 : 1;
    const c = settings.centerSpread;
    // The pattern is arms·θ/2π + density·f(ρ) + arms·twist·ρ; an arm's centre keeps it constant.
    const angle = (r: number, arm: number) => {
      const rho = Math.sqrt(r * r + c * c);
      const v = density * armRadial(shape, rho, c) + arms * settings.twist * rho;
      return (mirror * 2 * Math.PI * (arm - v)) / arms;
    };
    const out: string[] = [];
    for (let arm = 0; arm < arms; arm++) {
      let d = '';
      for (let i = 0; i <= POINTS; i++) {
        const r = R0 + (1 - R0) * (i / POINTS);
        const a = angle(r, arm);
        if (!Number.isFinite(a)) continue;
        d += `${d ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(4)} ${(-r * Math.sin(a)).toFixed(4)}`;
      }
      out.push(d);
    }
    return out;
  });
</script>

<div class="flex justify-center">
  <svg
    viewBox="-1.08 -1.08 2.16 2.16"
    class="h-36 w-36 rounded-full border border-gray-700 bg-gray-800/60 text-primary-500"
    role="img"
    aria-label={`Shape of the ${arms === 1 ? 'arm' : `${arms} arms`}`}
  >
    {#each paths as d, i (i)}
      <path {d} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    {/each}
  </svg>
</div>
