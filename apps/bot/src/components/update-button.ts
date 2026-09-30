import { Button, ButtonStyle, type ButtonInteraction, type ComponentData } from '@buape/carbon'
import type { Line } from '@maiq/core/arcades'
import { ReportModal } from '@maiq/bot/components/report-modal'
import { lineCustomId, lineFromData } from '@maiq/bot/custom-ids'
import type { BotDeps } from '@maiq/bot/deps'
import { OUT_OF_DATE } from '@maiq/bot/replies'

export class UpdateButton extends Button {
  label = 'Update'
  customId: string
  override style = ButtonStyle.Secondary

  constructor(
    private readonly deps: BotDeps,
    line: Line | null
  ) {
    super()
    this.customId = lineCustomId('update', line)
  }

  override async run(interaction: ButtonInteraction, data: ComponentData): Promise<void> {
    const line = lineFromData(data)
    if (!line) {
      await interaction.reply({ content: OUT_OF_DATE, ephemeral: true })
      return
    }
    await interaction.showModal(new ReportModal(this.deps, line))
  }
}
