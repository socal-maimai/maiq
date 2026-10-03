<script lang="ts" module>
  import { ARCADES, arcadesIn, REGIONS, type RegionId } from '@maiq/core/arcades'
  import type { LineState } from '@maiq/core/state'
  import { CALIFORNIA_BOUNDS, CALIFORNIA_PATH } from '$lib/map/california'
  import { bestTier, toMap } from '$lib/map/pins'

  const LABEL_OFFSET_KM: Record<RegionId, { x: number; y: number }> = {
    socal: { x: 110, y: -170 },
    norcal: { x: 150, y: 0 },
  }

  const percent = (value: number, total: number): string => `${(value / total) * 100}%`

  const LABELS = REGIONS.map(region => {
    const points = arcadesIn(region.id).map(toMap)
    const offset = LABEL_OFFSET_KM[region.id]
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length + offset.x
    const y = points.reduce((sum, point) => sum + point.y, 0) / points.length + offset.y
    return {
      region,
      count: points.length,
      left: percent(x, CALIFORNIA_BOUNDS.width),
      top: percent(y, CALIFORNIA_BOUNDS.height),
    }
  })
</script>

<script lang="ts">
  type Props = { states: ReadonlyMap<string, LineState> }

  let { states }: Props = $props()

  const pins = $derived(
    ARCADES.map(arcade => {
      const { x, y } = toMap(arcade)
      return { arcade, x, y, tier: bestTier(arcade, states) }
    })
  )
</script>

<map-frame style:aspect-ratio="{CALIFORNIA_BOUNDS.width} / {CALIFORNIA_BOUNDS.height}">
  <svg
    viewBox="0 0 {CALIFORNIA_BOUNDS.width} {CALIFORNIA_BOUNDS.height}"
    role="img"
    aria-label="Map of California with {ARCADES.length} maimai arcades"
  >
    <path
      d={CALIFORNIA_PATH}
      transform="translate({-CALIFORNIA_BOUNDS.x} {-CALIFORNIA_BOUNDS.y})"
      data-part="land"
    />
    {#each pins as pin (pin.arcade.id)}
      <circle cx={pin.x} cy={pin.y} r="12" data-fresh={pin.tier ? '' : undefined}>
        <title>{pin.arcade.name}</title>
      </circle>
    {/each}
  </svg>
  {#each LABELS as label (label.region.id)}
    <a href="/{label.region.id}" style:left={label.left} style:top={label.top}>
      <strong>{label.region.name}</strong>
      <span>{label.count} arcades</span>
    </a>
  {/each}
</map-frame>

<style>
  map-frame {
    position: relative;
    display: block;
    inline-size: 100%;
    max-inline-size: 26rem;
    margin-inline: auto;
  }

  svg {
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }

  [data-part='land'] {
    fill: var(--card);
    stroke: var(--line);
    stroke-width: 3;
    stroke-linejoin: round;
  }

  circle {
    fill: var(--muted);
    stroke: var(--card);
    stroke-width: 3;

    &[data-fresh] {
      fill: var(--pink);
    }
  }

  a {
    position: absolute;
    display: grid;
    padding: 0.4rem 0.8rem;
    line-height: 1.2;
    white-space: nowrap;
    color: var(--ink);
    text-decoration: none;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 0.9rem;
    box-shadow: var(--shadow-raised);
    translate: 0 -50%;

    &:hover strong {
      color: var(--pink);
    }

    & span {
      font-size: 0.8rem;
      color: var(--muted);
    }
  }
</style>
