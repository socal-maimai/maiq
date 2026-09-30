<script lang="ts">
  import type { Arcade } from '@maiq/core/arcades'
  import { issueText, type IssueSummary } from '@maiq/core/buttons'
  import { distanceMiles, formatMiles, type Point } from '@maiq/core/geo'
  import type { LineState } from '@maiq/core/state'
  import CabPill from '$lib/components/cab-pill.svelte'
  import IssuePill from '$lib/components/issue-pill.svelte'
  import LineRow from '$lib/components/line-row.svelte'
  import PinIcon from '$lib/components/pin-icon.svelte'

  type Props = {
    arcade: Arcade
    states: ReadonlyMap<string, LineState>
    downs: ReadonlyMap<string, number>
    distanceFrom: Point | null
    here: boolean
    issues: IssueSummary | undefined
    onOpenButtons: () => void
  }

  let { arcade, states, downs, distanceFrom, here, issues, onOpenButtons }: Props = $props()

  const cabs = $derived(arcade.lines.reduce((sum, line) => sum + line.cabs, 0))
  const place = $derived(
    distanceFrom
      ? `${formatMiles(distanceMiles(distanceFrom, arcade.location))}, ${arcade.city}`
      : arcade.city
  )
  const statusLabel = $derived(
    `${cabs} ${cabs === 1 ? 'cabinet' : 'cabinets'}. Button status: ${
      issues?.worst ? issueText(issues) : 'all good'
    }`
  )
  const grouped = $derived(arcade.lines.length > 1)
</script>

<article data-layout={grouped ? 'grouped' : 'single'}>
  <card-heading>
    <h2>{arcade.name}</h2>
    <p>
      {#if here}
        <here-pin>
          <PinIcon />
          Here
        </here-pin>
      {:else}
        <span>{place}</span>
      {/if}
      <button type="button" aria-label={statusLabel} onclick={onOpenButtons}>
        <CabPill {cabs} />
        {#if issues?.worst}
          <IssuePill worst={issues.worst} total={issues.total} label={issueText(issues)} />
        {/if}
      </button>
    </p>
  </card-heading>
  {#snippet rows()}
    {#each arcade.lines as line (line.id)}
      <LineRow
        {line}
        state={states.get(line.id)}
        down={downs.get(line.id) ?? 0}
        atArcade={here}
        {grouped}
      />
    {/each}
  {/snippet}
  {#if grouped}
    <card-lines>{@render rows()}</card-lines>
  {:else}
    {@render rows()}
  {/if}
</article>

<style>
  article {
    position: relative;
    padding: 1rem;
    background: var(--card);
    border-radius: 1.25rem;
    cursor: pointer;
    transition: box-shadow 120ms;

    &:has(p > button:focus-visible) {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }

    &[data-layout='single'] {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      column-gap: 0.875rem;
    }

    &[data-layout='grouped'] {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
  }

  card-heading {
    display: grid;
    min-inline-size: 0;
    gap: 0.25rem;

    [data-layout='single'] > & {
      display: contents;
    }
  }

  h2 {
    grid-column: 1;
    grid-row: 1;
    margin-block-end: 0.25rem;
    overflow: hidden;
    font-size: 1.0625rem;
    line-height: 1.25;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  p {
    display: flex;
    grid-column: 1;
    grid-row: 2;
    align-items: center;
    gap: 0.35rem;
    min-inline-size: 0;
    min-block-size: 1.4rem;
    font-size: 0.8125rem;
    color: var(--muted);

    & > span {
      flex: 0 1 auto;
      min-inline-size: 2.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  p > button {
    position: static;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.35rem;
    padding: 0;
    background: none;
    border: 0;
    border-radius: var(--radius-pill);
    outline: none;

    &::after {
      position: absolute;
      inset: 0;
      content: '';
      border-radius: 1.25rem;
    }

    &:active {
      transform: none;
    }
  }

  @media (hover: hover) {
    article:has(p > button:hover) {
      box-shadow: 0 0 0 2px var(--line);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    article {
      transition:
        box-shadow 120ms,
        transform 160ms var(--ease-out);

      &:has(p > button:active) {
        transform: scale(0.99);
      }
    }

    @media (hover: hover) {
      article:has(p > button:hover:not(:active)) {
        transform: translateY(-2px);
      }
    }
  }

  here-pin {
    display: inline-block;
    flex: none;
    font-weight: var(--weight-heavy);
    color: var(--pink);
    white-space: nowrap;

    & :global(svg) {
      display: inline-block;
      inline-size: 1.5cap;
      block-size: 1.5cap;
      margin-inline-end: 0.3rem;
      vertical-align: calc((1cap - 1.5cap) / 2);
    }
  }

  card-lines {
    display: grid;
    gap: 0.5rem;
  }

  @media (max-width: 370px) {
    p,
    p > button {
      gap: 0.25rem;
    }

    p > span {
      min-inline-size: 2.6rem;
    }
  }
</style>
