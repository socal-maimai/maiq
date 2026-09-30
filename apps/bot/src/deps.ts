import type { ButtonService } from '@maiq/core/button-service'
import type { QueueService } from '@maiq/core/queue'

export type StatusMessage = {
  lineId: string
  guildId: string
  channelId: string
  messageId: string
}

export type StatusMessageStore = {
  forChannel(channelId: string): Promise<StatusMessage[]>
  forLine(lineId: string): Promise<StatusMessage[]>
  replaceForChannel(input: {
    guildId: string
    channelId: string
    messageId: string
    lineIds: readonly string[]
  }): Promise<StatusMessage[]>
  removeMessage(messageId: string): Promise<void>
}

export type BotLogger = {
  error(details: object, message: string): void
  warn(details: object, message: string): void
  info(details: object, message: string): void
}

export type BotDeps = {
  queue: QueueService
  buttons: ButtonService
  statusMessages: StatusMessageStore
  logger: BotLogger
}
