import {
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type CommandInteraction,
  type CommandOption,
  type MessagePayload,
} from '@buape/carbon'
import {
  ARCADES,
  arcadeOfLine,
  findLine,
  lineName,
  resolveArcade,
  searchArcades,
  type Arcade,
  type Line,
  type RegionId,
} from '@maiq/core/arcades'
import { cabsText } from '@maiq/core/caps'
import { formatCount, type Count } from '@maiq/core/count'
import { openState } from '@maiq/core/hours'
import type { ConfirmInput, ReportInput, WriteResult } from '@maiq/core/queue'
import { retryText } from '@maiq/core/retry'
import type { BotLogger, StatusMessageStore } from '@maiq/bot/deps'

export const SOMETHING_WENT_WRONG = 'Something went wrong on our side. Try again in a minute.'
export const OUT_OF_DATE = 'That button is out of date. Post the count in chat or use /q.'

const MAX_CHOICES = 25

export const unix = (date: Date): number => Math.floor(date.getTime() / 1000)

export function closedText(arcade: Arcade, now: Date): string | null {
  const state = arcade.hours ? openState(arcade.hours, now) : null
  if (!state || state.open) return null
  if (!state.opensAt) return `${arcade.name} is closed.`
  const opens = unix(state.opensAt)
  return `${arcade.name} is closed. It opens <t:${opens}:R> (<t:${opens}:t>).`
}

export async function guildRegions(
  statusMessages: StatusMessageStore,
  guildId: string | undefined
): Promise<Set<RegionId>> {
  if (!guildId) return new Set()
  const rows = await statusMessages.forGuild(guildId)
  return new Set(
    rows.flatMap(row => {
      const line = findLine(row.lineId)
      return line ? [arcadeOfLine(line).region] : []
    })
  )
}

async function suggestArcades(
  interaction: AutocompleteInteraction,
  statusMessages: StatusMessageStore
): Promise<void> {
  const focused = interaction.options.getFocused()
  const query = typeof focused?.value === 'string' ? focused.value.trim() : ''
  const regions = await guildRegions(statusMessages, interaction.rawData.guild_id)
  const matches = query ? searchArcades(query) : ARCADES
  const arcades = regions.size ? matches.filter(arcade => regions.has(arcade.region)) : matches
  await interaction.respond(
    arcades.slice(0, MAX_CHOICES).map(arcade => ({ name: arcade.name, value: arcade.id }))
  )
}

export const arcadeOption = (
  statusMessages: StatusMessageStore,
  options: { description: string; required: boolean }
): CommandOption => ({
  name: 'arcade',
  description: options.description,
  type: ApplicationCommandOptionType.String,
  required: options.required,
  autocomplete: interaction => suggestArcades(interaction, statusMessages),
})

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

export type DiscordReporter = { id: string; username: string }

export const discordReport = (line: Line, count: Count, user: DiscordReporter): ReportInput => ({
  lineId: line.id,
  count,
  source: 'discord',
  reporter: `discord:${user.id}`,
  reporterName: user.username,
  inGeofence: null,
})

export const discordConfirm = (line: Line, user: DiscordReporter): ConfirmInput => ({
  lineId: line.id,
  source: 'discord',
  reporter: `discord:${user.id}`,
  reporterName: user.username,
  inGeofence: null,
})

export function requireUser(interaction: { user: DiscordReporter | null }): DiscordReporter {
  if (!interaction.user) throw new Error('Discord interaction arrived without a user')
  return { id: interaction.user.id, username: interaction.user.username }
}

export async function targetArcade(
  interaction: CommandInteraction,
  statusMessages: StatusMessageStore
): Promise<Arcade | undefined> {
  const chosen = interaction.options.getString('arcade')
  if (chosen) return resolveArcade(chosen)
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
