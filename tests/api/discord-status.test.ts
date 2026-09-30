import { describe, expect, spyOn, test } from 'bun:test'
import type { ButtonReportInput } from '@maiq/core/button-service'
import {
  createTestBotApp,
  OTHER_DEVICE_ID,
  postJson,
  reportBody,
  type TestBotApp,
} from 'maiq-tests-api/support/app'
import {
  buttonInteraction,
  CHANNEL_ID,
  commandInteraction,
  contentOf,
  GUILD_ID,
  modalInteraction,
  replyTo,
  waitFor,
} from 'maiq-tests-api/support/discord'

const COMPONENTS_V2 = 1 << 15
const ACTION_ROW = 1
const TEXT_DISPLAY = 10

const mapBurbank = (t: TestBotApp) =>
  t.statusMessages.replaceForChannel({
    guildId: GUILD_ID,
    channelId: CHANNEL_ID,
    messageId: '700',
    lineIds: ['burbank'],
  })

const messageEdits = (t: TestBotApp) =>
  t.discord.calls.filter(
    c => c.method === 'PATCH' && c.path === '/api/v10/channels/222/messages/700'
  )

describe('/setup', () => {
  test('posts a Components V2 status message, pins it, and records it', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(t, commandInteraction('setup', [['arcade', 'lakewood']]))
    expect(contentOf(reply)).toBe('Pinned the live Round1 Lakewood status here.')
    const post = t.discord.calls.find(
      c => c.method === 'POST' && c.path === '/api/v10/channels/222/messages'
    )
    const body = post?.body as { flags: number; components: unknown[] }
    expect(body.flags & COMPONENTS_V2).toBe(COMPONENTS_V2)
    expect(body.components.map(c => (c as { type: number }).type)).toEqual([
      TEXT_DISPLAY,
      ACTION_ROW,
      TEXT_DISPLAY,
      ACTION_ROW,
    ])
    const text = JSON.stringify(body.components)
    expect(text).toContain('### Round1 Lakewood (Main cabs)')
    expect(text).toContain('confirm:line=lakewood~main')
    expect(text).toContain('update:line=lakewood~cuck')
    expect(
      t.discord.calls.some(
        c => c.method === 'PUT' && c.path === '/api/v10/channels/222/messages/pins/900'
      )
    ).toBe(true)
    const rows = await t.statusMessages.forChannel(CHANNEL_ID)
    expect(rows.map(r => r.messageId)).toEqual(['900', '900'])
  })

  test('running it again replaces the old message', async () => {
    const t = await createTestBotApp()
    await replyTo(t, commandInteraction('setup', [['arcade', 'lakewood']]))
    await replyTo(t, commandInteraction('setup', [['arcade', 'lakewood']]))
    expect(
      t.discord.calls.some(
        c => c.method === 'DELETE' && c.path === '/api/v10/channels/222/messages/900'
      )
    ).toBe(true)
    expect((await t.statusMessages.forChannel(CHANNEL_ID)).every(r => r.messageId === '901')).toBe(
      true
    )
  })

  test('does not touch another channel already mapped to the arcade', async () => {
    const t = await createTestBotApp()
    await t.statusMessages.replaceForChannel({
      guildId: GUILD_ID,
      channelId: '333',
      messageId: '800',
      lineIds: ['lakewood:main', 'lakewood:cuck'],
    })
    await replyTo(t, commandInteraction('setup', [['arcade', 'lakewood']]))
    expect(
      t.discord.calls.some(
        c => c.method === 'DELETE' && c.path === '/api/v10/channels/333/messages/800'
      )
    ).toBe(false)
    expect((await t.statusMessages.forChannel('333')).map(r => r.messageId)).toEqual(['800', '800'])
  })

  test('requires Manage Channels', async () => {
    const t = await createTestBotApp()
    const setupCommand = t.bot.client.commands.find(c => c.name === 'setup')?.serialize()
    expect(setupCommand?.default_member_permissions).toBe('16')
  })

  test('deletes the posted message when pinning fails', async () => {
    const t = await createTestBotApp()
    t.discord.respondWith('PUT', '/api/v10/channels/222/messages/pins/900', () =>
      Response.json({ message: 'Missing Permissions', code: 50013 }, { status: 403 })
    )
    const reply = await replyTo(t, commandInteraction('setup', [['arcade', 'lakewood']]))
    expect(contentOf(reply)).toBe(
      'I need View Channel, Send Messages, Pin Messages, Add Reactions, and Read Message History ' +
        'in this channel. Add them and run /setup again.'
    )
    expect(
      t.discord.calls.some(
        c => c.method === 'DELETE' && c.path === '/api/v10/channels/222/messages/900'
      )
    ).toBe(true)
    expect(await t.statusMessages.forChannel(CHANNEL_ID)).toEqual([])
  })
})

describe('status message buttons', () => {
  test('Still confirms the current count as the clicking user', async () => {
    const t = await createTestBotApp()
    await postJson(t.app, '/api/v1/reports', reportBody())
    t.clock.advance(6 * 60_000)
    const reply = await replyTo(t, buttonInteraction('confirm:line=burbank'))
    expect(contentOf(reply)).toBe('Confirmed Round1 Burbank: 2p1q')
    const [state] = await t.deps.queue.lineStates(['burbank'])
    expect(state?.reportedAt).toEqual(t.clock.now())
  })

  test('Update opens a modal with two labelled inputs', async () => {
    const t = await createTestBotApp()
    await t.send(buttonInteraction('update:line=burbank'))
    await waitFor(() => t.discord.calls.length > 0, 'the modal callback')
    const body = t.discord.calls[0]?.body as {
      type: number
      data: { custom_id: string; components: { type: number }[] }
    }
    expect(body.type).toBe(9)
    expect(body.data.custom_id).toBe('report:line=burbank')
    expect(body.data.components.map(c => c.type)).toEqual([18, 18])
  })

  test('the modal records the numbers', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(
      t,
      modalInteraction('report:line=burbank', { players: '3', queue: '1' })
    )
    expect(contentOf(reply)).toBe('Updated Round1 Burbank: 3p1q')
  })

  test('the modal rejects words', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(
      t,
      modalInteraction('report:line=burbank', { players: 'two', queue: '1' })
    )
    expect(contentOf(reply)).toBe('Enter whole numbers for playing and queueing, like 4 and 2.')
  })
})

describe('status publisher', () => {
  test('edits the pinned message after a web report', async () => {
    const t = await createTestBotApp()
    await mapBurbank(t)
    await postJson(t.app, '/api/v1/reports', reportBody())
    await t.bot.publisher.flush()
    expect(messageEdits(t)).toHaveLength(1)
    expect(JSON.stringify(messageEdits(t)[0]?.body)).toContain('**2p1q**')
  })

  test('folds several reports inside the delay into one edit', async () => {
    const t = await createTestBotApp()
    await mapBurbank(t)
    await postJson(t.app, '/api/v1/reports', reportBody())
    await postJson(t.app, '/api/v1/reports', reportBody({ deviceId: OTHER_DEVICE_ID, players: 1 }))
    await t.bot.publisher.flush()
    expect(messageEdits(t)).toHaveLength(1)
    expect(JSON.stringify(messageEdits(t)[0]?.body)).toContain('**1p1q**')
  })

  test('forgets a status message that was deleted in Discord', async () => {
    const t = await createTestBotApp()
    await mapBurbank(t)
    t.discord.respondWith('PATCH', '/api/v10/channels/222/messages/700', () =>
      Response.json({ message: 'Unknown Message', code: 10008 }, { status: 404 })
    )
    await postJson(t.app, '/api/v1/reports', reportBody())
    await t.bot.publisher.flush()
    expect(await t.statusMessages.forLine('burbank')).toEqual([])
  })

  test('warns about missing permissions when Discord refuses a status edit', async () => {
    const t = await createTestBotApp()
    await mapBurbank(t)
    t.discord.respondWith('PATCH', '/api/v10/channels/222/messages/700', () =>
      Response.json({ message: 'Missing Access', code: 50001 }, { status: 403 })
    )
    const warn = spyOn(t.deps.logger, 'warn')
    const error = spyOn(t.deps.logger, 'error')
    await postJson(t.app, '/api/v1/reports', reportBody())
    await t.bot.publisher.flush()
    expect(error).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[1])).toContain("Check the bot's permissions")
    expect(await t.statusMessages.forLine('burbank')).toHaveLength(1)
  })

  test('edits every channel mapped to the same line', async () => {
    const t = await createTestBotApp()
    await mapBurbank(t)
    await t.statusMessages.replaceForChannel({
      guildId: GUILD_ID,
      channelId: '333',
      messageId: '800',
      lineIds: ['burbank'],
    })
    await postJson(t.app, '/api/v1/reports', reportBody())
    await t.bot.publisher.flush()
    const editsTo = (channelId: string, messageId: string) =>
      t.discord.calls.filter(
        c =>
          c.method === 'PATCH' && c.path === `/api/v10/channels/${channelId}/messages/${messageId}`
      )
    expect(editsTo('222', '700')).toHaveLength(1)
    expect(editsTo('333', '800')).toHaveLength(1)
  })
})

describe('status publisher and outages', () => {
  const CUCK = 'lakewood:cuck'
  const sideReport = (reporter: string, side: 1 | 2): ButtonReportInput => ({
    lineId: CUCK,
    cab: 1,
    side,
    button: 0,
    kind: 'broken',
    description: 'dead',
    reporter,
  })
  const mapCuck = (t: TestBotApp) =>
    t.statusMessages.replaceForChannel({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      messageId: '700',
      lineIds: [CUCK],
    })

  test('refreshes the pinned message when a side changes and skips the down sides', async () => {
    const t = await createTestBotApp()
    await mapCuck(t)
    await postJson(t.app, '/api/v1/reports', reportBody({ lineId: CUCK }))
    await t.bot.publisher.flush()
    const before = messageEdits(t).length
    await t.deps.buttons.submit(sideReport('device:a', 1))
    await t.deps.buttons.submit(sideReport('device:b', 1))
    await t.deps.buttons.submit(sideReport('device:a', 2))
    await t.deps.buttons.submit(sideReport('device:b', 2))
    await t.bot.publisher.flush()
    expect(messageEdits(t).length).toBe(before + 1)
    expect(JSON.stringify(messageEdits(t).at(-1)?.body)).toContain('No playable cabs')
  })

  test('does not refresh when a normal button changes', async () => {
    const t = await createTestBotApp()
    await mapCuck(t)
    await t.deps.buttons.submit({ ...sideReport('device:a', 1), button: 3 })
    await t.bot.publisher.flush()
    expect(messageEdits(t)).toHaveLength(0)
  })
})
