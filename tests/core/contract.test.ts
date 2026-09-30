import { describe, expect, test } from 'bun:test'
import {
  BadButtonCooldown,
  BadRateLimit,
  BadUnknownLine,
  ButtonStateJsonSchema,
  defineRoute,
  fromLineStateJson,
  GetButtons,
  GoodLines,
  PostButtonReport,
  PostReport,
  response,
  toButtonStateJson,
  toLineStateJson,
} from '@maiq/types'
import { z } from 'zod/mini'

describe('response', () => {
  test('builds an envelope schema with data', () => {
    expect(
      BadRateLimit.schema.safeParse({
        kind: 'badRateLimit',
        message: BadRateLimit.message,
        data: { retryAfterMs: 1000 },
      }).success
    ).toBe(true)
    expect(BadRateLimit.schema.safeParse({ kind: 'badRateLimit', message: 'other' }).success).toBe(
      false
    )
  })

  test('builds an envelope schema without data', () => {
    expect(BadUnknownLine.dataSchema).toBeUndefined()
    expect(
      BadUnknownLine.schema.safeParse({ kind: 'badUnknownLine', message: BadUnknownLine.message })
        .success
    ).toBe(true)
  })

  test('keeps the kind and status', () => {
    const custom = response('goodThing', { status: 201, message: 'Made.', data: z.object({}) })
    expect(custom.kind).toBe('goodThing')
    expect(custom.status).toBe(201)
  })
})

describe('defineRoute', () => {
  test('fills defaults', () => {
    const route = defineRoute({ method: 'GET', path: '/v1/x', goodResponses: [GoodLines] })
    expect(route.badResponses).toEqual([])
    expect(route.captcha).toBe(false)
    expect(route.body).toBeUndefined()
    expect(route.query).toBeUndefined()
  })

  test('PostReport requires a captcha and validates its body', () => {
    expect(PostReport.captcha).toBe(true)
    const body = {
      lineId: 'burbank',
      players: 2,
      queue: 1,
      deviceId: '0b6c7f4e-8e0f-4a37-9d9e-2f1d0c3b4a5e',
      turnstileToken: 'token',
    }
    expect(PostReport.body.safeParse(body).success).toBe(true)
    expect(PostReport.body.safeParse({ ...body, queue: 41 }).success).toBe(false)
    expect(PostReport.body.safeParse({ ...body, players: 9 }).success).toBe(false)
    expect(PostReport.body.safeParse({ ...body, deviceId: 'nope' }).success).toBe(false)
    expect(PostReport.body.safeParse({ ...body, location: { lat: 91, lng: 0 } }).success).toBe(
      false
    )
  })

  test('reports readable English validation messages', () => {
    const result = PostReport.body.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).not.toBe('Invalid input')
  })
})

describe('line state JSON', () => {
  test('round-trips', () => {
    const state = {
      lineId: 'burbank',
      count: { players: 2, queue: 1 },
      reportedAt: new Date('2026-10-02T03:00:00Z'),
      freshness: 'fresh' as const,
      verified: true,
    }
    const json = toLineStateJson(state)
    expect(json.reportedAt).toBe(state.reportedAt.getTime())
    expect(fromLineStateJson(json)).toEqual(state)
  })
})

const buttonBody = (overrides: Record<string, unknown> = {}) => ({
  lineId: 'burbank',
  cab: 2,
  side: 1,
  button: 7,
  kind: 'broken',
  description: '  misses holds  ',
  deviceId: '0b6c7f4e-8e0f-4a37-9d9e-2f1d0c3b4a5e',
  turnstileToken: 'token',
  ...overrides,
})

describe('GetButtons', () => {
  test('takes an optional arcade id in the query', () => {
    expect(GetButtons.query.safeParse({}).success).toBe(true)
    expect(GetButtons.query.safeParse({ arcadeId: 'lakewood' }).data).toEqual({
      arcadeId: 'lakewood',
    })
    expect(GetButtons.query.safeParse({ arcadeId: '' }).success).toBe(false)
  })
})

describe('PostButtonReport', () => {
  test('requires a captcha and trims the description', () => {
    expect(PostButtonReport.captcha).toBe(true)
    expect(PostButtonReport.body.safeParse(buttonBody()).data?.description).toBe('misses holds')
  })

  test('allows no description at all', () => {
    const body: Record<string, unknown> = buttonBody({ kind: 'works' })
    delete body['description']
    expect(PostButtonReport.body.safeParse(body).success).toBe(true)
  })

  test.each([
    ['side 3', { side: 3 }],
    ['cab 0', { cab: 0 }],
    ['cab 5', { cab: 5 }],
    ['button 9', { button: 9 }],
    ['button -1', { button: -1 }],
    ['an unknown kind', { kind: 'fine' }],
    ['281 characters', { description: 'a'.repeat(281) }],
  ])('rejects %s', (_name, overrides) => {
    expect(PostButtonReport.body.safeParse(buttonBody(overrides)).success).toBe(false)
  })

  test('accepts button 0, the side itself', () => {
    expect(PostButtonReport.body.safeParse(buttonBody({ button: 0 })).success).toBe(true)
  })

  test('counts the limit after trimming', () => {
    const body = buttonBody({ description: `  ${'a'.repeat(280)}  ` })
    expect(PostButtonReport.body.safeParse(body).success).toBe(true)
  })

  test('has a retry delay on the cooldown response', () => {
    expect(
      BadButtonCooldown.schema.safeParse({
        kind: 'badButtonCooldown',
        message: BadButtonCooldown.message,
        data: { retryAfterMs: 60_000 },
      }).success
    ).toBe(true)
  })
})

describe('toButtonStateJson', () => {
  test('turns report dates into epoch milliseconds', () => {
    const json = toButtonStateJson({
      lineId: 'burbank',
      cab: 1,
      side: 2,
      button: 5,
      status: 'pending',
      confirmed: 'good',
      pending: 'broken',
      pendingVotes: 1,
      recent: [{ kind: 'broken', description: 'dead', at: new Date(1_790_000_000_000) }],
    })
    expect(json.recent).toEqual([{ kind: 'broken', description: 'dead', at: 1_790_000_000_000 }])
    expect(ButtonStateJsonSchema.safeParse(json).success).toBe(true)
  })
})
