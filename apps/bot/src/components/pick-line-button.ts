import {
  Button,
  ButtonStyle,
  Routes,
  type ButtonInteraction,
  type ComponentData,
} from '@buape/carbon'
import type { Line } from '@maiq/core/arcades'
import { formatCount, parseCount, type Count } from '@maiq/core/count'
import { addCheckMark, logChatFailure } from '@maiq/bot/chat/rest'
import { encodeLineId, lineFromData } from '@maiq/bot/custom-ids'
import type { BotDeps } from '@maiq/bot/deps'
import {
  describeWrite,
  discordReport,
  logInteractionFailure,
  OUT_OF_DATE,
  requireUser,
  SOMETHING_WENT_WRONG,
} from '@maiq/bot/replies'

const NOT_YOUR_COUNT = 'Only the person who posted this count can pick the line.'

export class PickLineButton extends Button {
  label: string
  customId: string
  override style = ButtonStyle.Primary

  constructor(
    private readonly deps: BotDeps,
    line: Line | null,
    count: Count | null,
    userId?: string
  ) {
    super()
    this.label = line?.label ?? 'Line'
    const poster = userId ? `;user=${userId}` : ''
    this.customId =
      line && count
        ? `pick:line=${encodeLineId(line.id)};count=${formatCount(count)}${poster}`
        : 'pick'
  }

  override async run(interaction: ButtonInteraction, data: ComponentData): Promise<void> {
    const poster = data['user'] === undefined ? null : String(data['user'])
    if (poster !== null && poster !== interaction.userId) {
      await this.refuse(interaction)
      return
    }
    let content: string | null
    try {
      content = await this.record(interaction, data, poster !== null)
    } catch (error) {
      this.logFailure(error)
      content = SOMETHING_WENT_WRONG
    }
    if (content !== null) await interaction.update({ content, components: [] })
  }

  private async refuse(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.reply({ content: NOT_YOUR_COUNT, ephemeral: true })
    } catch (error) {
      this.logFailure(error)
    }
  }

  private logFailure(error: unknown): void {
    logInteractionFailure(this.deps.logger, error, 'pick line')
  }

  private async record(
    interaction: ButtonInteraction,
    data: ComponentData,
    fromChat: boolean
  ): Promise<string | null> {
    const line = lineFromData(data)
    const parsed = parseCount(String(data['count']))
    if (!line || !parsed.ok) return OUT_OF_DATE
    const result = await this.deps.queue.submitReport(
      discordReport(line, parsed.count, requireUser(interaction))
    )
    if (!result.ok || !fromChat) return describeWrite(line, result, 'Updated')
    await interaction.acknowledge()
    await this.clearPicker(interaction)
    return null
  }

  private async clearPicker(interaction: ButtonInteraction): Promise<void> {
    const picker = interaction.rawData.message
    const channelId = picker.channel_id
    const original = picker.message_reference?.message_id
    try {
      await interaction.client.rest.delete(Routes.channelMessage(channelId, picker.id))
      if (original) await addCheckMark(interaction.client.rest, channelId, original)
    } catch (error) {
      logChatFailure(this.deps, error, { channelId, messageId: original ?? picker.id })
    }
  }
}
