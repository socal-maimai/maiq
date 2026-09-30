<script lang="ts">
  import { findArcade } from '@maiq/core/arcades'
  import { ageState, isConfirmable } from '@maiq/core/state'
  import { fromLineStateJson, type ButtonStateJson } from '@maiq/types'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { onMount } from 'svelte'
  import type { Attachment } from 'svelte/attachments'
  import { hintForError } from '$lib/api-error'
  import { clock } from '$lib/clock.svelte'
  import ArcadeList from '$lib/components/arcade-list.svelte'
  import CabinetSheet from '$lib/components/cabinet-sheet.svelte'
  import ConfirmPrompt from '$lib/components/confirm-prompt.svelte'
  import OriginHeader from '$lib/components/origin-header.svelte'
  import ReportSheet from '$lib/components/report-sheet.svelte'
  import { buttonsQuery, linesQuery } from '$lib/query'
  import { subscribeToUpdates } from '$lib/stream'
  import { ACTION_BAR_HEIGHT } from '$lib/toast'
  import { viewer } from '$lib/viewer.svelte'

  const NO_BUTTONS: readonly ButtonStateJson[] = []

  const queryClient = useQueryClient()
  const lines = createQuery(() => linesQuery)
  const buttons = createQuery(() => buttonsQuery)

  let live = $state(true)
  let sheet = $state<ReturnType<typeof ReportSheet> | null>(null)
  let cabinets = $state<ReturnType<typeof CabinetSheet> | null>(null)

  const buttonStates = $derived(buttons.data ?? NO_BUTTONS)
  const hereArcade = $derived(viewer.hereArcadeId ? findArcade(viewer.hereArcadeId) : undefined)
  const confirmable = $derived.by(() => {
    const data = lines.data
    if (!hereArcade || !data) return null
    const candidates = hereArcade.lines.flatMap(line => {
      const json = data.find(s => s.lineId === line.id)
      if (!json) return []
      const state = ageState(fromLineStateJson(json), clock.now)
      return state.count && isConfirmable(state, clock.now)
        ? [{ line, count: state.count, at: state.reportedAt?.getTime() ?? 0 }]
        : []
    })
    return candidates.toSorted((a, b) => b.at - a.at)[0] ?? null
  })

  const publishHeight: Attachment<HTMLElement> = node => {
    const root = document.documentElement
    const observer = new ResizeObserver(() => {
      root.style.setProperty(ACTION_BAR_HEIGHT, `${node.offsetHeight}px`)
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      root.style.removeProperty(ACTION_BAR_HEIGHT)
    }
  }

  onMount(() => {
    const stops = [
      viewer.watch(),
      clock.start(),
      subscribeToUpdates(queryClient, next => (live = next)),
    ]
    return () => {
      for (const stop of stops) stop()
    }
  })
</script>

{#snippet retry()}
  <button
    type="button"
    data-variant="ghost"
    data-touch
    disabled={lines.isFetching}
    aria-busy={lines.isFetching}
    onclick={() => void lines.refetch()}
  >
    <span>Retry</span>
    {#if lines.isFetching}<busy-ring aria-hidden="true"></busy-ring>{/if}
  </button>
{/snippet}

<page-shell data-prompt={confirmable ? '' : undefined}>
  <OriginHeader />
  <main>
    <stream-note role="status">{live ? '' : 'Reconnecting…'}</stream-note>
    {#if lines.data}
      {#if lines.isError}
        <load-note role="status">
          <span>Could not refresh the queues. Showing the last update.</span>
          {@render retry()}
        </load-note>
      {/if}
      <ArcadeList
        lines={lines.data}
        buttons={buttonStates}
        onOpenButtons={arcadeId => cabinets?.show(arcadeId)}
      />
    {:else if lines.isError}
      <load-note role="alert" data-blocking>
        <span>Could not load the queues. {hintForError(lines.error)}</span>
        {@render retry()}
      </load-note>
    {:else}
      <load-note role="status" data-blocking>Loading queues…</load-note>
    {/if}
  </main>
  <action-bar aria-live="polite" {@attach publishHeight}>
    {#if confirmable}
      {@const { line, count } = confirmable}
      {#key line.id}
        <ConfirmPrompt {line} {count} onUpdate={() => sheet?.show(line.id)} />
      {/key}
    {/if}
    <button type="button" data-variant="primary" onclick={() => sheet?.show()}>
      Update a queue
    </button>
  </action-bar>
</page-shell>

<ReportSheet bind:this={sheet} />
<CabinetSheet bind:this={cabinets} buttons={buttonStates} />

<style>
  page-shell {
    display: block;
    max-inline-size: 34rem;
    margin-inline: auto;
    padding: 2rem 1.25rem 8rem;

    &[data-prompt] {
      padding-block-end: 16rem;
    }
  }

  stream-note {
    display: block;
    margin-block-end: 0.75rem;
    font-size: 0.85rem;
    color: var(--muted);

    &:empty {
      margin-block-end: 0;
    }
  }

  load-note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem 0.75rem;
    margin-block-end: 0.75rem;
    font-size: 0.85rem;
    color: var(--muted);

    &[data-blocking] {
      margin-block-end: 0;
      padding: 0.9rem 1.1rem;
      font-size: 1rem;
      background: var(--card);
      border-radius: 1rem;
    }

    & button {
      padding: 0.35rem 0.8rem;
      font-weight: var(--weight-heavy);
      color: var(--ink);
      background: var(--bg);
      border: 0;
      border-radius: var(--radius-pill);
    }
  }

  load-note:not([data-blocking]) button {
    background: var(--card);
  }

  action-bar {
    position: fixed;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: var(--layer-bar);
    display: grid;
    gap: 0.85rem;
    inline-size: min(31.5rem, calc(100% - 2.5rem));
    margin-inline: auto;
    padding-block-end: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    pointer-events: none;

    > :global(*) {
      pointer-events: auto;
    }

    > button {
      padding: 0.9rem 1.5rem;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    action-bar > button:active {
      transform: scale(0.98);
    }
  }
</style>
