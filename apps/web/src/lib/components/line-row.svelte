<script lang="ts">
  import type { Line } from '@maiq/core/arcades'
  import { formatCount } from '@maiq/core/count'
  import { playableSeats, rotation } from '@maiq/core/rotation'
  import { formatAge, type LineState } from '@maiq/core/state'
  import { untrack } from 'svelte'
  import { clock } from '$lib/clock.svelte'
  import CabPill from '$lib/components/cab-pill.svelte'
  import HourglassIcon from '$lib/components/hourglass-icon.svelte'
  import VerifiedBadge from '$lib/components/verified-badge.svelte'

  type Props = {
    line: Line
    state: LineState | undefined
    down: number
    atArcade: boolean
    grouped: boolean
  }

  let { line, state: lineState, down, atArcade, grouped }: Props = $props()

  const count = $derived(lineState?.count ?? null)
  const shown = $derived(count ? formatCount(count) : null)
  const seats = $derived(playableSeats(line, down))
  const wait = $derived(count ? rotation(count.players, count.queue, seats, atArcade) : null)
  const waitShort = $derived(wait?.short ?? '')
  const reportedAt = $derived(lineState?.reportedAt ?? null)

  const firstShown = untrack(() => shown)
  const bump = $derived(shown !== null && shown !== firstShown)
</script>

<line-row
  data-layout={grouped ? 'grouped' : 'single'}
  data-freshness={lineState?.freshness ?? 'unknown'}
>
  {#if grouped}
    <line-name>
      <span>{line.label}</span>
      <CabPill cabs={line.cabs} />
    </line-name>
  {/if}
  {#key shown}
    <line-count
      role="img"
      aria-label={count ? `${count.players} playing, ${count.queue} queueing` : 'Unknown'}
      data-wide={count && count.queue >= 10 ? '' : undefined}
      data-unknown={count ? undefined : ''}
      data-bump={bump ? '' : undefined}
    >
      {#if count}
        {count.players}<small>p</small>{count.queue}<small>q</small>
      {:else}
        ?
      {/if}
    </line-count>
  {/key}
  <line-footer>
    {#if wait}
      <wait-line data-tier={wait.tier} role="img" aria-label={wait.text} title={wait.text}>
        <HourglassIcon tier={wait.tier} />
        <span>{waitShort}</span>
      </wait-line>
    {:else}
      <wait-line></wait-line>
    {/if}
    {#if reportedAt}
      <time datetime={reportedAt.toISOString()}>{formatAge(reportedAt, clock.now)}</time>
    {:else}
      <span data-part="age">no updates</span>
    {/if}
  </line-footer>
  {#if lineState?.verified}
    <VerifiedBadge />
  {/if}
</line-row>

<style>
  line-row[data-layout='single'] {
    display: contents;

    & line-count {
      grid-column: 2;
      grid-row: 1 / span 2;
    }

    & line-footer {
      grid-column: 1 / -1;
      grid-row: 3;
      margin-block-start: 0.625rem;
      justify-content: space-between;
    }
  }

  line-row[data-layout='grouped'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    column-gap: 0.875rem;
    row-gap: 0.25rem;
    padding: 0.75rem;
    background: var(--bg);
    border-radius: 0.875rem;

    & line-count {
      grid-column: 2;
      grid-row: 1 / span 2;
      align-self: center;
      margin-block-start: 0;
      font-size: 1.625rem;

      & small {
        font-size: 1.375rem;
      }

      &[data-wide] {
        font-size: 1.3rem;

        & small {
          font-size: 1.05rem;
        }
      }
    }

    & line-footer {
      grid-column: 1;
      grid-row: 2;
      justify-content: flex-start;
    }

  }

  line-name {
    display: flex;
    grid-column: 1;
    grid-row: 1;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.875rem;
    font-weight: var(--weight-heavy);

    & > span {
      line-height: 1.2;
    }
  }

  line-count {
    display: block;
    align-self: start;
    justify-self: end;
    margin-block-start: -0.06em;
    font-size: 2rem;
    font-weight: var(--weight-heavy);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;

    & small {
      margin: 0 0.2rem 0 0.05rem;
      font-size: 1.7rem;
      color: var(--pink);
    }

    &[data-wide] {
      font-size: 1.6rem;

      & small {
        font-size: 1.3rem;
      }
    }

    &[data-unknown] {
      color: var(--muted);
    }
  }

  line-row[data-freshness='stale'] {
    & line-count,
    & line-count small,
    & wait-line {
      color: var(--muted);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    line-count[data-bump] {
      animation: m-bump 360ms var(--ease-out);
    }
  }

  line-footer {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    min-inline-size: 0;
    font-size: 0.85rem;
    line-height: 1.2;
  }

  wait-line {
    display: inline-block;
    min-inline-size: 0;
    padding-block-end: 0.35em;
    margin-block-end: -0.35em;
    overflow: hidden;
    font-weight: var(--weight-heavy);
    text-overflow: ellipsis;
    white-space: nowrap;

    &:empty {
      visibility: hidden;
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

  line-row[data-layout='grouped'] {
    position: relative;
  }

  time,
  [data-part='age'] {
    flex: none;
    color: var(--muted);
    white-space: nowrap;
  }
</style>
