import type { Client } from '@buape/carbon'
import { GatewayIntents, GatewayPlugin, type GatewayPluginOptions } from '@buape/carbon/gateway'
import type { BotLogger } from '@maiq/bot/deps'

type RetryMs = { first: number; max: number }

const GATEWAY_RETRY_MS: RetryMs = { first: 1000, max: 5 * 60 * 1000 }
const DISALLOWED_INTENTS_CLOSE = 'Fatal gateway close code: 4014'

type ChatGatewayOptions = {
  retryMs?: RetryMs
  webSocketFactory?: GatewayPluginOptions['webSocketFactory']
}

export class ChatGateway extends GatewayPlugin {
  private readonly retryMs: RetryMs
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private stopped = false

  constructor(
    private readonly logger: BotLogger,
    options: ChatGatewayOptions = {}
  ) {
    const retryMs = options.retryMs ?? GATEWAY_RETRY_MS
    super({
      intents: GatewayIntents.Guilds | GatewayIntents.GuildMessages | GatewayIntents.MessageContent,
      autoInteractions: false,
      reconnect: { baseDelay: retryMs.first, maxDelay: retryMs.max, maxAttempts: Infinity },
      ...(options.webSocketFactory ? { webSocketFactory: options.webSocketFactory } : {}),
    })
    this.retryMs = retryMs
    this.emitter.on('error', (error: unknown) => this.logError(error))
  }

  override async registerClient(client: Client): Promise<void> {
    await this.start(client, this.retryMs.first)
  }

  override disconnect(): void {
    this.stopped = true
    clearTimeout(this.retryTimer)
    super.disconnect()
  }

  private logError(error: unknown): void {
    if (error instanceof Error && error.message === DISALLOWED_INTENTS_CLOSE) {
      this.logger.error(
        { err: error },
        'Discord refused the gateway intents (close code 4014), so chat counts are off. ' +
          'Enable Message Content Intent under Bot in the Discord Developer Portal, then restart.'
      )
      return
    }
    this.logger.error({ err: error }, 'Discord gateway error')
  }

  private async start(client: Client, delayMs: number): Promise<void> {
    if (this.stopped) return
    try {
      await super.registerClient(client)
    } catch (error) {
      if (this.stopped) return
      this.logger.error({ err: error, retryInMs: delayMs }, 'Discord gateway failed to start')
      const next = Math.min(delayMs * 2, this.retryMs.max)
      this.retryTimer = setTimeout(() => void this.start(client, next), delayMs)
    }
  }
}
