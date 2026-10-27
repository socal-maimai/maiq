import { describe, expect, test } from 'bun:test'
import { createTestBotApp, type TestBotApp } from 'maiq-tests-api/support/app'
import {
  buttonInteraction,
  callbacks,
  CHANNEL_ID,
  commandInteraction,
  contentOf,
  fakeGatewayMessage,
  GUILD_ID,
  modalInteraction,
  replyTo,
  waitFor,
} from 'maiq-tests-api/support/discord'

const HOUR = 60 * 60_000
const unixOf = (iso: string) => Date.parse(iso) / 1000
const BURBANK_CLOSES = unixOf('2026-10-02T09:00:00Z') // Fri 2 AM PDT
const OPENS = unixOf('2026-10-02T17:00:00Z') // Fri 10 AM PDT
const TEMECULA_CLOSED = `Round1 Temecula is closed. It opens <t:${OPENS}:R> (<t:${OPENS}:t>).`
const MESSAGES = `/api/v10/channels/${CHANNEL_ID}/messages`

async function setup(lineIds: readonly string[] = ['temecula']) {
  const t = await createTestBotApp()
  await t.statusMessages.replaceForChannel({
    guildId: GUILD_ID,
    channelId: CHANNEL_ID,
    messageId: '700',
    lineIds,
  })
  return t
}

const closeArcades = (t: TestBotApp) => t.clock.advance(8 * HOUR)

const chatReplies = (t: TestBotApp) =>
  t.discord.calls
    .filter(c => c.method === 'POST' && c.path === MESSAGES)
    .map(c => (c.body as { content: string }).content)

async function countOf(t: TestBotApp, lineId: string) {
  const [state] = await t.deps.queue.lineStates([lineId])
  return state?.count ?? null
}

async function callbackFor(t: TestBotApp, payload: unknown) {
  const before = callbacks(t.discord.calls).length
  await t.send(payload)
  await waitFor(() => callbacks(t.discord.calls).length > before, 'the callback')
  return callbacks(t.discord.calls).at(-1) as {
    type: number
    data?: { content?: string; flags?: number }
  }
}

describe('/hours', () => {
  test('replies publicly with whether the arcade is open and its weekly hours', async () => {
    const t = await createTestBotApp()
    const reply = await callbackFor(t, commandInteraction('hours', [['arcade', 'burbank']]))
    expect(reply).toEqual({
      type: 4,
      data: {
        content: `**Round1 Burbank**\nOpen now, closes <t:${BURBANK_CLOSES}:t>\nEvery day 10 AM–2 AM`,
      },
    })
  })

  test('says when a closed arcade opens', async () => {
    const t = await setup()
    closeArcades(t)
    const reply = await callbackFor(t, commandInteraction('hours', []))
    expect(reply.data?.content).toBe(
      `**Round1 Temecula**\nClosed, opens <t:${OPENS}:R>\nEvery day 10 AM–2 AM`
    )
  })

  test('says when an arcade has no hours yet', async () => {
    const t = await createTestBotApp()
    const reply = await callbackFor(t, commandInteraction('hours', [['arcade', 'stonestown']]))
    expect(reply.data?.content).toBe('No hours listed for Round1 Stonestown yet.')
  })
})

describe('queue actions while closed', () => {
  test('q? says the arcade is closed', async () => {
    const t = await setup()
    closeArcades(t)
    await t.receiveChat(fakeGatewayMessage({ content: 'q?' }))
    expect(chatReplies(t)).toEqual([TEMECULA_CLOSED])
  })

  test('a count in chat is refused without a reaction', async () => {
    const t = await setup()
    closeArcades(t)
    await t.receiveChat(fakeGatewayMessage({ content: '4p2q' }))
    expect(chatReplies(t)).toEqual([TEMECULA_CLOSED])
    expect(t.discord.calls.some(c => c.method === 'PUT')).toBe(false)
    expect(await countOf(t, 'temecula')).toBeNull()
  })

  test('/q is refused privately', async () => {
    const t = await setup()
    closeArcades(t)
    const reply = await replyTo(t, commandInteraction('q', [['count', '1p0q']]))
    expect(callbacks(t.discord.calls)).toEqual([{ type: 5, data: { flags: 64 } }])
    expect(contentOf(reply)).toBe(TEMECULA_CLOSED)
    expect(await countOf(t, 'temecula')).toBeNull()
  })

  test('the status buttons, report modal, and line picker are refused', async () => {
    const t = await setup()
    await t.receiveChat(fakeGatewayMessage({ content: '1p0q' }))
    const reportedAt = t.clock.now()
    closeArcades(t)
    const confirm = await replyTo(t, buttonInteraction('confirm:line=temecula'))
    expect(contentOf(confirm)).toBe(TEMECULA_CLOSED)
    const update = await callbackFor(t, buttonInteraction('update:line=temecula'))
    expect(update).toEqual({ type: 4, data: { content: TEMECULA_CLOSED, flags: 64 } })
    const modal = await replyTo(
      t,
      modalInteraction('report:line=temecula', { players: '3', queue: '1' })
    )
    expect(contentOf(modal)).toBe(TEMECULA_CLOSED)
    const pick = await callbackFor(t, buttonInteraction('pick:line=lakewood~main;count=2p1q'))
    expect(pick.data?.content).toMatch(/^Round1 Lakewood is closed\. It opens <t:\d+:R>/)
    const states = await t.deps.queue.lineStates(['temecula', 'lakewood:main'])
    expect(states.map(state => state.reportedAt)).toEqual([reportedAt, null])
  })

  test('works again once the arcade opens', async () => {
    const t = await setup()
    closeArcades(t)
    t.clock.advance(8 * HOUR)
    const message = fakeGatewayMessage({ content: '4p2q' })
    await t.receiveChat(message)
    expect(await countOf(t, 'temecula')).toEqual({ players: 4, queue: 2 })
    expect(t.discord.calls.map(c => c.method)).toEqual(['PUT'])
    const reply = await replyTo(t, commandInteraction('q', [['count', '1p0q']]))
    expect(contentOf(reply)).toBe('You updated Round1 Temecula a moment ago. Try again in 1 min.')
  })
})
