import { beforeEach, describe, expect, test } from 'bun:test'
import { LINE_IDS } from '@maiq/core/arcades'
import type { ReportInput } from '@maiq/core/queue'
import type { LineState } from '@maiq/core/state'
import { createEvents } from '@maiq/api/lib/events'
import {
  CONFIRM_COOLDOWN_MS,
  createQueueService,
  REPORT_COOLDOWN_MS,
} from '@maiq/api/services/queue'
import { createClock } from 'maiq-tests-api/support/clock'
import { createTestDatabase } from 'maiq-tests-api/support/database'

const MINUTE = 60_000

const report = (overrides: Partial<ReportInput> = {}): ReportInput => ({
  lineId: 'burbank',
  count: { players: 2, queue: 1 },
  source: 'web',
  reporter: 'device:a',
  inGeofence: true,
  ...overrides,
})

async function makeService() {
  const { db } = await createTestDatabase()
  const clock = createClock()
  const emitted: LineState[] = []
  const events = createEvents<LineState>(error => {
    throw error
  })
  events.subscribe(state => emitted.push(state))
  return { queue: createQueueService({ db, events, now: clock.now }), clock, emitted }
}

let setup: Awaited<ReturnType<typeof makeService>>

beforeEach(async () => {
  setup = await makeService()
})

describe('submitReport', () => {
  test('stores a report, returns the new state, and emits it', async () => {
    const result = await setup.queue.submitReport(report())
    expect(result).toEqual({
      ok: true,
      state: {
        lineId: 'burbank',
        count: { players: 2, queue: 1 },
        reportedAt: setup.clock.now(),
        freshness: 'fresh',
        verified: true,
      },
    })
    expect(setup.emitted).toHaveLength(1)
  })

  test('rejects an unknown line without emitting', async () => {
    expect(await setup.queue.submitReport(report({ lineId: 'nope' }))).toEqual({
      ok: false,
      error: 'unknownLine',
    })
    expect(setup.emitted).toHaveLength(0)
  })

  test('rejects more players than seats', async () => {
    const result = await setup.queue.submitReport(
      report({ lineId: '2nd-loop', count: { players: 3, queue: 0 } })
    )
    expect(result).toEqual({ ok: false, error: 'playersOverCap', maxPlayers: 2 })
  })

  test('rejects a queue over 40', async () => {
    const result = await setup.queue.submitReport(report({ count: { players: 0, queue: 41 } }))
    expect(result).toEqual({ ok: false, error: 'queueOverCap', maxQueue: 40 })
  })

  test('rate limits one reporter on one line for 60 seconds', async () => {
    await setup.queue.submitReport(report())
    setup.clock.advance(30_000)
    expect(await setup.queue.submitReport(report())).toEqual({
      ok: false,
      error: 'rateLimited',
      retryAfterMs: REPORT_COOLDOWN_MS - 30_000,
    })
    setup.clock.advance(30_000)
    expect((await setup.queue.submitReport(report())).ok).toBe(true)
  })

  test('does not rate limit other reporters or other lines', async () => {
    await setup.queue.submitReport(report())
    expect((await setup.queue.submitReport(report({ reporter: 'device:b' }))).ok).toBe(true)
    expect((await setup.queue.submitReport(report({ lineId: 'temecula' }))).ok).toBe(true)
  })

  test('accepts exactly one of several simultaneous reports from one reporter', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => setup.queue.submitReport(report()))
    )
    expect(results.filter(r => r.ok)).toHaveLength(1)
    expect(results.filter(r => !r.ok && r.error === 'rateLimited')).toHaveLength(4)
  })

  test('a remote report does not replace an in-geofence report under 10 minutes old', async () => {
    await setup.queue.submitReport(report())
    setup.clock.advance(2 * MINUTE)
    const result = await setup.queue.submitReport(
      report({ reporter: 'device:b', inGeofence: false, count: { players: 0, queue: 9 } })
    )
    expect(result.ok && result.state.count).toEqual({ players: 2, queue: 1 })
  })
})

describe('confirm', () => {
  test('needs a current count', async () => {
    expect(
      await setup.queue.confirm({
        lineId: 'burbank',
        source: 'web',
        reporter: 'device:b',
        inGeofence: true,
      })
    ).toEqual({ ok: false, error: 'nothingToConfirm' })
  })

  test('copies the count and refreshes the time', async () => {
    await setup.queue.submitReport(report())
    setup.clock.advance(6 * MINUTE)
    const result = await setup.queue.confirm({
      lineId: 'burbank',
      source: 'discord',
      reporter: 'discord:1',
      inGeofence: null,
    })
    expect(result).toEqual({
      ok: true,
      state: {
        lineId: 'burbank',
        count: { players: 2, queue: 1 },
        reportedAt: setup.clock.now(),
        freshness: 'fresh',
        verified: false,
      },
    })
    expect(setup.emitted).toHaveLength(2)
  })

  test('rate limits confirms for 5 minutes', async () => {
    await setup.queue.submitReport(report())
    const confirm = {
      lineId: 'burbank',
      source: 'web' as const,
      reporter: 'device:b',
      inGeofence: true,
    }
    await setup.queue.confirm(confirm)
    setup.clock.advance(MINUTE)
    expect(await setup.queue.confirm(confirm)).toEqual({
      ok: false,
      error: 'rateLimited',
      retryAfterMs: CONFIRM_COOLDOWN_MS - MINUTE,
    })
  })
})

describe('lineStates', () => {
  test('returns every line in order by default', async () => {
    const states = await setup.queue.lineStates()
    expect(states.map(s => s.lineId)).toEqual([...LINE_IDS])
    expect(states.every(s => s.freshness === 'unknown')).toBe(true)
  })

  test('keeps the last report time after the count expires', async () => {
    await setup.queue.submitReport(report())
    const reportedAt = setup.clock.now()
    setup.clock.advance(4 * 60 * MINUTE)
    const [state] = await setup.queue.lineStates(['burbank'])
    expect(state).toEqual({
      lineId: 'burbank',
      count: null,
      reportedAt,
      freshness: 'unknown',
      verified: false,
    })
  })
})
