<script lang="ts">
  import { goto } from '$app/navigation'
  import { arcadesIn, REGIONS } from '@maiq/core/arcades'
  import { ageState } from '@maiq/core/state'
  import { fromLineStateJson } from '@maiq/types'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { onMount } from 'svelte'
  import { clock } from '$lib/clock.svelte'
  import CaliforniaMap from '$lib/components/california-map.svelte'
  import { linesQuery } from '$lib/query'
  import { grantedPosition, regionNear } from '$lib/region'
  import { subscribeToUpdates } from '$lib/stream'

  type Props = { findRegion: boolean }

  let { findRegion }: Props = $props()

  const queryClient = useQueryClient()
  const lines = createQuery(() => linesQuery)

  const states = $derived(
    new Map(
      (lines.data ?? []).map(json => [json.lineId, ageState(fromLineStateJson(json), clock.now)])
    )
  )

  const regions = $derived(
    REGIONS.map(region => {
      const arcades = arcadesIn(region.id)
      return {
        region,
        arcades: arcades.length,
        fresh: arcades.filter(arcade =>
          arcade.lines.some(line => states.get(line.id)?.freshness === 'fresh')
        ).length,
      }
    })
  )

  onMount(() => {
    const stops = [clock.start(), subscribeToUpdates(queryClient, () => {})]
    if (findRegion) {
      void grantedPosition().then(point => {
        if (point) void goto(`/${regionNear(point)}`, { replaceState: true })
      })
    }
    return () => {
      for (const stop of stops) stop()
    }
  })
</script>

<svelte:head>
  <title>maiq</title>
</svelte:head>

<page-shell>
  <header>
    <h1>maimai queues</h1>
    <p>Live queues at California arcades. Pick your region!</p>
  </header>

  <CaliforniaMap {states} />

  <ul>
    {#each regions as { region, arcades, fresh } (region.id)}
      <li>
        <a href="/{region.id}" aria-label="{region.fullName}, {arcades} arcades, {fresh} live">
          <strong>{region.name}</strong>
          <span>{arcades} arcades</span>
          {#if fresh > 0}<span data-fresh>{fresh} live</span>{/if}
        </a>
      </li>
    {/each}
  </ul>
</page-shell>

<style>
  page-shell {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 34rem;
    margin-inline: auto;
    padding: 2rem 1.25rem 3rem;
  }

  header {
    display: grid;
    gap: 0.35rem;

    & h1 {
      margin: 0;
      font-size: 2rem;
    }

    & p {
      margin: 0;
      color: var(--muted);
    }
  }

  ul {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  a {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.75rem;
    padding: 1rem 1.1rem;
    color: var(--ink);
    text-decoration: none;
    background: var(--card);
    border-radius: 1.25rem;

    &:hover strong {
      color: var(--pink);
    }

    & strong {
      font-size: 1.3rem;
    }

    & span {
      font-size: 0.9rem;
      color: var(--muted);
    }

    & [data-fresh] {
      margin-inline-start: auto;
      font-weight: var(--weight-heavy);
      color: var(--pink);
    }
  }
</style>
