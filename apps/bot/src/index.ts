import type { Client, Context } from '@buape/carbon'
import type { ButtonState } from '@maiq/core/button-service'
import { isStation } from '@maiq/core/buttons'
import type { LineState } from '@maiq/core/state'
import { ChatGateway } from '@maiq/bot/chat/gateway'
import { createDiscordClient, type BotConfig } from '@maiq/bot/client'
import type { BotDeps } from '@maiq/bot/deps'
import { createStatusPublisher, type StatusPublisher } from '@maiq/bot/status/publisher'

export type { BotConfig } from '@maiq/bot/client'
export type { BotDeps, StatusMessage, StatusMessageStore } from '@maiq/bot/deps'
export type { StatusPublisher } from '@maiq/bot/status/publisher'

const STATUS_EDIT_DELAY_MS = 5000

type Subscribable<T> = { subscribe(listener: (value: T) => void): unknown }

export type Bot = {
  client: Client
  publisher: StatusPublisher
  publishOn(lineEvents: Subscribable<LineState>, buttonEvents: Subscribable<ButtonState>): void
  handleInteraction(request: Request): Promise<Response>
  disconnect(): void
}

export function createBot(
  config: BotConfig,
  deps: BotDeps,
  options: { statusDelayMs?: number; gateway?: boolean } = {}
): Bot {
  const gateway = options.gateway ? new ChatGateway(deps.logger) : null
  const client = createDiscordClient(config, deps, gateway)
  const ctx: Context = {
    waitUntil: promise => {
      promise.catch((error: unknown) => {
        deps.logger.error({ err: error }, 'Discord interaction handler failed')
      })
    },
  }
  const publisher = createStatusPublisher({
    client,
    deps,
    delayMs: options.statusDelayMs ?? STATUS_EDIT_DELAY_MS,
  })
  return {
    client,
    publisher,
    publishOn(lineEvents, buttonEvents) {
      lineEvents.subscribe(state => publisher.schedule(state.lineId))
      buttonEvents.subscribe(state => {
        if (isStation(state)) publisher.schedule(state.lineId)
      })
    },
    handleInteraction: request => client.handleInteractionsRequest(request, ctx),
    disconnect: () => gateway?.disconnect(),
  }
}
