import { Button, ButtonStyle, type ButtonInteraction, type ComponentData } from '@buape/carbon'
import type { Line } from '@maiq/core/arcades'
import { formatCount, type Count } from '@maiq/core/count'
import { lineCustomId, lineFromData } from '@maiq/bot/custom-ids'
import type { BotDeps } from '@maiq/bot/deps'
import {
  describeWrite,
  discordConfirm,
  OUT_OF_DATE,
  replySafely,
  requireUserId,
} from '@maiq/bot/replies'

export class ConfirmButton extends Button {
  label: string
  customId: string
  override style = ButtonStyle.Success
  override disabled: boolean

  constructor(
    private readonly deps: BotDeps,
    line: Line | null,
    count: Count | null
  ) {
    super()
    this.label = count ? `Still ${formatCount(count)}` : 'Nothing to confirm'
    this.disabled = count === null
    this.customId = lineCustomId('confirm', line)
  }

  override async run(interaction: ButtonInteraction, data: ComponentData): Promise<void> {
    await interaction.defer({ ephemeral: true })
    await replySafely(interaction, this.deps.logger, 'confirm button', async () => {
      const line = lineFromData(data)
      if (!line) return { content: OUT_OF_DATE }
      const result = await this.deps.queue.confirm(discordConfirm(line, requireUserId(interaction)))
      return { content: describeWrite(line, result, 'Confirmed') }
    })
  }
}
