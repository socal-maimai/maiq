import { beforeEach, describe, expect, test } from 'bun:test'
import type { ButtonReportInput, ButtonState } from '@maiq/core/button-service'
import { buttonKey, VOTE_TTL_MS, type Side } from '@maiq/core/buttons'
import { createEvents } from '@maiq/api/lib/events'
import {
  BUTTON_COOLDOWN_MS,
  createButtonService,
  MAX_REPORTS_PER_WINDOW,
  REPORT_WINDOW_MS,
} from '@maiq/api/services/buttons'
import { createClock } from 'maiq-tests-api/support/clock'
import { createTestDatabase } from 'maiq-tests-api/support/database'

const MINUTE = 60_000

const report = (overrides: Partial<ButtonReportInput> = {}): ButtonReportInput => ({
  lineId: 'burbank',
  cab: 2,
  side: 1,
  button: 3,
  kind: 'broken',
  description: 'no response at all',
  reporter: 'device:a',
  ...overrides,
})

const nth = (n: number, overrides: Partial<ButtonReportInput> = {}): ButtonReportInput => {
  const side: Side = Math.floor(n / 8) % 2 === 0 ? 1 : 2
  return report({ cab: 1 + Math.floor(n / 16), side, button: 1 + (n % 8), ...overrides })
}

async function makeService() {
  const { db } = await createTestDatabase()
  const clock = createClock()
  const emitted: ButtonState[] = []
  const events = createEvents<ButtonState>(error => {
    throw error
  })
  events.subscribe(state => emitted.push(state))
  return { buttons: createButtonService({ db, events, now: clock.now }), clock, emitted }
}

let setup: Awaited<ReturnType<typeof makeService>>

beforeEach(async () => {
  setup = await makeService()
})

describe('submit', () => {
  test('stores a trimmed report, returns the pending state, and emits it', async () => {
    const result = await setup.buttons.submit(report({ description: '  no response at all  ' }))
    const state: ButtonState = {
      lineId: 'burbank',
      cab: 2,
      side: 1,
      button: 3,
      status: 'pending',
      confirmed: 'good',
      pending: 'broken',
      pendingVotes: 1,
      recent: [{ kind: 'broken', description: 'no response at all', at: setup.clock.now() }],
    }
    expect(result).toEqual({ ok: true, state })
    expect(setup.emitted).toEqual([state])
  })

  test('a second person confirms it', async () => {
    await setup.buttons.submit(report())
    setup.clock.advance(MINUTE)
    const result = await setup.buttons.submit(report({ reporter: 'device:b' }))
    expect(result.ok && [result.state.status, result.state.pending]).toEqual(['broken', null])
  })

  test.each([
    ['an unknown line', { lineId: 'nope' }],
    ['cab 4 of 3', { cab: 4 }],
    ['cab 0', { cab: 0 }],
    ['button 9', { button: 9 }],
  ])('rejects %s without emitting', async (_name, overrides) => {
    expect(await setup.buttons.submit(report(overrides))).toEqual({
      ok: false,
      error: 'unknownButton',
    })
    expect(setup.emitted).toHaveLength(0)
  })

  test('needs a description for a problem but not for works', async () => {
    expect(await setup.buttons.submit(report({ description: '   ' }))).toEqual({
      ok: false,
      error: 'invalidDescription',
      problem: 'required',
    })
    const works = await setup.buttons.submit(report({ kind: 'works', description: '' }))
    expect(works.ok).toBe(true)
  })

  test('rejects a description over 280 characters', async () => {
    expect(await setup.buttons.submit(report({ description: 'a'.repeat(281) }))).toEqual({
      ok: false,
      error: 'invalidDescription',
      problem: 'tooLong',
    })
  })

  test('allows one report per button per 10 minutes', async () => {
    await setup.buttons.submit(report())
    setup.clock.advance(9 * MINUTE)
    expect(await setup.buttons.submit(report({ kind: 'works' }))).toEqual({
      ok: false,
      error: 'buttonCooldown',
      retryAfterMs: BUTTON_COOLDOWN_MS - 9 * MINUTE,
    })
    expect((await setup.buttons.submit(nth(0))).ok).toBe(true)
    setup.clock.advance(MINUTE)
    expect((await setup.buttons.submit(report({ kind: 'works' }))).ok).toBe(true)
  })

  test('allows 30 reports per reporter per 10 minutes', async () => {
    const first = await Promise.all(
      Array.from({ length: MAX_REPORTS_PER_WINDOW }, (_, n) => setup.buttons.submit(nth(n)))
    )
    expect(first.every(result => result.ok)).toBe(true)
    expect(await setup.buttons.submit(nth(40))).toEqual({
      ok: false,
      error: 'tooManyReports',
      retryAfterMs: REPORT_WINDOW_MS,
    })
    expect((await setup.buttons.submit(nth(40, { reporter: 'device:b' }))).ok).toBe(true)
    setup.clock.advance(REPORT_WINDOW_MS)
    expect((await setup.buttons.submit(nth(40))).ok).toBe(true)
  })

  test('accepts exactly one of several simultaneous reports on one button', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => setup.buttons.submit(report()))
    )
    expect(results.filter(r => r.ok)).toHaveLength(1)
    expect(results.filter(r => !r.ok && r.error === 'buttonCooldown')).toHaveLength(4)
  })

  test('holds the window limit under simultaneous reports', async () => {
    const results = await Promise.all(
      Array.from({ length: MAX_REPORTS_PER_WINDOW + 5 }, (_, n) => setup.buttons.submit(nth(n)))
    )
    expect(results.filter(r => r.ok)).toHaveLength(MAX_REPORTS_PER_WINDOW)
    expect(results.filter(r => !r.ok && r.error === 'tooManyReports')).toHaveLength(5)
  })
})

describe('buttonStates', () => {
  test('lists reported buttons in line, cab, side, and button order', async () => {
    await setup.buttons.submit(report({ lineId: 'lakewood:cuck', cab: 1, side: 1, button: 1 }))
    await setup.buttons.submit(report({ cab: 2, side: 1, button: 3 }))
    await setup.buttons.submit(report({ cab: 1, side: 2, button: 8 }))
    await setup.buttons.submit(report({ cab: 1, side: 1, button: 8 }))
    const all = await setup.buttons.buttonStates()
    expect(all.map(buttonKey)).toEqual([
      'burbank/1/1/8',
      'burbank/1/2/8',
      'burbank/2/1/3',
      'lakewood:cuck/1/1/1',
    ])
    const lakewood = await setup.buttons.buttonStates(['lakewood:main', 'lakewood:cuck'])
    expect(lakewood.map(buttonKey)).toEqual(['lakewood:cuck/1/1/1'])
  })

  test('keeps the 4 newest reports, newest first', async () => {
    for (const n of [1, 2, 3, 4, 5]) {
      // oxlint-disable-next-line no-await-in-loop -- each report needs its own later timestamp
      await setup.buttons.submit(report({ reporter: `device:${n}`, description: `r${n}` }))
      setup.clock.advance(MINUTE)
    }
    const [state] = await setup.buttons.buttonStates(['burbank'])
    expect(state?.recent.map(r => r.description)).toEqual(['r5', 'r4', 'r3', 'r2'])
  })

  test('an unconfirmed report stops counting after 7 days but stays in the history', async () => {
    await setup.buttons.submit(report())
    setup.clock.advance(VOTE_TTL_MS)
    const [state] = await setup.buttons.buttonStates(['burbank'])
    expect(state?.status).toBe('good')
    expect(state?.recent).toHaveLength(1)
  })
})
