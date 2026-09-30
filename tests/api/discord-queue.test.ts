import { describe, expect, test } from 'bun:test'
import { COUNT_HINT } from '@maiq/core/count'
import { createTestBotApp } from 'maiq-tests-api/support/app'
import {
  buttonInteraction,
  CHANNEL_ID,
  commandInteraction,
  contentOf,
  GUILD_ID,
  replyTo,
  waitFor,
} from 'maiq-tests-api/support/discord'

describe('interactions endpoint', () => {
  test('answers PING', async () => {
    const t = await createTestBotApp()
    const res = await t.send({ type: 1 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ type: 1 })
  })

  test('rejects a bad signature', async () => {
    const t = await createTestBotApp()
    expect((await t.send({ type: 1 }, { tamper: true })).status).toBe(401)
  })
})

describe('/q', () => {
  test('records a report for the chosen arcade and replies ephemerally', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(
      t,
      commandInteraction('q', [
        ['count', '4p2q'],
        ['arcade', 'burbank'],
      ])
    )
    expect(t.discord.calls[0]?.body).toEqual({ type: 5, data: { flags: 64 } })
    expect(contentOf(reply)).toBe('Updated Round1 Burbank: 4p2q')
    const [state] = await t.deps.queue.lineStates(['burbank'])
    expect(state?.count).toEqual({ players: 4, queue: 2 })
  })

  test("uses the channel's arcade when none is given", async () => {
    const t = await createTestBotApp()
    await t.statusMessages.replaceForChannel({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      messageId: '700',
      lineIds: ['temecula'],
    })
    const reply = await replyTo(t, commandInteraction('q', [['count', '1p0q']]))
    expect(contentOf(reply)).toBe('Updated Round1 Temecula: 1p0q')
  })

  test('asks for an arcade in an unmapped channel', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(t, commandInteraction('q', [['count', '1p0q']]))
    expect(contentOf(reply)).toContain('arcade option')
  })

  test('explains a malformed count', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(
      t,
      commandInteraction('q', [
        ['count', 'lots'],
        ['arcade', 'burbank'],
      ])
    )
    expect(contentOf(reply)).toBe(COUNT_HINT)
  })

  test('explains the player cap', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(
      t,
      commandInteraction('q', [
        ['count', '3p0q'],
        ['arcade', '2nd-loop'],
      ])
    )
    expect(contentOf(reply)).toBe('2nd Loop has 1 cab, so at most 2 players.')
  })

  test('asks which Lakewood line, then records the pick', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(
      t,
      commandInteraction('q', [
        ['count', '4p2q'],
        ['arcade', 'lakewood'],
      ])
    )
    expect(contentOf(reply)).toBe('Which line at Round1 Lakewood?')
    const row = (reply.body as { components: { components: { custom_id: string }[] }[] })
      .components[0]
    expect(row?.components.map(c => c.custom_id)).toEqual([
      'pick:line=lakewood~main;count=4p2q',
      'pick:line=lakewood~cuck;count=4p2q',
    ])

    await t.send(buttonInteraction('pick:line=lakewood~main;count=4p2q'))
    await waitFor(
      () => t.discord.calls.some(c => (c.body as { type?: number } | undefined)?.type === 7),
      'the button update'
    )
    const update = t.discord.calls.find(c => (c.body as { type?: number } | undefined)?.type === 7)
    expect((update?.body as { data: { content: string } } | undefined)?.data.content).toBe(
      'Updated Round1 Lakewood (Main cabs): 4p2q'
    )
  })

  test('registers the arcade option with fixed choices', async () => {
    const t = await createTestBotApp()
    const q = t.bot.client.commands.find(c => c.name === 'q')?.serialize()
    expect(JSON.stringify(q)).toContain('"value":"lakewood"')
  })
})
