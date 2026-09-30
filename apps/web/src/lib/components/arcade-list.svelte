<script lang="ts">
  import { findLine, sortByDistance, sortByRecent } from '@maiq/core/arcades'
  import { downSides, isStation, summarizeIssues } from '@maiq/core/buttons'
  import { ageState } from '@maiq/core/state'
  import { fromLineStateJson, type ButtonStateJson, type LineStateJson } from '@maiq/types'
  import { clock } from '$lib/clock.svelte'
  import ArcadeCard from '$lib/components/arcade-card.svelte'
  import { viewer } from '$lib/viewer.svelte'

  type Props = {
    lines: readonly LineStateJson[]
    buttons: readonly ButtonStateJson[]
    onOpenButtons: (arcadeId: string) => void
  }

  let { lines, buttons, onOpenButtons }: Props = $props()

  const states = $derived(
    new Map(lines.map(json => [json.lineId, ageState(fromLineStateJson(json), clock.now)]))
  )

  const lastReported = $derived.by(() => {
    const byArcade = new Map<string, number>()
    for (const json of lines) {
      const arcadeId = findLine(json.lineId)?.arcadeId
      if (!arcadeId || json.reportedAt === null) continue
      byArcade.set(arcadeId, Math.max(byArcade.get(arcadeId) ?? 0, json.reportedAt))
    }
    return byArcade
  })

  const issues = $derived.by(() => {
    const statuses = new Map<string, ButtonStateJson[]>()
    for (const button of buttons) {
      const arcadeId = findLine(button.lineId)?.arcadeId
      if (!arcadeId) continue
      statuses.set(arcadeId, [...(statuses.get(arcadeId) ?? []), button])
    }
    return new Map([...statuses].map(([arcadeId, list]) => [arcadeId, summarizeIssues(list)]))
  })

  const downs = $derived.by(() => {
    const lineIds = new Set(buttons.filter(isStation).map(button => button.lineId))
    return new Map([...lineIds].map(lineId => [lineId, downSides(buttons, lineId)]))
  })

  const origin = $derived(viewer.origin)
  const arcades = $derived(
    origin.kind === 'none' ? sortByRecent(lastReported) : sortByDistance(origin.point)
  )
</script>

<ol>
  {#each arcades as arcade (arcade.id)}
    <li>
      <ArcadeCard
        {arcade}
        {states}
        distanceFrom={origin.kind === 'none' ? null : origin.point}
        here={viewer.hereArcadeId === arcade.id}
        issues={issues.get(arcade.id)}
        {downs}
        onOpenButtons={() => onOpenButtons(arcade.id)}
      />
    </li>
  {/each}
</ol>

<style>
  ol {
    display: grid;
    gap: 0.75rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    li {
      animation: m-rise 380ms var(--ease-out) both;
      animation-delay: 240ms;
    }

    li:nth-child(1) {
      animation-delay: 0ms;
    }

    li:nth-child(2) {
      animation-delay: 30ms;
    }

    li:nth-child(3) {
      animation-delay: 60ms;
    }

    li:nth-child(4) {
      animation-delay: 90ms;
    }

    li:nth-child(5) {
      animation-delay: 120ms;
    }

    li:nth-child(6) {
      animation-delay: 150ms;
    }

    li:nth-child(7) {
      animation-delay: 180ms;
    }

    li:nth-child(8) {
      animation-delay: 210ms;
    }

    li:nth-child(9) {
      animation-delay: 240ms;
    }
  }
</style>
