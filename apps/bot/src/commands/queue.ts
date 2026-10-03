import {
  ApplicationCommandOptionType,
  Command,
  Row,
  type CommandInteraction,
  type CommandOptions,
  type MessagePayload,
} from '@buape/carbon'
import { soleLine } from '@maiq/core/arcades'
import { parseCount } from '@maiq/core/count'
import { PickLineButton } from '@maiq/bot/components/pick-line-button'
import type { BotDeps } from '@maiq/bot/deps'
import {
  arcadeOption,
  describeWrite,
  discordReport,
  replySafely,
  requireUser,
  targetArcade,
} from '@maiq/bot/replies'

const NO_ARCADE =
  'This channel has no arcade set up. Add the arcade option, ' +
  'like /q count:4p2q arcade:Round1 Lakewood.'

export class QueueCommand extends Command {
  name = 'q'
  override description = 'Report the queue at an arcade, like 4p2q'
  override options: CommandOptions

  constructor(private readonly deps: BotDeps) {
    super()
    this.options = [
      {
        name: 'count',
        description: 'Playing and queueing, like 4p2q',
        type: ApplicationCommandOptionType.String,
        required: true,
        max_length: 12,
      },
      arcadeOption(deps.statusMessages, {
        description: "Which arcade. Defaults to this channel's arcade.",
        required: false,
      }),
    ]
  }

  async run(interaction: CommandInteraction): Promise<void> {
    await interaction.defer({ ephemeral: true })
    await replySafely(interaction, this.deps.logger, '/q', () => this.respond(interaction))
  }

  private async respond(interaction: CommandInteraction): Promise<MessagePayload> {
    const parsed = parseCount(interaction.options.getString('count', true))
    if (!parsed.ok) return { content: parsed.reason }
    const arcade = await targetArcade(interaction, this.deps.statusMessages)
    if (!arcade) return { content: NO_ARCADE }
    const user = requireUser(interaction)
    const only = soleLine(arcade)
    if (only) {
      const result = await this.deps.queue.submitReport(discordReport(only, parsed.count, user))
      return { content: describeWrite(only, result, 'Updated') }
    }
    return {
      content: `Which line at ${arcade.name}?`,
      components: [
        new Row(arcade.lines.map(line => new PickLineButton(this.deps, line, parsed.count))),
      ],
    }
  }
}
