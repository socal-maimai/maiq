import { beforeEach, describe, expect, test } from 'bun:test'
import type { StatusMessageStore } from '@maiq/bot/deps'
import { createStatusMessageStore } from '@maiq/api/services/status-messages'
import { createTestDatabase } from 'maiq-tests-api/support/database'

let store: StatusMessageStore

beforeEach(async () => {
  const { db } = await createTestDatabase()
  store = createStatusMessageStore(db)
})

const lakewood = {
  guildId: 'g',
  channelId: 'c1',
  messageId: 'm1',
  lineIds: ['lakewood:main', 'lakewood:cuck'],
}

describe('status message store', () => {
  test('records one row per line and finds them by channel and line', async () => {
    expect(await store.replaceForChannel(lakewood)).toEqual([])
    expect((await store.forChannel('c1')).map(r => r.lineId).toSorted()).toEqual([
      'lakewood:cuck',
      'lakewood:main',
    ])
    expect(await store.forLine('lakewood:main')).toEqual([
      {
        lineId: 'lakewood:main',
        guildId: 'g',
        channelId: 'c1',
        messageId: 'm1',
      },
    ])
    expect(await store.forLine('burbank')).toEqual([])
  })

  test('replacing a channel returns and removes the old rows', async () => {
    await store.replaceForChannel({ ...lakewood, lineIds: ['burbank'] })
    const replaced = await store.replaceForChannel({ ...lakewood, messageId: 'm2' })
    expect(replaced.map(r => r.lineId)).toEqual(['burbank'])
    expect(await store.forLine('burbank')).toEqual([])
    expect((await store.forChannel('c1')).every(r => r.messageId === 'm2')).toBe(true)
  })

  test('a second channel can show the same line and both are kept', async () => {
    await store.replaceForChannel({ ...lakewood, lineIds: ['burbank'] })
    await store.replaceForChannel({
      ...lakewood,
      channelId: 'c2',
      messageId: 'm9',
      lineIds: ['burbank'],
    })
    expect((await store.forLine('burbank')).map(r => r.channelId).toSorted()).toEqual(['c1', 'c2'])
  })

  test('replacing one channel leaves another channel alone', async () => {
    await store.replaceForChannel({ ...lakewood, lineIds: ['burbank'] })
    await store.replaceForChannel({
      ...lakewood,
      channelId: 'c2',
      messageId: 'm9',
      lineIds: ['burbank'],
    })
    await store.replaceForChannel({ ...lakewood, messageId: 'm2', lineIds: ['temecula'] })
    expect((await store.forChannel('c2')).map(r => r.messageId)).toEqual(['m9'])
  })

  test('removeMessage deletes every row for that message', async () => {
    await store.replaceForChannel(lakewood)
    await store.removeMessage('m1')
    expect(await store.forChannel('c1')).toEqual([])
  })
})
