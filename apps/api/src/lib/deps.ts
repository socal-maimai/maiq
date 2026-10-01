import type { ButtonService } from '@maiq/core/button-service'
import type { QueueService } from '@maiq/core/queue'
import type { Database } from '@maiq/db'
import type { AdminAuth } from '@maiq/api/lib/admin-auth'
import type { ButtonEvents, LineEvents } from '@maiq/api/lib/events'
import type { Logger } from '@maiq/api/lib/logger'
import type { ModerationService } from '@maiq/api/services/moderation'

export type TurnstileVerifier = (token: string, ip: string | null) => Promise<boolean>

export type AppDeps = {
  db: Database
  logger: Logger
  events: LineEvents
  buttonEvents: ButtonEvents
  queue: QueueService
  buttons: ButtonService
  turnstileSiteKey: string
  verifyTurnstile: TurnstileVerifier
  discordHandler: ((request: Request) => Promise<Response>) | null
  adminAuth: AdminAuth | null
  moderation: ModerationService
}
