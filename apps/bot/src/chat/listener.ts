import {
  MessageCreateListener,
  ReadyListener,
  type Client,
  type GatewayMessageCreateDispatchData,
  type ListenerEventData,
} from '@buape/carbon'
import { handleChatMessage, type ChatMessage } from '@maiq/bot/chat/handle-message'
import type { BotDeps } from '@maiq/bot/deps'

const toChatMessage = (raw: GatewayMessageCreateDispatchData): ChatMessage => ({
  id: raw.id,
  channelId: raw.channel_id,
  guildId: raw.guild_id ?? null,
  content: raw.content,
  authorId: raw.author.id,
  authorName: raw.author.username,
  authorIsBot: raw.author.bot === true,
  webhookId: raw.webhook_id ?? null,
})

export class ChatListener extends MessageCreateListener {
  constructor(private readonly deps: BotDeps) {
    super()
  }

  async handle(data: ListenerEventData[this['type']], client: Client): Promise<void> {
    await handleChatMessage(toChatMessage(data.rawMessage), this.deps, client.rest)
  }
}

export class GatewayReadyListener extends ReadyListener {
  constructor(private readonly deps: BotDeps) {
    super()
  }

  handle(data: ListenerEventData[this['type']]): Promise<void> {
    this.deps.logger.info(
      { guilds: data.guilds.length, user: data.user.username },
      'Discord gateway connected'
    )
    return Promise.resolve()
  }
}
