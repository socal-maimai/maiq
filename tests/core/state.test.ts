import { describe, expect, test } from 'bun:test'
import {
  ageState,
  CONFIRM_AFTER_MS,
  freshnessAt,
  FRESH_MS,
  formatAge,
  isConfirmable,
  isTrusted,
  isVerified,
  lineState,
  STALE_MS,
  TRUST_WINDOW_MS,
  type ReportRow,
} from '@maiq/core/state'

const now = new Date('2026-10-02T03:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)
const MINUTE = 60_000
const row = (
  players: number,
  queue: number,
  trusted: boolean,
  ageMs: number,
  verified = false
): ReportRow => ({
  players,
  queue,
  trusted,
  verified,
  createdAt: ago(ageMs),
})

describe('isTrusted', () => {
  test('trusts Discord and in-geofence web reports only', () => {
    expect(isTrusted({ source: 'discord', inGeofence: null })).toBe(true)
    expect(isTrusted({ source: 'web', inGeofence: true })).toBe(true)
    expect(isTrusted({ source: 'web', inGeofence: false })).toBe(false)
    expect(isTrusted({ source: 'web', inGeofence: null })).toBe(false)
  })
})

describe('lineState', () => {
  test('is unknown with no rows', () => {
    expect(lineState('burbank', [], now)).toEqual({
      lineId: 'burbank',
      count: null,
      reportedAt: null,
      freshness: 'unknown',
      verified: false,
    })
  })

  test('uses the newest row regardless of input order', () => {
    const state = lineState('burbank', [row(1, 0, true, 9 * MINUTE), row(2, 3, true, MINUTE)], now)
    expect(state.count).toEqual({ players: 2, queue: 3 })
    expect(state.reportedAt).toEqual(ago(MINUTE))
    expect(state.freshness).toBe('fresh')
  })

  test('an untrusted row cannot replace a trusted row under 10 minutes old', () => {
    const rows = [row(2, 2, true, 5 * MINUTE), row(0, 9, false, MINUTE)]
    expect(lineState('burbank', rows, now).count).toEqual({ players: 2, queue: 2 })
  })

  test('an untrusted row wins once the trusted row is 10 minutes old', () => {
    const rows = [row(2, 2, true, TRUST_WINDOW_MS), row(0, 9, false, MINUTE)]
    expect(lineState('burbank', rows, now).count).toEqual({ players: 0, queue: 9 })
  })

  test('a newer trusted row always wins', () => {
    const rows = [row(2, 2, false, 5 * MINUTE), row(1, 0, true, MINUTE)]
    expect(lineState('burbank', rows, now).count).toEqual({ players: 1, queue: 0 })
  })

  test('is stale from 20 minutes to 3 hours', () => {
    expect(lineState('burbank', [row(1, 0, true, FRESH_MS - 1)], now).freshness).toBe('fresh')
    expect(lineState('burbank', [row(1, 0, true, FRESH_MS)], now).freshness).toBe('stale')
    expect(lineState('burbank', [row(1, 0, true, STALE_MS)], now).freshness).toBe('stale')
  })

  test('drops the count after 3 hours but keeps the report time', () => {
    expect(lineState('burbank', [row(1, 0, true, STALE_MS + 1)], now)).toEqual({
      lineId: 'burbank',
      count: null,
      reportedAt: ago(STALE_MS + 1),
      freshness: 'unknown',
      verified: false,
    })
  })
})

describe('isConfirmable', () => {
  const stateAged = (ageMs: number) => lineState('burbank', [row(2, 1, true, ageMs)], now)

  test('is true from 5 up to 20 minutes', () => {
    expect(isConfirmable(stateAged(CONFIRM_AFTER_MS - 1), now)).toBe(false)
    expect(isConfirmable(stateAged(CONFIRM_AFTER_MS), now)).toBe(true)
    expect(isConfirmable(stateAged(FRESH_MS - 1), now)).toBe(true)
    expect(isConfirmable(stateAged(FRESH_MS), now)).toBe(false)
  })

  test('is false without a count', () => {
    expect(isConfirmable(lineState('burbank', [], now), now)).toBe(false)
  })
})

describe('formatAge', () => {
  test.each([
    [0, 'just now'],
    [59_999, 'just now'],
    [MINUTE, '1 min ago'],
    [59 * MINUTE, '59 min ago'],
    [60 * MINUTE, '1 h ago'],
    [23 * 60 * MINUTE, '23 h ago'],
    [48 * 60 * MINUTE, '2 d ago'],
  ])('formats %p ms as %p', (ms, text) => {
    expect(formatAge(ago(ms), now)).toBe(text)
  })
})

describe('ageState', () => {
  const fresh = lineState('burbank', [row(2, 1, true, MINUTE)], now)

  test('keeps a fresh state fresh', () => {
    expect(ageState(fresh, now)).toEqual(fresh)
  })

  test('fades after 20 minutes and drops the count after 3 hours', () => {
    const later = (ms: number) => new Date(now.getTime() + ms)
    expect(ageState(fresh, later(FRESH_MS)).freshness).toBe('stale')
    expect(ageState(fresh, later(STALE_MS)).count).toBeNull()
    expect(ageState(fresh, later(STALE_MS)).reportedAt).toEqual(fresh.reportedAt)
  })

  test('leaves a state without reports alone', () => {
    const empty = lineState('burbank', [], now)
    expect(ageState(empty, now)).toEqual(empty)
  })

  test('freshnessAt matches the thresholds', () => {
    expect(freshnessAt(ago(FRESH_MS - 1), now)).toBe('fresh')
    expect(freshnessAt(ago(STALE_MS), now)).toBe('stale')
    expect(freshnessAt(ago(STALE_MS + 1), now)).toBe('unknown')
  })
})

describe('verified', () => {
  test('only in-geofence reports are verified', () => {
    expect(isVerified({ inGeofence: true })).toBe(true)
    expect(isVerified({ inGeofence: false })).toBe(false)
    expect(isVerified({ inGeofence: null })).toBe(false)
  })

  test('follows the row that wins, not the newest row', () => {
    const rows = [row(2, 2, true, 4 * MINUTE, true), row(0, 9, false, MINUTE)]
    expect(lineState('burbank', rows, now).verified).toBe(true)
  })

  test('a trusted Discord report is not verified', () => {
    expect(lineState('burbank', [row(1, 0, true, MINUTE)], now).verified).toBe(false)
  })

  test('drops once the count expires', () => {
    expect(lineState('burbank', [row(1, 0, true, STALE_MS + 1, true)], now).verified).toBe(false)
    const fresh = lineState('burbank', [row(1, 0, true, MINUTE, true)], now)
    const later = new Date(now.getTime() + STALE_MS)
    expect(ageState(fresh, later).verified).toBe(false)
  })
})
