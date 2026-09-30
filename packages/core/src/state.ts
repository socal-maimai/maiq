import type { Count } from '@maiq/core/count'

const MINUTE_MS = 60_000

export const FRESH_MS = 20 * MINUTE_MS
export const STALE_MS = 3 * 60 * MINUTE_MS
export const TRUST_WINDOW_MS = 10 * MINUTE_MS
export const CONFIRM_AFTER_MS = 5 * MINUTE_MS

export type Freshness = 'fresh' | 'stale' | 'unknown'
export type ReportSource = 'web' | 'discord'

export type ReportRow = {
  players: number
  queue: number
  trusted: boolean
  verified: boolean
  createdAt: Date
}

export type LineState = {
  lineId: string
  count: Count | null
  reportedAt: Date | null
  freshness: Freshness
  verified: boolean
}

export const isVerified = (row: { inGeofence: boolean | null }): boolean => row.inGeofence === true

export const isTrusted = (row: { source: ReportSource; inGeofence: boolean | null }): boolean =>
  row.source === 'discord' || isVerified(row)

function pickWinner(rows: readonly ReportRow[], now: Date): ReportRow | undefined {
  const newestFirst = rows.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const [newest] = newestFirst
  if (!newest || newest.trusted) return newest
  const recentTrusted = newestFirst.find(
    row => row.trusted && now.getTime() - row.createdAt.getTime() < TRUST_WINDOW_MS
  )
  return recentTrusted ?? newest
}

export function freshnessAt(reportedAt: Date, now: Date): Freshness {
  const age = now.getTime() - reportedAt.getTime()
  if (age < FRESH_MS) return 'fresh'
  return age <= STALE_MS ? 'stale' : 'unknown'
}

export function lineState(lineId: string, rows: readonly ReportRow[], now: Date): LineState {
  const winner = pickWinner(rows, now)
  if (!winner) {
    return { lineId, count: null, reportedAt: null, freshness: 'unknown', verified: false }
  }
  const freshness = freshnessAt(winner.createdAt, now)
  const known = freshness !== 'unknown'
  return {
    lineId,
    count: known ? { players: winner.players, queue: winner.queue } : null,
    reportedAt: winner.createdAt,
    freshness,
    verified: known && winner.verified,
  }
}

export function ageState(state: LineState, now: Date): LineState {
  if (!state.reportedAt) return state
  const freshness = freshnessAt(state.reportedAt, now)
  const known = freshness !== 'unknown'
  return {
    ...state,
    count: known ? state.count : null,
    freshness,
    verified: known && state.verified,
  }
}

export function isConfirmable(state: LineState, now: Date): boolean {
  if (!state.count || !state.reportedAt) return false
  const age = now.getTime() - state.reportedAt.getTime()
  return age >= CONFIRM_AFTER_MS && age < FRESH_MS
}

export function formatAge(reportedAt: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - reportedAt.getTime()) / MINUTE_MS)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}
