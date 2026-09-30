import {
  Label,
  Modal,
  TextInput,
  TextInputStyle,
  type ComponentData,
  type ModalInteraction,
} from '@buape/carbon'
import { lineName, type Line } from '@maiq/core/arcades'
import { lineCustomId, lineFromData } from '@maiq/bot/custom-ids'
import type { BotDeps } from '@maiq/bot/deps'
import {
  describeWrite,
  discordReport,
  OUT_OF_DATE,
  replySafely,
  requireUserId,
} from '@maiq/bot/replies'

const MAX_TITLE_LENGTH = 45
const NOT_NUMBERS = 'Enter whole numbers for playing and queueing, like 4 and 2.'

class PlayersInput extends TextInput {
  customId = 'players'
  override style = TextInputStyle.Short
  override required = true
}

class QueueInput extends TextInput {
  customId = 'queue'
  override style = TextInputStyle.Short
  override required = true
}

class PlayersLabel extends Label {
  label = 'Playing now'
}

class QueueLabel extends Label {
  label = 'Waiting in queue'
}

const parseSmallInt = (text: string): number | null =>
  /^\d{1,2}$/.test(text.trim()) ? Number(text.trim()) : null

export class ReportModal extends Modal {
  title: string
  customId: string
  override components = [new PlayersLabel(new PlayersInput()), new QueueLabel(new QueueInput())]

  constructor(
    private readonly deps: BotDeps,
    line: Line | null
  ) {
    super()
    this.title = line ? `Update ${lineName(line)}`.slice(0, MAX_TITLE_LENGTH) : 'Update the queue'
    this.customId = lineCustomId('report', line)
  }

  async run(interaction: ModalInteraction, data: ComponentData): Promise<void> {
    await interaction.defer({ ephemeral: true })
    await replySafely(interaction, this.deps.logger, 'report modal', async () => {
      const line = lineFromData(data)
      if (!line) return { content: OUT_OF_DATE }
      const players = parseSmallInt(interaction.fields.getText('players', true))
      const queue = parseSmallInt(interaction.fields.getText('queue', true))
      if (players === null || queue === null) return { content: NOT_NUMBERS }
      const result = await this.deps.queue.submitReport(
        discordReport(line, { players, queue }, requireUserId(interaction))
      )
      return { content: describeWrite(line, result, 'Updated') }
    })
  }
}
