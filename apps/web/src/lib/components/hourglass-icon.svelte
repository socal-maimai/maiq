<script lang="ts">
  import type { WaitTier } from '@maiq/core/rotation'

  type Props = { tier: WaitTier }

  let { tier }: Props = $props()

  const TOP_SAND: Record<WaitTier, number> = { go: 6.4, soon: 5.1, long: 3.9 }
  const BOTTOM_PEAK: Record<WaitTier, number> = { go: 9.6, soon: 11, long: 12.2 }

  const halfWidth = (y: number): number => 0.9 + (8 - y) * 0.55

  const topSand = $derived.by(() => {
    const y = TOP_SAND[tier]
    const half = halfWidth(y)
    return `M${(8 - half).toFixed(2)} ${y}H${(8 + half).toFixed(2)}L8 8.2z`
  })
  const bottomSand = $derived(`M5 12.8Q8 ${BOTTOM_PEAK[tier]} 11 12.8z`)
</script>

<svg viewBox="0 0 16 16" aria-hidden="true">
  <path
    d="M4.3 3.2C4.3 6.3 7 6.7 7 8s-2.7 1.7-2.7 4.8h7.4C11.7 9.7 9 9.3 9 8s2.7-1.7 2.7-4.8z"
    fill="currentColor"
    fill-opacity=".16"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linejoin="round"
  />
  <path d={topSand} fill="currentColor" />
  <path d={bottomSand} fill="currentColor" />
  <rect x="3" y="1.3" width="10" height="2.1" rx="1.05" fill="currentColor" />
  <rect x="3" y="12.6" width="10" height="2.1" rx="1.05" fill="currentColor" />
</svg>

<style>
  svg {
    display: inline-block;
    inline-size: 1.4cap;
    block-size: 1.4cap;
    margin-inline-end: 0.35rem;
    vertical-align: calc((1cap - 1.4cap) / 2);
  }
</style>
