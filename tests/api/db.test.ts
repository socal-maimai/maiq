import { describe, expect, test } from 'bun:test'
import { buttonReports, queueReports } from '@maiq/db'
import { createTestDatabase } from 'maiq-tests-api/support/database'

const report = {
  lineId: 'burbank',
  players: 2,
  queue: 1,
  kind: 'report' as const,
  source: 'web' as const,
  reporter: 'device:test',
  inGeofence: true,
}

describe('migrations', () => {
  test('create a queue_reports table that accepts a report', async () => {
    const { db } = await createTestDatabase()
    await db.insert(queueReports).values(report)
    const rows = await db.select().from(queueReports)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.createdAt).toBeInstanceOf(Date)
  })

  test('reject more than 8 players', async () => {
    const { db } = await createTestDatabase()
    await expect(
      Promise.resolve(db.insert(queueReports).values({ ...report, players: 9 }))
    ).rejects.toThrow()
  })

  test('reject an unknown kind', async () => {
    const { db } = await createTestDatabase()
    const bad = { ...report, kind: 'vote' } as unknown as typeof report
    await expect(Promise.resolve(db.insert(queueReports).values(bad))).rejects.toThrow()
  })
})

const buttonReport = {
  lineId: 'burbank',
  cab: 2,
  side: 1 as const,
  button: 3,
  kind: 'broken' as const,
  description: 'no response',
  reporter: 'device:test',
}

describe('button_reports', () => {
  test('accepts a report and defaults the description', async () => {
    const { db } = await createTestDatabase()
    await db.insert(buttonReports).values(buttonReport)
    await db.insert(buttonReports).values({
      lineId: 'burbank',
      cab: 1,
      side: 1,
      button: 1,
      kind: 'works',
      reporter: 'device:test',
    })
    const rows = await db.select().from(buttonReports)
    expect(rows.map(row => row.description)).toEqual(['no response', ''])
    expect(rows[0]?.createdAt).toBeInstanceOf(Date)
  })

  test('accepts button 0, a report about the side itself', async () => {
    const { db } = await createTestDatabase()
    await db.insert(buttonReports).values({ ...buttonReport, button: 0 })
    const rows = await db.select().from(buttonReports)
    expect(rows.map(row => row.button)).toEqual([0])
  })

  test.each([
    ['a blank description on a problem', { description: '   ' }],
    ['a 281-character description', { description: 'a'.repeat(281) }],
    ['side 3', { side: 3 }],
    ['button 9', { button: 9 }],
    ['button -1', { button: -1 }],
    ['cab 0', { cab: 0 }],
    ['an unknown kind', { kind: 'fine' }],
  ])('rejects %s', async (_name, overrides) => {
    const { db } = await createTestDatabase()
    const bad = { ...buttonReport, ...overrides } as unknown as typeof buttonReport
    await expect(Promise.resolve(db.insert(buttonReports).values(bad))).rejects.toThrow()
  })
})
