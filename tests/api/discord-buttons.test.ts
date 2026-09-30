import { describe, expect, spyOn, test } from 'bun:test'
import type { ButtonReportInput, ButtonState } from '@maiq/core/button-service'
import { SIDES, type ReportKind, type Side } from '@maiq/core/buttons'
import { buttonsMessage, MAX_TEXT_LENGTH } from '@maiq/bot/buttons/render'
import { createTestBotApp, type TestBotApp } from 'maiq-tests-api/support/app'
import {
  callbacks,
  CHANNEL_ID,
  commandInteraction,
  edits,
  GUILD_ID,
  replyTo,
  waitFor,
} from 'maiq-tests-api/support/discord'
import { arcade } from 'maiq-tests-api/support/lookup'

const COMPONENTS_V2 = 1 << 15
const EPHEMERAL = 1 << 6
const NO_ARCADE =
  'This channel has no arcade set up. Add the arcade option, like /buttons arcade:Round1 Lakewood.'

type V2Body = {
  flags?: number
  content?: string
  components?: { type: number; content?: string }[]
}

const replyBody = async (t: TestBotApp, payload: unknown): Promise<V2Body> =>
  (await replyTo(t, payload, 5000)).body as V2Body

const TEXT_DISPLAY = 10
const MEDIA_GALLERY = 12
const textsOf = (body: V2Body): string[] =>
  (body.components ?? []).filter(c => c.type === TEXT_DISPLAY).map(c => c.content ?? '')

const report = (overrides: Partial<ButtonReportInput>): ButtonReportInput => ({
  lineId: 'burbank',
  cab: 2,
  side: 1,
  button: 3,
  kind: 'broken',
  description: 'dead',
  reporter: 'device:a',
  ...overrides,
})

describe('/buttons', () => {
  test('replies publicly in Components V2 and says everything works', async () => {
    const t = await createTestBotApp()
    const body = await replyBody(t, commandInteraction('buttons', [['arcade', 'burbank']]))
    expect(callbacks(t.discord.calls)).toEqual([{ type: 5, data: {} }])
    expect((body.flags ?? 0) & COMPONENTS_V2).toBe(COMPONENTS_V2)
    expect((body.flags ?? 0) & EPHEMERAL).toBe(0)
    expect(body.components?.map(c => c.type)).toEqual([MEDIA_GALLERY])
    expect(textsOf(body)).toEqual([])
  })

  test('lists reported problems per cabinet', async () => {
    const t = await createTestBotApp()
    await t.deps.buttons.submit(report({}))
    await t.deps.buttons.submit(report({ reporter: 'device:b' }))
    await t.deps.buttons.submit(report({ cab: 1, side: 2, button: 5 }))
    const body = await replyBody(t, commandInteraction('buttons', [['arcade', 'burbank']]))
    expect(body.components?.map(c => c.type)).toEqual([MEDIA_GALLERY, TEXT_DISPLAY])
    expect(textsOf(body)).toEqual([
      '**Cab 1**\n`2P` ⚪ **5** pending\n\n**Cab 2**\n`1P` 🔴 **3** broken',
    ])
  })

  test("uses the channel's arcade when none is given", async () => {
    const t = await createTestBotApp()
    await t.statusMessages.replaceForChannel({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      messageId: '700',
      lineIds: ['temecula'],
    })
    const body = await replyBody(t, commandInteraction('buttons', []))
    expect(textsOf(body)).toEqual([])
  })

  test('asks for an arcade privately, without deferring, in an unmapped channel', async () => {
    const t = await createTestBotApp()
    await t.send(commandInteraction('buttons', []))
    await waitFor(() => callbacks(t.discord.calls).length > 0, 'the reply')
    expect(callbacks(t.discord.calls)).toEqual([
      { type: 4, data: { content: NO_ARCADE, flags: EPHEMERAL } },
    ])
    expect(edits(t.discord.calls)).toEqual([])
  })

  test('says something went wrong, privately, when the channel lookup fails', async () => {
    const t = await createTestBotApp()
    spyOn(t.statusMessages, 'forChannel').mockRejectedValue(new Error('db down'))
    const logged: unknown[] = []
    spyOn(t.deps.logger, 'error').mockImplementation((details: unknown) => {
      logged.push(details)
    })
    await t.send(commandInteraction('buttons', []))
    await waitFor(() => callbacks(t.discord.calls).length > 0, 'the reply')
    expect(callbacks(t.discord.calls)).toEqual([
      {
        type: 4,
        data: { content: 'Something went wrong on our side. Try again in a minute.', flags: 64 },
      },
    ])
    expect(logged).toEqual([expect.objectContaining({ interaction: '/buttons' })])
  })
})

type Where = { lineId: string; cab: number; side: Side; button: number }
type Pending = { kind: ReportKind; votes: number }

const settled = (where: Where, confirmed: 'unreliable' | 'broken'): ButtonState => ({
  ...where,
  status: confirmed,
  confirmed,
  pending: null,
  pendingVotes: 0,
  recent: [],
})

const pending = (
  where: Where,
  confirmed: 'good' | 'unreliable' | 'broken',
  vote: Pending
): ButtonState => ({
  ...where,
  status: 'pending',
  confirmed,
  pending: vote.kind,
  pendingVotes: vote.votes,
  recent: [],
})

const GAP = '\u2003'

const main = (cab: number, side: Side, button: number): Where => ({
  lineId: 'lakewood:main',
  cab,
  side,
  button,
})

describe('buttonsMessage', () => {
  test('orders sides before buttons and folds a whole cab down into one line', () => {
    const message = buttonsMessage(arcade('lakewood'), [
      settled(main(2, 2, 1), 'broken'),
      settled(main(2, 2, 0), 'unreliable'),
      pending(main(2, 1, 5), 'unreliable', { kind: 'works', votes: 1 }),
      pending(main(2, 1, 0), 'good', { kind: 'unreliable', votes: 1 }),
      pending(main(1, 2, 2), 'good', { kind: 'broken', votes: 1 }),
      settled(main(1, 1, 3), 'broken'),
      settled(main(1, 2, 0), 'broken'),
      settled(main(1, 1, 0), 'broken'),
    ])
    expect(message.heading).toBe(
      '## Round1 Lakewood\n' +
        '-# 2 sides down, 1 side acting up, 1 side pending, ' +
        '2 broken, 1 unreliable, 1 pending buttons'
    )
    expect(message.cabinets).toBe(
      [
        '**Main cab 1**',
        '🔴 **Whole cab down**',
        '`1P` 🔴 **3** broken',
        '`2P` ⚪ **2** pending',
        '',
        '**Main cab 2**',
        `\`1P\` ⚪ side pending${GAP}🟡 **5** unreliable`,
        `\`2P\` 🟡 side acting up${GAP}🔴 **1** broken`,
      ].join('\n')
    )
  })

  test('calls a lone cab "Cab"', () => {
    const where = { lineId: '2nd-loop', cab: 1, side: 1 as const }
    const message = buttonsMessage(arcade('2nd-loop'), [
      settled({ ...where, button: 0 }, 'broken'),
      settled({ ...where, button: 1 }, 'unreliable'),
    ])
    expect(message.cabinets).toBe(`**Cab**\n\`1P\` 🔴 side down${GAP}🟡 **1** unreliable`)
  })

  test('shows pending over good as ⚪ pending, over a problem as the confirmed status', () => {
    const where = { lineId: '2nd-loop', cab: 1, side: 1 as const }
    const message = buttonsMessage(arcade('2nd-loop'), [
      pending({ ...where, button: 1 }, 'good', { kind: 'broken', votes: 1 }),
      pending({ ...where, button: 2 }, 'broken', { kind: 'works', votes: 1 }),
      pending({ ...where, button: 3 }, 'unreliable', { kind: 'broken', votes: 2 }),
    ])
    expect(message.cabinets).toBe(
      `**Cab**\n\`1P\` ⚪ **1** pending${GAP}🔴 **2** broken${GAP}🟡 **3** unreliable`
    )
  })

  test('does not fold a cab with one side down', () => {
    const message = buttonsMessage(arcade('burbank'), [
      settled({ lineId: 'burbank', cab: 1, side: 1, button: 0 }, 'broken'),
    ])
    expect(message.cabinets).toBe('**Cab 1**\n`1P` 🔴 side down')
  })

  test('has no cabinet text when everything works', () => {
    expect(buttonsMessage(arcade('burbank'), []).cabinets).toBeNull()
  })

  test('caps the text at the Discord limit and says how many more need attention', () => {
    const puenteHills = arcade('puente-hills')
    const [line] = puenteHills.lines
    if (!line) throw new Error('test setup: no Puente Hills line')
    const BUTTONS_PER_SIDE = 60
    const states: ButtonState[] = []
    for (let cab = 1; cab <= line.cabs; cab++) {
      for (const side of SIDES) {
        for (let button = 1; button <= BUTTONS_PER_SIDE; button++) {
          states.push(settled({ lineId: line.id, cab, side, button }, 'broken'))
        }
      }
    }

    const message = buttonsMessage(puenteHills, states)

    const cabinets = message.cabinets ?? ''
    expect(message.heading.length + cabinets.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH)
    const trailer = cabinets.match(/\n-# …and (\d+) more need attention$/)
    expect(trailer).not.toBeNull()
    const listed = cabinets.match(/🔴 \*\*\d+\*\* broken/g)?.length ?? 0
    expect(listed + Number(trailer?.[1])).toBe(states.length)
  })
})
