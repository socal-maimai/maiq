import { describe, expect, test } from 'bun:test'
import { createTestBotApp, type TestBotApp } from 'maiq-tests-api/support/app'
import {
  buttonInteraction,
  callbacks,
  CHANNEL_ID,
  fakeGatewayMessage,
  GUILD_ID,
  PICKER_MESSAGE_ID,
  USER_ID,
  waitFor,
  type DiscordCall,
} from 'maiq-tests-api/support/discord'

async function setup(lineIds: readonly string[] = []) {
  const t = await createTestBotApp()
  if (lineIds.length > 0) {
    await t.statusMessages.replaceForChannel({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      messageId: '700',
      lineIds,
    })
  }
  return t
}

type ReplyBody = {
  content: string
  message_reference: { message_id: string; fail_if_not_exists: boolean }
  allowed_mentions: { replied_user: boolean }
  components?: { components: { custom_id: string }[] }[]
}

const CHECK = '%E2%9C%85'
const MESSAGES = `/api/v10/channels/${CHANNEL_ID}/messages`

const reactionPath = (messageId: string) => `${MESSAGES}/${messageId}/reactions/${CHECK}/@me`
const replies = (t: TestBotApp) =>
  t.discord.calls
    .filter(c => c.method === 'POST' && c.path === MESSAGES)
    .map(c => c.body as ReplyBody)
type CallbackBody = {
  type: number
  data?: { content?: string; flags?: number; components?: unknown[] }
}
const callbacksOf = (t: TestBotApp) => callbacks(t.discord.calls) as CallbackBody[]

async function countOf(t: TestBotApp, lineId: string) {
  const [state] = await t.deps.queue.lineStates([lineId])
  return state?.count ?? null
}

describe('chat messages', () => {
  test('ignores bots', async () => {
    const t = await setup(['temecula'])
    await t.receiveChat(fakeGatewayMessage({ content: '1p0q', bot: true }))
    expect(t.discord.calls).toEqual([])
    expect(await countOf(t, 'temecula')).toBeNull()
  })

  test('ignores webhooks', async () => {
    const t = await setup(['temecula'])
    await t.receiveChat(fakeGatewayMessage({ content: '1p0q', webhookId: '990' }))
    expect(t.discord.calls).toEqual([])
    expect(await countOf(t, 'temecula')).toBeNull()
  })

  test('ignores direct messages', async () => {
    const t = await setup(['temecula'])
    await t.receiveChat(fakeGatewayMessage({ content: '1p0q', dm: true }))
    expect(t.discord.calls).toEqual([])
    expect(await countOf(t, 'temecula')).toBeNull()
  })

  test('ignores channels without /setup', async () => {
    const t = await setup()
    await t.receiveChat(fakeGatewayMessage({ content: '1p0q' }))
    expect(t.discord.calls).toEqual([])
    expect(await countOf(t, 'temecula')).toBeNull()
  })

  test('ignores messages without a count', async () => {
    const t = await setup(['temecula'])
    await t.receiveChat(fakeGatewayMessage({ content: 'hello' }))
    expect(t.discord.calls).toEqual([])
  })

  test('records a count at a one-line arcade and reacts', async () => {
    const t = await setup(['temecula'])
    const message = fakeGatewayMessage({ content: 'here now 1p0q' })
    await t.receiveChat(message)
    expect(await countOf(t, 'temecula')).toEqual({ players: 1, queue: 0 })
    expect(t.discord.calls).toEqual([
      { method: 'PUT', path: reactionPath(message.id), body: undefined, files: [] },
    ])
  })

  test('replies with the cap without pinging the author', async () => {
    const t = await setup(['temecula'])
    const message = fakeGatewayMessage({ content: '9p0q' })
    await t.receiveChat(message)
    expect(await countOf(t, 'temecula')).toBeNull()
    const [reply] = replies(t)
    expect(reply?.content).toBe('Round1 Temecula has 2 cabs, so at most 4 players.')
    expect(reply?.allowed_mentions.replied_user).toBe(false)
    expect(reply?.message_reference).toEqual({ message_id: message.id, fail_if_not_exists: false })
  })

  test('replies when the author reports again too soon', async () => {
    const t = await setup(['temecula'])
    await t.receiveChat(fakeGatewayMessage({ content: '1p0q' }))
    await t.receiveChat(fakeGatewayMessage({ content: '2p0q' }))
    expect(await countOf(t, 'temecula')).toEqual({ players: 1, queue: 0 })
    expect(replies(t)[0]?.content).toBe(
      'You updated Round1 Temecula a moment ago. Try again in 1 min.'
    )
  })

  test('uses a line keyword at Lakewood', async () => {
    const t = await setup(['lakewood:main', 'lakewood:cuck'])
    const message = fakeGatewayMessage({ content: 'cuck 1p0q' })
    await t.receiveChat(message)
    expect(await countOf(t, 'lakewood:cuck')).toEqual({ players: 1, queue: 0 })
    expect(t.discord.calls.map(c => `${c.method} ${c.path}`)).toEqual([
      `PUT ${reactionPath(message.id)}`,
    ])
  })

  test('asks which Lakewood line when no keyword matches', async () => {
    const t = await setup(['lakewood:main', 'lakewood:cuck'])
    await t.receiveChat(fakeGatewayMessage({ content: '2p1q' }))
    expect(await countOf(t, 'lakewood:main')).toBeNull()
    const [reply] = replies(t)
    expect(reply?.content).toBe('Which line at Round1 Lakewood?')
    expect(reply?.allowed_mentions.replied_user).toBe(false)
    expect(reply?.components?.[0]?.components.map(c => c.custom_id)).toEqual([
      `pick:line=lakewood~main;count=2p1q;user=${USER_ID}`,
      `pick:line=lakewood~cuck;count=2p1q;user=${USER_ID}`,
    ])
  })
})

describe('line picker from chat', () => {
  const PICK_MAIN = `pick:line=lakewood~main;count=2p1q;user=${USER_ID}`

  test('saves the pick for the poster, removes the picker, and reacts', async () => {
    const t = await setup(['lakewood:main', 'lakewood:cuck'])
    const original = fakeGatewayMessage({ content: '2p1q' })
    await t.receiveChat(original)
    await t.send(buttonInteraction(PICK_MAIN, { repliedTo: original.id }))
    await waitFor(
      () => t.discord.calls.some(c => c.path === reactionPath(original.id)),
      'the reaction'
    )
    expect(await countOf(t, 'lakewood:main')).toEqual({ players: 2, queue: 1 })
    expect(callbacksOf(t)).toEqual([{ type: 6 }])
    const deleted = t.discord.calls.filter((c: DiscordCall) => c.method === 'DELETE')
    expect(deleted.map(c => c.path)).toEqual([`${MESSAGES}/${PICKER_MESSAGE_ID}`])
  })

  test('shows why the write failed and keeps the original message untouched', async () => {
    const t = await setup(['lakewood:main', 'lakewood:cuck'])
    const original = fakeGatewayMessage({ content: '9p0q' })
    await t.receiveChat(original)
    const pick = `pick:line=lakewood~main;count=9p0q;user=${USER_ID}`
    await t.send(buttonInteraction(pick, { repliedTo: original.id }))
    await waitFor(() => callbacksOf(t).length > 0, 'the picker update')
    expect(callbacksOf(t)).toEqual([
      {
        type: 7,
        data: {
          content: 'Round1 Lakewood (Main cabs) has 2 cabs, so at most 4 players.',
          components: [],
        },
      },
    ])
    expect(await countOf(t, 'lakewood:main')).toBeNull()
    expect(t.discord.calls.filter(c => c.method === 'DELETE' || c.method === 'PUT')).toEqual([])
  })

  test('refuses someone other than the poster', async () => {
    const t = await setup(['lakewood:main', 'lakewood:cuck'])
    const original = fakeGatewayMessage({ content: '2p1q' })
    await t.receiveChat(original)
    await t.send(buttonInteraction(PICK_MAIN, { userId: '556', repliedTo: original.id }))
    await waitFor(() => callbacksOf(t).length > 0, 'the refusal')
    expect(callbacksOf(t)).toEqual([
      {
        type: 4,
        data: {
          content: 'Only the person who posted this count can pick the line.',
          flags: 64,
        },
      },
    ])
    expect(await countOf(t, 'lakewood:main')).toBeNull()
  })
})

describe('queue questions', () => {
  test('answers q? with the current queue and records nothing', async () => {
    const t = await setup(['temecula'])
    await t.receiveChat(fakeGatewayMessage({ content: '2p1q' }))
    t.discord.calls.length = 0
    const question = fakeGatewayMessage({ content: 'q?' })
    await t.receiveChat(question)
    const [reply] = replies(t)
    expect(reply?.content).toMatch(/^\*\*Round1 Temecula\*\* 2p1q\n-# .+, updated <t:\d+:R>$/)
    expect(reply?.message_reference.message_id).toBe(question.id)
    expect(reply?.allowed_mentions.replied_user).toBe(false)
    expect(t.discord.calls.some(c => c.method === 'PUT')).toBe(false)
  })

  test('accepts queue? in any case and with extra question marks', async () => {
    const t = await setup(['temecula'])
    await t.receiveChat(fakeGatewayMessage({ content: ' QUEUE?? ' }))
    expect(replies(t)[0]?.content).toBe('**Round1 Temecula** ?\n-# No reports yet')
  })

  test('lists every line at a multi-line arcade', async () => {
    const t = await setup(['lakewood:main', 'lakewood:cuck'])
    await t.receiveChat(fakeGatewayMessage({ content: 'main 3p2q' }))
    t.discord.calls.length = 0
    await t.receiveChat(fakeGatewayMessage({ content: 'q?' }))
    const content = replies(t)[0]?.content ?? ''
    expect(content).toMatch(/^\*\*Round1 Lakewood \(Main cabs\)\*\* 3p2q\n-# .+\n/)
    expect(content).toMatch(/\*\*Round1 Lakewood \(Cuck cab\)\*\* \?\n-# No reports yet$/)
  })

  test('ignores questions that are not exactly q? or queue?', async () => {
    const t = await setup(['temecula'])
    const messages = ['q', 'queue', 'what is the q?', 'q?!', 'qq?']
    await Promise.all(messages.map(content => t.receiveChat(fakeGatewayMessage({ content }))))
    expect(t.discord.calls).toEqual([])
  })

  test('ignores q? in channels without /setup', async () => {
    const t = await setup()
    await t.receiveChat(fakeGatewayMessage({ content: 'q?' }))
    expect(t.discord.calls).toEqual([])
  })
})
