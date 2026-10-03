import { describe, expect, test } from 'bun:test'
import { COUNT_HINT } from '@maiq/core/count'
import { createTestBotApp } from 'maiq-tests-api/support/app'
import {
  autocompleteInteraction,
  buttonInteraction,
  callbacks,
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
    const { queue } = await t.deps.moderation.recent()
    expect(queue[0]).toMatchObject({ reporter: 'discord:555', reporterName: 'u' })
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

  test('registers the arcade option as autocomplete instead of fixed choices', async () => {
    const t = await createTestBotApp()
    const q = t.bot.client.commands.find(c => c.name === 'q')?.serialize() as {
      options: { name: string; autocomplete?: boolean; choices?: unknown }[]
    }
    const arcade = q.options.find(option => option.name === 'arcade')
    expect(arcade).toMatchObject({ autocomplete: true })
    expect(arcade?.choices).toBeUndefined()
  })

  test('suggests arcades matching what was typed', async () => {
    const t = await createTestBotApp()
    await t.send(autocompleteInteraction('q', 'arcade', 'stones'))
    await waitFor(() => callbacks(t.discord.calls).length > 0, 'the autocomplete answer')
    expect(callbacks(t.discord.calls)[0]).toEqual({
      type: 8,
      data: { choices: [{ name: 'Round1 Stonestown', value: 'stonestown' }] },
    })
  })

  test('caps empty-query suggestions at 25 and lists the channel region first', async () => {
    const t = await createTestBotApp()
    await t.statusMessages.replaceForChannel({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      messageId: '700',
      lineIds: ['stonestown'],
    })
    await t.send(autocompleteInteraction('q', 'arcade', ''))
    await waitFor(() => callbacks(t.discord.calls).length > 0, 'the autocomplete answer')
    const [answer] = callbacks(t.discord.calls) as { data: { choices: { value: string }[] } }[]
    expect(answer?.data.choices).toHaveLength(25)
    expect(answer?.data.choices[0]?.value).toBe('stonestown')
  })

  test('accepts an arcade name typed without picking a suggestion', async () => {
    const t = await createTestBotApp()
    const reply = await replyTo(
      t,
      commandInteraction('q', [
        ['count', '2p1q'],
        ['arcade', 'Round1 Eastridge'],
      ])
    )
    expect(contentOf(reply)).toBe('Updated Round1 Eastridge: 2p1q')
  })
})
