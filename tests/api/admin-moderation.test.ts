import { describe, expect, test } from 'bun:test'
import type { AdminButtonReportJson, AdminQueueReportJson, MuteJson } from '@maiq/types'
import {
  ADMIN_ID,
  createTestApp,
  DEVICE_ID,
  ORIGIN,
  PASSING_TOKEN,
  postJson,
  reportBody,
} from 'maiq-tests-api/support/app'

type TestApp = Awaited<ReturnType<typeof createTestApp>>
type Reports = {
  queue: AdminQueueReportJson[]
  buttons: AdminButtonReportJson[]
  mutes: MuteJson[]
}

const ADMIN_ACTOR = `discord:${ADMIN_ID}`
const REPORTER = `device:${DEVICE_ID}`

const adminPost = (t: TestApp, path: string, body: unknown) =>
  t.app.request(`/api/v1/admin/${path}`, {
    method: 'POST',
    headers: { cookie: t.adminCookie(), origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

async function adminReports(t: TestApp): Promise<Reports> {
  const res = await t.app.request('/api/v1/admin/reports', { headers: { cookie: t.adminCookie() } })
  return ((await res.json()) as { data: Reports }).data
}

async function burbankCount(t: TestApp) {
  const res = await t.app.request('/api/v1/lines')
  const { data } = (await res.json()) as {
    data: { lines: { lineId: string; count: { players: number; queue: number } | null }[] }
  }
  return data.lines.find(line => line.lineId === 'burbank')?.count ?? null
}

const buttonReport = (t: TestApp) =>
  postJson(t.app, '/api/v1/button-reports', {
    lineId: 'burbank',
    cab: 2,
    side: 1,
    button: 3,
    kind: 'broken',
    description: 'dead',
    deviceId: DEVICE_ID,
    turnstileToken: PASSING_TOKEN,
  })

describe('admin report list', () => {
  test('lists recent reports newest first with who sent them', async () => {
    const t = await createTestApp()
    await postJson(t.app, '/api/v1/reports', reportBody({ players: 1 }))
    t.clock.advance(61_000)
    await postJson(t.app, '/api/v1/reports', reportBody({ players: 3 }))
    const { queue } = await adminReports(t)
    expect(queue.map(row => row.players)).toEqual([3, 1])
    expect(queue[0]).toMatchObject({
      lineId: 'burbank',
      reporter: REPORTER,
      source: 'web',
      hiddenAt: null,
      test: false,
    })
  })
})

describe('hiding reports', () => {
  test('hiding a queue report drops it from the live count, and unhiding restores it', async () => {
    const t = await createTestApp()
    await postJson(t.app, '/api/v1/reports', reportBody({ players: 2, queue: 1 }))
    const [row] = (await adminReports(t)).queue
    const updates: unknown[] = []
    t.deps.events.subscribe(state => updates.push(state))

    const hide = await adminPost(t, 'moderation', { table: 'queue', id: row?.id, hidden: true })
    expect(hide.status).toBe(200)
    expect(await burbankCount(t)).toBeNull()
    expect(updates).toHaveLength(1)
    expect((await adminReports(t)).queue[0]).toMatchObject({ hiddenBy: ADMIN_ACTOR })

    await adminPost(t, 'moderation', { table: 'queue', id: row?.id, hidden: false })
    expect(await burbankCount(t)).toEqual({ players: 2, queue: 1 })
  })

  test('hiding the only button report resets that button to good', async () => {
    const t = await createTestApp()
    await buttonReport(t)
    const [row] = (await adminReports(t)).buttons
    const updates: { status: string }[] = []
    t.deps.buttonEvents.subscribe(state => updates.push(state))

    await adminPost(t, 'moderation', { table: 'button', id: row?.id, hidden: true })
    const res = await t.app.request('/api/v1/buttons')
    expect(await res.json()).toMatchObject({ data: { buttons: [] } })
    expect(updates).toEqual([expect.objectContaining({ status: 'good', recent: [] })])
  })

  test('answers 404 for a report that does not exist', async () => {
    const t = await createTestApp()
    const res = await adminPost(t, 'moderation', { table: 'queue', id: 999, hidden: true })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ kind: 'badUnknownReport' })
  })
})

describe('muting reporters', () => {
  test("stores a muted reporter's reports as hidden while still telling them it worked", async () => {
    const t = await createTestApp()
    await adminPost(t, 'mutes', { reporter: REPORTER, muted: true })

    const res = await postJson(t.app, '/api/v1/reports', reportBody())
    expect(res.status).toBe(200)
    expect(await burbankCount(t)).toBeNull()
    const { queue, mutes } = await adminReports(t)
    expect(queue[0]).toMatchObject({ reporter: REPORTER, hiddenBy: ADMIN_ACTOR })
    expect(mutes).toEqual([
      { reporter: REPORTER, mutedBy: ADMIN_ACTOR, createdAt: t.clock.now().getTime() },
    ])
  })

  test('hides muted button reports too', async () => {
    const t = await createTestApp()
    await adminPost(t, 'mutes', { reporter: REPORTER, muted: true })
    await buttonReport(t)
    const res = await t.app.request('/api/v1/buttons')
    expect(await res.json()).toMatchObject({ data: { buttons: [] } })
  })

  test('shows reports again after unmuting', async () => {
    const t = await createTestApp()
    await adminPost(t, 'mutes', { reporter: REPORTER, muted: true })
    await adminPost(t, 'mutes', { reporter: REPORTER, muted: true })
    await adminPost(t, 'mutes', { reporter: REPORTER, muted: false })
    await postJson(t.app, '/api/v1/reports', reportBody({ players: 4 }))
    expect(await burbankCount(t)).toEqual({ players: 4, queue: 1 })
    expect((await adminReports(t)).mutes).toEqual([])
  })
})

describe('test reports', () => {
  test('show on the live board and are flagged as tests', async () => {
    const t = await createTestApp()
    const res = await adminPost(t, 'test-reports', { lineId: 'burbank', players: 2, queue: 5 })
    expect(res.status).toBe(200)
    expect(await burbankCount(t)).toEqual({ players: 2, queue: 5 })
    expect((await adminReports(t)).queue[0]).toMatchObject({ test: true, reporter: ADMIN_ACTOR })
  })

  test('reject an unknown line and too many players', async () => {
    const t = await createTestApp()
    const unknown = await adminPost(t, 'test-reports', { lineId: 'nope', players: 0, queue: 0 })
    expect(unknown.status).toBe(404)
    const over = await adminPost(t, 'test-reports', { lineId: '2nd-loop', players: 3, queue: 0 })
    expect(await over.json()).toMatchObject({ kind: 'badPlayersOverCap', data: { maxPlayers: 2 } })
  })
})
