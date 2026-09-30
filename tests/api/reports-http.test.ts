import { describe, expect, test } from 'bun:test'
import { findArcade } from '@maiq/core/arcades'
import {
  createTestApp,
  DEVICE_ID,
  OTHER_DEVICE_ID,
  PASSING_TOKEN,
  postJson,
  reportBody,
} from 'maiq-tests-api/support/app'

type Envelope = { kind: string; message: string; data?: Record<string, unknown> }
const json = async (res: Response) => (await res.json()) as Envelope

describe('POST /api/v1/reports', () => {
  test('accepts a report', async () => {
    const { app, clock } = await createTestApp()
    const res = await postJson(app, '/api/v1/reports', reportBody())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      kind: 'goodReport',
      message: 'Thanks for the update.',
      data: {
        line: {
          lineId: 'burbank',
          count: { players: 2, queue: 1 },
          reportedAt: clock.now().getTime(),
          freshness: 'fresh',
          verified: false,
        },
      },
    })
  })

  test('marks a report sent from inside the geofence as verified', async () => {
    const { app } = await createTestApp()
    const atBurbank = { lat: 34.18401, lng: -118.311656 }
    const res = await postJson(app, '/api/v1/reports', reportBody({ location: atBurbank }))
    const body = await json(res)
    expect(body.data).toMatchObject({ line: { verified: true } })
  })

  test('rejects an unknown line', async () => {
    const { app } = await createTestApp()
    const res = await postJson(app, '/api/v1/reports', reportBody({ lineId: 'nope' }))
    expect(res.status).toBe(404)
    expect((await json(res)).kind).toBe('badUnknownLine')
  })

  test('rejects more players than the line seats', async () => {
    const { app } = await createTestApp()
    const res = await postJson(
      app,
      '/api/v1/reports',
      reportBody({ lineId: '2nd-loop', players: 3 })
    )
    expect(res.status).toBe(400)
    expect(await json(res)).toMatchObject({ kind: 'badPlayersOverCap', data: { maxPlayers: 2 } })
  })

  test('rejects a queue over 40 with a readable reason', async () => {
    const { app } = await createTestApp()
    const res = await postJson(app, '/api/v1/reports', reportBody({ queue: 41 }))
    const body = await json(res)
    expect(res.status).toBe(400)
    expect(body.kind).toBe('badValidation')
    expect(String(body.data?.['reason'])).toStartWith('body.queue')
  })

  test('rejects malformed JSON', async () => {
    const { app } = await createTestApp()
    const res = await postJson(app, '/api/v1/reports', '{not json')
    expect(await json(res)).toEqual({
      kind: 'badValidation',
      message: 'The request is not valid.',
      data: { reason: 'body: not valid JSON' },
    })
  })

  test('rejects a failed captcha and stores nothing', async () => {
    const { app, deps } = await createTestApp()
    const res = await postJson(app, '/api/v1/reports', reportBody({ turnstileToken: 'fail' }))
    expect(res.status).toBe(403)
    expect((await json(res)).kind).toBe('badCaptcha')
    const [state] = await deps.queue.lineStates(['burbank'])
    expect(state?.count).toBeNull()
  })

  test('rate limits a device for 60 seconds', async () => {
    const { app, clock } = await createTestApp()
    await postJson(app, '/api/v1/reports', reportBody())
    const limited = await postJson(app, '/api/v1/reports', reportBody())
    expect(limited.status).toBe(429)
    expect(await json(limited)).toMatchObject({
      kind: 'badRateLimit',
      data: { retryAfterMs: 60_000 },
    })
    clock.advance(60_000)
    expect((await postJson(app, '/api/v1/reports', reportBody())).status).toBe(200)
  })

  test('an in-geofence report is not replaced by a remote one for 10 minutes', async () => {
    const { app, clock } = await createTestApp()
    const burbank = findArcade('burbank')
    if (!burbank) throw new Error('test setup: no burbank')
    await postJson(app, '/api/v1/reports', reportBody({ location: burbank.location }))
    clock.advance(60_000)
    const res = await postJson(
      app,
      '/api/v1/reports',
      reportBody({ deviceId: OTHER_DEVICE_ID, players: 0, queue: 5 })
    )
    expect(await json(res)).toMatchObject({
      kind: 'goodReport',
      data: { line: { count: { players: 2, queue: 1 } } },
    })
  })
})

const confirmBody = (deviceId: string) => ({
  lineId: 'burbank',
  deviceId,
  turnstileToken: PASSING_TOKEN,
})

describe('POST /api/v1/confirms', () => {
  test('returns 409 when there is nothing to confirm', async () => {
    const { app } = await createTestApp()
    const res = await postJson(app, '/api/v1/confirms', confirmBody(DEVICE_ID))
    expect(res.status).toBe(409)
    expect((await json(res)).kind).toBe('badNothingToConfirm')
  })

  test('refreshes the report time', async () => {
    const { app, clock } = await createTestApp()
    await postJson(app, '/api/v1/reports', reportBody())
    clock.advance(6 * 60_000)
    const res = await postJson(app, '/api/v1/confirms', confirmBody(OTHER_DEVICE_ID))
    expect(await json(res)).toMatchObject({
      kind: 'goodConfirm',
      data: { line: { count: { players: 2, queue: 1 }, reportedAt: clock.now().getTime() } },
    })
  })
})

describe('other endpoints', () => {
  test('GET /api/v1/client-config returns the Turnstile site key', async () => {
    const { app } = await createTestApp()
    expect(await json(await app.request('/api/v1/client-config'))).toMatchObject({
      kind: 'goodClientConfig',
      data: { turnstileSiteKey: 'test-site-key' },
    })
  })

  test('unknown API paths return badEndpoint', async () => {
    const { app } = await createTestApp()
    const res = await app.request('/api/v1/nope')
    expect(res.status).toBe(404)
    expect((await json(res)).kind).toBe('badEndpoint')
  })

  test('health and readiness checks pass', async () => {
    const { app } = await createTestApp()
    expect((await app.request('/api/healthz')).status).toBe(200)
    expect((await app.request('/api/readyz')).status).toBe(200)
  })
})
