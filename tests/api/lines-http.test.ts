import { describe, expect, test } from 'bun:test'
import type { Hono } from 'hono'
import { LINE_IDS } from '@maiq/core/arcades'
import type { LineStateJson } from '@maiq/types'
import { createTestApp, postJson, reportBody } from 'maiq-tests-api/support/app'

type LinesBody = { kind: string; data: { lines: LineStateJson[] } }

describe('GET /api/v1/lines', () => {
  test('returns every line, unknown when nobody has reported', async () => {
    const { app } = await createTestApp()
    const body = (await (await app.request('/api/v1/lines')).json()) as LinesBody
    expect(body.kind).toBe('goodLines')
    expect(body.data.lines.map(l => l.lineId)).toEqual([...LINE_IDS])
    expect(body.data.lines[0]).toEqual({
      lineId: 'burbank',
      count: null,
      reportedAt: null,
      freshness: 'unknown',
      verified: false,
    })
  })

  test('includes new reports', async () => {
    const { app } = await createTestApp()
    await postJson(app, '/api/v1/reports', reportBody())
    const body = (await (await app.request('/api/v1/lines')).json()) as LinesBody
    expect(body.data.lines.find(l => l.lineId === 'burbank')?.count).toEqual({
      players: 2,
      queue: 1,
    })
  })
})

describe('GET /api/v1/stream', () => {
  test('pushes line-updated after a report', async () => {
    const { app } = await createTestApp()
    const res = await app.request('/api/v1/stream')
    expect(res.headers.get('content-type')).toContain('text/event-stream')
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
    await postJson(app, '/api/v1/reports', reportBody())
    await readUntil('event: line-updated')
    expect(received).toContain('"lineId":"burbank"')
    expect(received).toContain('"count":{"players":2,"queue":1}')
    await reader.cancel()
  })
})

async function openStream(app: Hono) {
  const res = await app.request('/api/v1/stream')
  if (!res.body) throw new Error('stream response has no body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const stream = { received: '', reader }
  const readUntil = async (needle: string, from = 0): Promise<void> => {
    while (!stream.received.includes(needle, from)) {
      // oxlint-disable-next-line no-await-in-loop -- reads chunks in order
      const { value, done } = await reader.read()
      if (done) throw new Error(`stream ended before "${needle}"; received: ${stream.received}`)
      stream.received += decoder.decode(value)
    }
  }
  return Object.assign(stream, { readUntil })
}

describe('GET /api/v1/stream with several clients', () => {
  test('sends each update to every open stream and stops at the ones that closed', async () => {
    const { app } = await createTestApp()
    const first = await openStream(app)
    const second = await openStream(app)
    await Promise.all([first.readUntil('event: ping'), second.readUntil('event: ping')])

    await postJson(app, '/api/v1/reports', reportBody())
    await Promise.all([
      first.readUntil('event: line-updated'),
      second.readUntil('event: line-updated'),
    ])
    expect(first.received).toContain('"count":{"players":2,"queue":1}')
    expect(second.received).toContain('"count":{"players":2,"queue":1}')

    await first.reader.cancel()
    const seen = second.received.length
    await postJson(app, '/api/v1/reports', reportBody({ lineId: 'temecula', players: 3 }))
    await second.readUntil('event: line-updated', seen)
    expect(second.received.slice(seen)).toContain('"lineId":"temecula"')
    await second.reader.cancel()
  })
})
