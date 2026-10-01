import path from 'node:path'
import { createBot } from '@maiq/bot'
import { isTurnstileTestSecret, loadConfig } from '@maiq/config'
import type { ButtonState } from '@maiq/core/button-service'
import type { LineState } from '@maiq/core/state'
import { createDatabase } from '@maiq/db'
import { createApp } from '@maiq/api/app'
import { createAdminAuth } from '@maiq/api/lib/admin-auth'
import { createEvents } from '@maiq/api/lib/events'
import { createLogger } from '@maiq/api/lib/logger'
import { runMigrations } from '@maiq/api/lib/migrations'
import { shutdown } from '@maiq/api/lib/shutdown'
import { createTurnstileVerifier } from '@maiq/api/lib/turnstile'
import { createButtonService } from '@maiq/api/services/buttons'
import { createModerationService } from '@maiq/api/services/moderation'
import { createQueueService } from '@maiq/api/services/queue'
import { createStatusMessageStore } from '@maiq/api/services/status-messages'

const IDLE_TIMEOUT_SECONDS = 60
const FLUSH_DEADLINE_MS = 5000
const DEFAULT_CONFIG_DIR = path.join(import.meta.dir, '..', '..', '..', 'maiq.d')

async function main(): Promise<void> {
  const config = loadConfig({
    dir: process.env['MAIQ_CONFIG_DIR'] ?? DEFAULT_CONFIG_DIR,
    env: process.env,
  })
  const logger = createLogger(config.logLevel)
  await runMigrations(config.databaseUrl, logger)

  const { client, db } = createDatabase(config.databaseUrl)
  const events = createEvents<LineState>(error => {
    logger.error({ err: error }, 'A line event listener failed')
  })
  const queue = createQueueService({ db, events, now: () => new Date() })
  const buttonEvents = createEvents<ButtonState>(error => {
    logger.error({ err: error }, 'A button event listener failed')
  })
  const buttons = createButtonService({ db, events: buttonEvents, now: () => new Date() })

  const bot = config.discord
    ? createBot(
        { ...config.discord, publicUrl: config.publicUrl },
        { queue, buttons, statusMessages: createStatusMessageStore(db), logger },
        { gateway: true }
      )
    : null
  if (bot) {
    bot.publishOn(events, buttonEvents)
  } else {
    logger.warn('Discord is not configured (MAIQ_DISCORD_*), so the bot is off')
  }

  const adminAuth = config.admin
    ? createAdminAuth({
        clientId: config.admin.clientId,
        clientSecret: config.admin.clientSecret,
        sessionSecret: config.admin.sessionSecret,
        ids: config.admin.ids,
        publicUrl: config.publicUrl,
        logger,
        now: () => new Date(),
      })
    : null
  if (!adminAuth) logger.warn('Admin sign-in is not configured (MAIQ_ADMIN_IDS), so /admin is off')

  const app = createApp({
    db,
    logger,
    events,
    buttonEvents,
    queue,
    buttons,
    turnstileSiteKey: config.turnstile.siteKey,
    verifyTurnstile: createTurnstileVerifier({
      secret: config.turnstile.secret,
      expectedHostname: isTurnstileTestSecret(config.turnstile.secret)
        ? null
        : new URL(config.publicUrl).hostname,
      logger,
    }),
    discordHandler: bot ? request => bot.handleInteraction(request) : null,
    adminAuth,
    moderation: createModerationService({ db, events, buttonEvents, now: () => new Date() }),
  })
  const server = Bun.serve({
    port: config.port,
    fetch: app.fetch,
    idleTimeout: IDLE_TIMEOUT_SECONDS,
  })
  logger.info({ port: server.port }, 'maiq API listening')

  let shuttingDown = false
  const onSignal = async (signal: string) => {
    if (shuttingDown) process.exit(1)
    shuttingDown = true
    logger.info({ signal }, 'Shutting down')
    try {
      await shutdown({ server, bot, database: client, logger, flushDeadlineMs: FLUSH_DEADLINE_MS })
      process.exit(0)
    } catch (error) {
      logger.error({ err: error, signal }, 'Failed to shut down cleanly')
      process.exit(1)
    }
  }
  process.on('SIGTERM', () => void onSignal('SIGTERM'))
  process.on('SIGINT', () => void onSignal('SIGINT'))
}

if (import.meta.main) await main()
