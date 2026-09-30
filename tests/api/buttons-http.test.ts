import { describe, expect, test } from 'bun:test'
import type { ButtonStateJson } from '@maiq/types'
import {
  createTestApp,
  DEVICE_ID,
  OTHER_DEVICE_ID,
  PASSING_TOKEN,
  postJson,
} from 'maiq-tests-api/support/app'

type Envelope = { kind: string; message: string; data?: Record<string, unknown> }
const json = async (res: Response) => (await res.json()) as Envelope

const buttonBody = (overrides: Record<string, unknown> = {}) => ({
  lineId: 'burbank',
  cab: 2,
  side: 1,
  button: 3,
  kind: 'broken',
  description: 'dead',
  deviceId: DEVICE_ID,
  turnstileToken: PASSING_TOKEN,
  ...overrides,
})

const report = (
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
  overrides: Record<string, unknown> = {}
) => postJson(app, '/api/v1/button-reports', buttonBody(overrides))

describe('GET /api/v1/buttons', () => {
  test('is empty before any report', async () => {
    const { app } = await createTestApp()
    const res = await app.request('/api/v1/buttons')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      kind: 'goodButtons',
      message: 'Current button status.',
      data: { buttons: [] },
    })
  })

  test('lists reported buttons and filters by arcade', async () => {
    const { app } = await createTestApp()
    await report(app)
    const all = await json(await app.request('/api/v1/buttons'))
    const buttons = all.data?.['buttons'] as ButtonStateJson[]
    expect(buttons.map(b => [b.lineId, b.cab, b.side, b.button, b.status])).toEqual([
      ['burbank', 2, 1, 3, 'pending'],
    ])
    const lakewood = await json(await app.request('/api/v1/buttons?arcadeId=lakewood'))
    expect(lakewood.data).toEqual({ buttons: [] })
  })

  test('rejects an unknown arcade', async () => {
    const { app } = await createTestApp()
    const res = await app.request('/api/v1/buttons?arcadeId=nope')
    expect(res.status).toBe(404)
    expect((await json(res)).kind).toBe('badUnknownArcade')
  })

  test('validates the query string', async () => {
    const { app } = await createTestApp()
    const res = await app.request('/api/v1/buttons?arcadeId=')
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.kind).toBe('badValidation')
    expect(String(body.data?.['reason'])).toStartWith('query.arcadeId:')
  })
})

describe('POST /api/v1/button-reports', () => {
  test('accepts a report and returns the button', async () => {
    const { app, clock } = await createTestApp()
    const res = await report(app)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      kind: 'goodButtonReport',
      message: 'Thanks for the report.',
      data: {
        button: {
          lineId: 'burbank',
          cab: 2,
          side: 1,
          button: 3,
          status: 'pending',
          confirmed: 'good',
          pending: 'broken',
          pendingVotes: 1,
          recent: [{ kind: 'broken', description: 'dead', at: clock.now().getTime() }],
        },
      },
    })
  })

  test('two devices confirm a status', async () => {
    const { app } = await createTestApp()
    await report(app)
    const body = await json(await report(app, { deviceId: OTHER_DEVICE_ID }))
    const button = body.data?.['button'] as ButtonStateJson | undefined
    expect(button?.status).toBe('broken')
  })

  test('a side report round-trips as button 0', async () => {
    const { app } = await createTestApp()
    await report(app, { button: 0, description: 'screen off' })
    const body = await json(await report(app, { button: 0, deviceId: OTHER_DEVICE_ID }))
    const side = body.data?.['button'] as ButtonStateJson | undefined
    expect([side?.button, side?.status]).toEqual([0, 'broken'])
    const listed = await json(await app.request('/api/v1/buttons?arcadeId=burbank'))
    const buttons = listed.data?.['buttons'] as ButtonStateJson[]
    expect(buttons.map(b => [b.cab, b.side, b.button, b.confirmed])).toEqual([[2, 1, 0, 'broken']])
  })

  test('rejects button 9', async () => {
    const { app } = await createTestApp()
    const res = await report(app, { button: 9 })
    expect(res.status).toBe(400)
    expect((await json(res)).kind).toBe('badValidation')
  })

  test('works fine needs no description', async () => {
    const { app } = await createTestApp()
    const body = await json(await report(app, { kind: 'works', description: '  ' }))
    expect(body.kind).toBe('goodButtonReport')
  })

  test('rejects a problem without a description', async () => {
    const { app } = await createTestApp()
    const res = await report(app, { description: '   ' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      kind: 'badValidation',
      message: 'The request is not valid.',
      data: { reason: 'body.description: describe the problem' },
    })
  })

  test('rejects a failed captcha', async () => {
    const { app } = await createTestApp()
    const res = await report(app, { turnstileToken: 'fail' })
    expect(res.status).toBe(403)
    expect((await json(res)).kind).toBe('badCaptcha')
  })

  test.each([
    ['an unknown line', { lineId: 'nope' }],
    ['a cab the line does not have', { cab: 4 }],
  ])('rejects %s', async (_name, overrides) => {
    const { app } = await createTestApp()
    const res = await report(app, overrides)
    expect(res.status).toBe(404)
    expect((await json(res)).kind).toBe('badUnknownButton')
  })

  test('rate limits one device on one button', async () => {
    const { app } = await createTestApp()
    await report(app)
    const res = await report(app, { kind: 'works' })
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({
      kind: 'badButtonCooldown',
      message: 'You reported this button a few minutes ago.',
      data: { retryAfterMs: 600_000 },
    })
  })

  test('rate limits one device across buttons', async () => {
    const { app } = await createTestApp()
    await Promise.all(
      Array.from({ length: 30 }, (_, n) =>
        report(app, {
          cab: 1 + Math.floor(n / 16),
          side: Math.floor(n / 8) % 2 === 0 ? 1 : 2,
          button: 1 + (n % 8),
        })
      )
    )
    const res = await report(app, { cab: 3, side: 2, button: 8 })
    expect(res.status).toBe(429)
    expect((await json(res)).kind).toBe('badTooManyButtonReports')
  })
})

describe('GET /api/v1/stream', () => {
  test('pushes button-updated after a report', async () => {
    const { app } = await createTestApp()
    const res = await app.request('/api/v1/stream')
    if (!res.body) throw new Error('stream response has no body')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let received = ''
    const readUntil = async (needle: string): Promise<void> => {
      while (!received.includes(needle)) {
        // oxlint-disable-next-line no-await-in-loop -- reads chunks in order
        const { value, done } = await reader.read()
        if (done) throw new Error(`stream ended before "${needle}"; received: ${received}`)
        received += decoder.decode(value)
      }
    }

    await readUntil('event: ping')
    await report(app)
    await readUntil('event: button-updated')
    await readUntil('"status":"pending"')
    expect(received).toContain('"lineId":"burbank","cab":2,"side":1,"button":3')
    await reader.cancel()
  })
})
