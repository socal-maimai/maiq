import type { CommandInteraction, MessagePayload } from '@buape/carbon'
import {
  ARCADES,
  arcadeOfLine,
  findArcade,
  findLine,
  lineName,
  type Arcade,
  type Line,
} from '@maiq/core/arcades'
import { cabsText } from '@maiq/core/caps'
import { formatCount, type Count } from '@maiq/core/count'
import type { ConfirmInput, ReportInput, WriteResult } from '@maiq/core/queue'
import { retryText } from '@maiq/core/retry'
import type { BotLogger, StatusMessageStore } from '@maiq/bot/deps'

export const SOMETHING_WENT_WRONG = 'Something went wrong on our side. Try again in a minute.'
export const OUT_OF_DATE = 'That button is out of date. Post the count in chat or use /q.'

export const ARCADE_CHOICES = ARCADES.map(arcade => ({ name: arcade.name, value: arcade.id }))

export function describeWrite(
  line: Line,
  result: WriteResult,
  verb: 'Updated' | 'Confirmed'
): string {
  const name = lineName(line)
  if (result.ok) {
    return result.state.count
      ? `${verb} ${name}: ${formatCount(result.state.count)}`
      : `${verb} ${name}.`
  }
  switch (result.error) {
    case 'unknownLine':
      return 'That arcade line no longer exists.'
    case 'playersOverCap':
      return `${name} has ${cabsText(line)}, so at most ${result.maxPlayers} players.`
    case 'queueOverCap':
      return `The queue can be at most ${result.maxQueue}.`
    case 'rateLimited':
      return `You updated ${name} a moment ago. ${retryText(result.retryAfterMs)}`
    case 'nothingToConfirm':
      return `${name} has no recent report to confirm. Use Update instead.`
  }
}

export const discordReport = (line: Line, count: Count, userId: string): ReportInput => ({
  lineId: line.id,
  count,
  source: 'discord',
  reporter: `discord:${userId}`,
  inGeofence: null,
})

export const discordConfirm = (line: Line, userId: string): ConfirmInput => ({
  lineId: line.id,
  source: 'discord',
  reporter: `discord:${userId}`,
  inGeofence: null,
})

export function requireUserId(interaction: { userId: string | undefined }): string {
  if (!interaction.userId) throw new Error('Discord interaction arrived without a user id')
  return interaction.userId
}

export async function targetArcade(
  interaction: CommandInteraction,
  statusMessages: StatusMessageStore
): Promise<Arcade | undefined> {
  const chosen = interaction.options.getString('arcade')
  if (chosen) return findArcade(chosen)
  const channelId = interaction.rawData.channel?.id
  if (!channelId) return undefined
  return channelArcade(statusMessages, channelId)
}

export async function channelArcade(
  statusMessages: StatusMessageStore,
  channelId: string
): Promise<Arcade | undefined> {
  const [mapped] = await statusMessages.forChannel(channelId)
  const line = mapped ? findLine(mapped.lineId) : undefined
  return line ? arcadeOfLine(line) : undefined
}

type Replyable = { reply(data: MessagePayload): Promise<unknown> }

export function logInteractionFailure(logger: BotLogger, error: unknown, what: string): void {
  logger.error({ err: error, interaction: what }, 'Discord interaction failed')
}

export async function replySafely(
  interaction: Replyable,
  logger: BotLogger,
  what: string,
  build: () => Promise<MessagePayload>
): Promise<void> {
  let payload: MessagePayload
  try {
    payload = await build()
  } catch (error) {
    logInteractionFailure(logger, error, what)
    payload = { content: SOMETHING_WENT_WRONG }
  }
  await interaction.reply(payload)
}
