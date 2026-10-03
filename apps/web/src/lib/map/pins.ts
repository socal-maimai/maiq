import type { Arcade } from '@maiq/core/arcades'
import { maxPlayers } from '@maiq/core/caps'
import { rotation, type WaitTier } from '@maiq/core/rotation'
import type { LineState } from '@maiq/core/state'
import { CALIFORNIA_BOUNDS } from '$lib/map/california'
import { project } from '$lib/map/projection'

const TIER_RANK: Record<WaitTier, number> = { go: 0, soon: 1, long: 2 }

export type MapPoint = { x: number; y: number }

export function toMap(arcade: Arcade): MapPoint {
  const { x, y } = project(arcade.location)
  return { x: x - CALIFORNIA_BOUNDS.x, y: y - CALIFORNIA_BOUNDS.y }
}

export function bestTier(arcade: Arcade, states: ReadonlyMap<string, LineState>): WaitTier | null {
  let best: WaitTier | null = null
  for (const line of arcade.lines) {
    const state = states.get(line.id)
    if (!state?.count || state.freshness !== 'fresh') continue
    const { tier } = rotation(state.count.players, state.count.queue, maxPlayers(line), false)
    if (best === null || TIER_RANK[tier] < TIER_RANK[best]) best = tier
  }
  return best
}
