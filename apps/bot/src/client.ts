import { Client, type Plugin } from '@buape/carbon'
import { ChatListener, GatewayReadyListener } from '@maiq/bot/chat/listener'
import { ButtonsCommand } from '@maiq/bot/commands/buttons'
import { QueueCommand } from '@maiq/bot/commands/queue'
import { SetupCommand } from '@maiq/bot/commands/setup'
import { ConfirmButton } from '@maiq/bot/components/confirm-button'
import { PickLineButton } from '@maiq/bot/components/pick-line-button'
import { ReportModal } from '@maiq/bot/components/report-modal'
import { UpdateButton } from '@maiq/bot/components/update-button'
import type { BotDeps } from '@maiq/bot/deps'

export type DiscordFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type BotConfig = {
  applicationId: string
  publicKey: string
  token: string
  publicUrl: string
  fetch?: DiscordFetch
}

const USER_AGENT = 'DiscordBot (https://github.com/socal-maimai/maiq, 0.1.0)'
const DISCORD_API = 'https://discord.com/api/v10'

const withUserAgent =
  (send: DiscordFetch): DiscordFetch =>
  (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('User-Agent', USER_AGENT)
    return send(input, { ...init, headers })
  }

export function createDiscordClient(
  config: BotConfig,
  deps: BotDeps,
  gateway: Plugin | null = null
): Client {
  return new Client(
    {
      baseUrl: `${config.publicUrl}/discord`,
      clientId: config.applicationId,
      publicKey: config.publicKey,
      token: config.token,
      disableDeployRoute: true,
      requestOptions: {
        baseUrl: DISCORD_API,
        fetch: withUserAgent(config.fetch ?? ((input, init) => fetch(input, init))),
      },
    },
    {
      commands: [new QueueCommand(deps), new SetupCommand(deps), new ButtonsCommand(deps)],
      components: [
        new PickLineButton(deps, null, null),
        new ConfirmButton(deps, null, null),
        new UpdateButton(deps, null),
      ],
      modals: [new ReportModal(deps, null)],
      listeners: gateway ? [new ChatListener(deps), new GatewayReadyListener(deps)] : [],
    },
    gateway ? [gateway] : []
  )
}
