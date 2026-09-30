import {
  ApplicationCommandOptionType,
  Command,
  type CommandInteraction,
  type CommandOptions,
  MediaGallery,
  type MessagePayload,
  TextDisplay,
} from '@buape/carbon'
import type { Arcade } from '@maiq/core/arcades'
import type { ButtonState } from '@maiq/core/button-service'
import { renderButtonsPng } from '@maiq/bot/buttons/image'
import { buttonsMessage } from '@maiq/bot/buttons/render'
import type { BotDeps, BotLogger } from '@maiq/bot/deps'
import {
  ARCADE_CHOICES,
  logInteractionFailure,
  replySafely,
  SOMETHING_WENT_WRONG,
  targetArcade,
} from '@maiq/bot/replies'

const NO_ARCADE =
  'This channel has no arcade set up. Add the arcade option, like /buttons arcade:Round1 Lakewood.'

const BUTTONS_IMAGE_NAME = 'buttons.png'

export const MAX_ALT_TEXT_LENGTH = 1024

function altText(arcade: Arcade, summary: string): string {
  const text = `${arcade.name}: ${summary}`
  return text.length <= MAX_ALT_TEXT_LENGTH ? text : `${text.slice(0, MAX_ALT_TEXT_LENGTH - 1)}…`
}

export async function buttonsReply(
  arcade: Arcade,
  states: readonly ButtonState[],
  logger: BotLogger
): Promise<MessagePayload> {
  const message = buttonsMessage(arcade, states)
  const heading = new TextDisplay(message.heading)
  const cabinets = message.cabinets === null ? [] : [new TextDisplay(message.cabinets)]
  let png: Uint8Array
  try {
    png = await renderButtonsPng(arcade, states)
  } catch (error) {
    logger.error({ err: error, arcadeId: arcade.id }, '/buttons image render failed')
    return { components: [heading, ...cabinets] }
  }
  const gallery = new MediaGallery([
    { url: `attachment://${BUTTONS_IMAGE_NAME}`, description: altText(arcade, message.summary) },
  ])
  return {
    components: [gallery, ...cabinets],
    files: [{ name: BUTTONS_IMAGE_NAME, data: new Blob([png], { type: 'image/png' }) }],
  }
}

export class ButtonsCommand extends Command {
  name = 'buttons'
  override description = 'Show which cabinet buttons are unreliable or broken at an arcade'
  override options: CommandOptions = [
    {
      name: 'arcade',
      description: "Which arcade. Defaults to this channel's arcade.",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: ARCADE_CHOICES,
    },
  ]

  constructor(private readonly deps: BotDeps) {
    super()
  }

  async run(interaction: CommandInteraction): Promise<void> {
    const arcade = await this.arcadeOrPrivateReply(interaction)
    if (!arcade) return
    await interaction.defer({ ephemeral: false })
    await replySafely(interaction, this.deps.logger, '/buttons', async () => {
      const states = await this.deps.buttons.buttonStates(arcade.lines.map(line => line.id))
      return buttonsReply(arcade, states, this.deps.logger)
    })
  }

  private async arcadeOrPrivateReply(interaction: CommandInteraction): Promise<Arcade | undefined> {
    let arcade: Arcade | undefined
    try {
      arcade = await targetArcade(interaction, this.deps.statusMessages)
    } catch (error) {
      logInteractionFailure(this.deps.logger, error, '/buttons')
      await interaction.reply({ content: SOMETHING_WENT_WRONG, ephemeral: true })
      return undefined
    }
    if (!arcade) await interaction.reply({ content: NO_ARCADE, ephemeral: true })
    return arcade
  }
}
