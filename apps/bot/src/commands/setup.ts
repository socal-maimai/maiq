import {
  ApplicationCommandOptionType,
  Command,
  Permission,
  type APIInteractionGuildMember,
  type CommandInteraction,
  type CommandOptions,
  type MessagePayload,
} from '@buape/carbon'
import { findArcade } from '@maiq/core/arcades'
import type { BotDeps } from '@maiq/bot/deps'
import { ARCADE_CHOICES, replySafely } from '@maiq/bot/replies'
import { deleteMessageIfPresent, postPinnedStatus } from '@maiq/bot/status/rest'
import { discordStatus } from '@maiq/bot/discord-status'

const MISSING_ACCESS =
  'I need View Channel, Send Messages, Pin Messages, Add Reactions, and Read Message History ' +
  'in this channel. Add them and run /setup again.'

const NOT_ALLOWED = 'Only people who can Manage Channels here can run /setup.'

const canManageChannels = (member: APIInteractionGuildMember | undefined): boolean =>
  member !== undefined && (BigInt(member.permissions) & BigInt(Permission.ManageChannels)) !== 0n

export class SetupCommand extends Command {
  name = 'setup'
  override description = 'Post and pin the live queue status for an arcade in this channel'
  override options: CommandOptions = [
    {
      name: 'arcade',
      description: 'The arcade this channel is for',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: ARCADE_CHOICES,
    },
  ]

  constructor(private readonly deps: BotDeps) {
    super()
  }

  async run(interaction: CommandInteraction): Promise<void> {
    await interaction.defer({ ephemeral: true })
    await replySafely(interaction, this.deps.logger, '/setup', () => this.setUp(interaction))
  }

  private async setUp(interaction: CommandInteraction): Promise<MessagePayload> {
    const arcade = findArcade(interaction.options.getString('arcade', true))
    if (!arcade) return { content: 'Unknown arcade.' }
    const channelId = interaction.rawData.channel?.id
    const guildId = interaction.rawData.guild_id
    if (!channelId || !guildId) return { content: 'Run /setup inside a server channel.' }
    const member = interaction.rawData.member
    const isMaiqAdmin = member !== undefined && this.deps.adminIds.includes(member.user.id)
    if (!isMaiqAdmin && !canManageChannels(member)) return { content: NOT_ALLOWED }

    let messageId: string
    try {
      messageId = await postPinnedStatus(interaction.client, this.deps, channelId, arcade)
    } catch (error) {
      const status = discordStatus(error)
      if (status === 403 || status === 404) {
        return { content: MISSING_ACCESS }
      }
      throw error
    }

    const replaced = await this.deps.statusMessages.replaceForChannel({
      guildId,
      channelId,
      messageId,
      lineIds: arcade.lines.map(line => line.id),
    })
    const stale = new Map(replaced.map(row => [row.messageId, row.channelId]))
    stale.delete(messageId)
    await Promise.all(
      [...stale].map(([oldMessageId, oldChannelId]) =>
        deleteMessageIfPresent(interaction.client, oldChannelId, oldMessageId)
      )
    )
    return { content: `Pinned the live ${arcade.name} status here.` }
  }
}
