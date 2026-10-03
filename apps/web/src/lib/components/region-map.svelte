<script lang="ts" module>
  import { arcadesIn, type Arcade, type RegionId } from '@maiq/core/arcades'
  import { downSides } from '@maiq/core/buttons'
  import { MAX_QUEUE } from '@maiq/core/caps'
  import type { Count } from '@maiq/core/count'
  import { playableSeats, rotation, type Rotation } from '@maiq/core/rotation'
  import { formatAge, type LineState } from '@maiq/core/state'
  import type { ButtonStateJson } from '@maiq/types'
  import { CALIFORNIA_BOUNDS, CALIFORNIA_PATH } from '$lib/map/california'
  import { toMap, type MapPoint } from '$lib/map/pins'
  import { separateCircles } from '$lib/map/separate'

  const PADDING_KM = 28
  const ASPECT = 16 / 10
  const MIN_RADIUS = 6
  const RADIUS_PER_ROOT = 3.2
  const TIP_ROOM = 110

  function frameAround(points: readonly MapPoint[]) {
    const xs = points.map(point => point.x)
    const ys = points.map(point => point.y)
    let width = Math.max(...xs) - Math.min(...xs) + PADDING_KM * 2
    let height = Math.max(...ys) - Math.min(...ys) + PADDING_KM * 2
    if (width / height < ASPECT) width = height * ASPECT
    else height = width / ASPECT
    const centerX = (Math.max(...xs) + Math.min(...xs)) / 2
    const centerY = (Math.max(...ys) + Math.min(...ys)) / 2
    return { x: centerX - width / 2, y: centerY - height / 2, width, height }
  }

  function waiting(arcade: Arcade, states: ReadonlyMap<string, LineState>): number | null {
    let total: number | null = null
    for (const line of arcade.lines) {
      const state = states.get(line.id)
      if (!state?.count || state.freshness !== 'fresh') continue
      total = (total ?? 0) + state.count.queue
    }
    return total
  }

  type LineSummary =
    | { kind: 'none' }
    | { kind: 'report'; count: Count; age: string; wait: Rotation | null }

  function summarize(state: LineState | undefined, seats: number, now: Date): LineSummary {
    if (!state?.count || !state.reportedAt) return { kind: 'none' }
    const { players, queue } = state.count
    const fresh = state.freshness === 'fresh'
    return {
      kind: 'report',
      count: state.count,
      age: formatAge(state.reportedAt, now),
      wait: fresh ? rotation(players, queue, seats, false) : null,
    }
  }
</script>

<script lang="ts">
  import { clock } from '$lib/clock.svelte'
  import HourglassIcon from '$lib/components/hourglass-icon.svelte'
  import { highlight } from '$lib/map/highlight.svelte'

  type Props = {
    region: RegionId
    states: ReadonlyMap<string, LineState>
    buttons: readonly ButtonStateJson[]
  }

  let { region, states, buttons }: Props = $props()

  let width = $state(0)

  const arcades = $derived(arcadesIn(region))
  const frame = $derived(frameAround(arcades.map(toMap)))
  const scale = $derived(width / frame.width)

  const bubbles = $derived.by(() => {
    const sized = arcades.map(arcade => {
      const point = toMap(arcade)
      const queue = waiting(arcade, states)
      const radius =
        queue === null
          ? MIN_RADIUS
          : MIN_RADIUS + RADIUS_PER_ROOT * Math.sqrt(Math.min(queue, MAX_QUEUE))
      return {
        arcade,
        queue,
        radius,
        x: (point.x - frame.x) * scale,
        y: (point.y - frame.y) * scale,
      }
    })
    const separated = separateCircles(sized)
    return sized
      .map((bubble, index) => {
        const { x, y } = separated[index] ?? bubble
        const tipAlign = x < TIP_ROOM ? 'start' : x > width - TIP_ROOM ? 'end' : 'center'
        return {
          arcade: bubble.arcade,
          queue: bubble.queue,
          radius: bubble.radius,
          x,
          y,
          tipBelow: y < TIP_ROOM,
          tipAlign,
        }
      })
      .toSorted((a, b) => b.radius - a.radius)
  })
</script>

<map-frame bind:clientWidth={width}>
  <svg viewBox="{frame.x} {frame.y} {frame.width} {frame.height}" aria-hidden="true">
    <path
      d={CALIFORNIA_PATH}
      transform="translate({-CALIFORNIA_BOUNDS.x} {-CALIFORNIA_BOUNDS.y})"
      data-part="land"
    />
  </svg>
  {#if width > 0}
    <nav aria-label="Arcades on the map">
      {#each bubbles as bubble (bubble.arcade.id)}
        <a
          href="#arcade-{bubble.arcade.id}"
          style:left="{bubble.x}px"
          style:top="{bubble.y}px"
          style:--size="{bubble.radius * 2}px"
          data-reported={bubble.queue === null ? undefined : ''}
          data-active={highlight.isActive(bubble.arcade.id) ? '' : undefined}
          aria-describedby="tip-{bubble.arcade.id}"
          onpointerenter={() => highlight.enter(bubble.arcade.id)}
          onpointerleave={() => highlight.leave(bubble.arcade.id)}
          onfocus={() => highlight.enter(bubble.arcade.id)}
          onblur={() => highlight.leave(bubble.arcade.id)}
        >
          <span
            id="tip-{bubble.arcade.id}"
            role="tooltip"
            data-below={bubble.tipBelow ? '' : undefined}
            data-align={bubble.tipAlign}
          >
            {#if bubble.arcade.lines.length > 1}<strong>{bubble.arcade.name}</strong>{/if}
            {#each bubble.arcade.lines as line (line.id)}
              {@const summary = summarize(
                states.get(line.id),
                playableSeats(line, downSides(buttons, line.id)),
                clock.now
              )}
              <span
                data-part="line"
                data-stale={summary.kind === 'report' && !summary.wait ? '' : undefined}
              >
                {#if bubble.arcade.lines.length > 1}
                  <em>{line.label}</em>
                {:else}
                  <strong>{bubble.arcade.name}</strong>
                {/if}
                {#if summary.kind === 'none'}
                  <span data-part="count">?</span>
                  <span data-part="empty">No reports yet</span>
                {:else}
                  <span data-part="count">
                    {summary.count.players}<i>p</i>{summary.count.queue}<i>q</i>
                  </span>
                  {#if summary.wait}
                    <span data-part="wait" data-tier={summary.wait.tier}>
                      <HourglassIcon tier={summary.wait.tier} />
                      {summary.wait.short}
                    </span>
                  {:else}
                    <span data-part="wait">Last report</span>
                  {/if}
                  <span data-part="age">{summary.age}</span>
                {/if}
              </span>
            {/each}
          </span>
        </a>
      {/each}
    </nav>
  {/if}
</map-frame>

<style>
  map-frame {
    position: relative;
    display: block;
    aspect-ratio: 16 / 10;
    margin-block-end: 0.75rem;
  }

  svg {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    background: color-mix(in srgb, var(--card) 40%, var(--bg));
    border-radius: 1.25rem;
  }

  [data-part='land'] {
    fill: var(--card);
    stroke: var(--line);
    stroke-width: 1.5;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  a {
    position: absolute;
    inline-size: var(--size);
    block-size: var(--size);
    translate: -50% -50%;
    background: var(--card);
    border: 2px solid var(--muted);
    border-radius: 50%;
    transition:
      inline-size 200ms var(--ease-out),
      block-size 200ms var(--ease-out);

    &[data-reported] {
      background: var(--pink);
      border-color: var(--card);
    }

    &[data-active],
    &:focus-visible {
      z-index: 2;
      outline: 3px solid var(--ink);
      outline-offset: 1px;
    }
  }

  [role='tooltip'] {
    position: absolute;
    inset-block-end: calc(100% + 0.5rem);
    inset-inline-start: 50%;
    translate: -50% 0;
    z-index: 3;
    display: none;
    gap: 0.6rem;
    inline-size: max-content;
    max-inline-size: 20rem;
    padding: 0.75rem;
    font-size: 0.8rem;
    line-height: 1.25;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 0.9rem;
    box-shadow: var(--shadow-raised);
    pointer-events: none;

    &[data-below] {
      inset-block: calc(100% + 0.5rem) auto;
    }

    &[data-align='start'] {
      inset-inline-start: 0;
      translate: 0 0;
    }

    &[data-align='end'] {
      inset-inline: auto 0;
      translate: 0 0;
    }

    & strong {
      font-size: 0.95rem;
    }

    & em {
      font-style: normal;
      font-weight: var(--weight-heavy);
    }
  }

  a:hover [role='tooltip'],
  a:focus-visible [role='tooltip'] {
    display: grid;
  }

  [data-part='line'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.35rem 1rem;
  }

  [data-part='count'] {
    justify-self: end;
    font-size: 1.15rem;
    font-weight: var(--weight-heavy);
    line-height: 1.1;

    & i {
      font-style: normal;
      color: var(--pink);
    }

    [data-stale] > & {
      color: var(--muted);

      & i {
        color: var(--muted);
      }
    }
  }

  [data-part='wait'] {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: var(--weight-heavy);
    color: var(--muted);
    white-space: nowrap;

    & :global(svg) {
      inline-size: 0.95rem;
      block-size: 0.95rem;
    }

    &[data-tier='go'] {
      color: var(--go);
    }

    &[data-tier='soon'] {
      color: var(--soon);
    }

    &[data-tier='long'] {
      color: var(--long);
    }
  }

  [data-part='empty'] {
    grid-column: 1 / -1;
    color: var(--muted);
  }

  [data-part='age'] {
    justify-self: end;
    color: var(--muted);
    white-space: nowrap;
  }
</style>
