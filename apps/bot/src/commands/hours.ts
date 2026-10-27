import { Command, type CommandInteraction, type CommandOptions } from '@buape/carbon'
import type { Arcade } from '@maiq/core/arcades'
import { formatHours, openState } from '@maiq/core/hours'
import type { BotDeps } from '@maiq/bot/deps'
import { arcadeOption, replySafely, targetArcade, unix } from '@maiq/bot/replies'

const NO_ARCADE =
  'This channel has no arcade set up. Add the arcade option, like /hours arcade:Round1 Lakewood.'

function hoursText(arcade: Arcade, now: Date): string {
  if (!arcade.hours) return `No hours listed for ${arcade.name} yet.`
  const state = openState(arcade.hours, now)
  let status = 'Closed'
  if (state.open) status = `Open now, closes <t:${unix(state.closesAt)}:t>`
  else if (state.opensAt) status = `Closed, opens <t:${unix(state.opensAt)}:R>`
  return [`**${arcade.name}**`, status, ...formatHours(arcade.hours)].join('\n')
}

export class HoursCommand extends Command {
  name = 'hours'
  override description = 'Show the opening hours of an arcade'
  override options: CommandOptions

  constructor(private readonly deps: BotDeps) {
    super()
    this.options = [
      arcadeOption(deps.statusMessages, {
        description: "Which arcade. Defaults to this channel's arcade.",
        required: false,
      }),
    ]
  }

  async run(interaction: CommandInteraction): Promise<void> {
    await replySafely(interaction, this.deps.logger, '/hours', async () => {
      const arcade = await targetArcade(interaction, this.deps.statusMessages)
      return arcade
        ? { content: hoursText(arcade, this.deps.now()) }
        : { content: NO_ARCADE, ephemeral: true }
    })
  }
}
