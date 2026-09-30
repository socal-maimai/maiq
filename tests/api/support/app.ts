import type { Hono } from 'hono'
import pino from 'pino'
import { createBot } from '@maiq/bot'
import { ChatListener } from '@maiq/bot/chat/listener'
import type { ButtonState } from '@maiq/core/button-service'
import type { LineState } from '@maiq/core/state'
import { createApp } from '@maiq/api/app'
import type { AppDeps } from '@maiq/api/lib/deps'
import { createEvents } from '@maiq/api/lib/events'
import { createButtonService } from '@maiq/api/services/buttons'
import { createQueueService } from '@maiq/api/services/queue'
import { createStatusMessageStore } from '@maiq/api/services/status-messages'
import { createClock } from 'maiq-tests-api/support/clock'
import { createTestDatabase } from 'maiq-tests-api/support/database'
import {
  APPLICATION_ID,
  createTestDiscord,
  type GatewayMessage,
} from 'maiq-tests-api/support/discord'

export const PASSING_TOKEN = 'pass'
export const DEVICE_ID = '0b6c7f4e-8e0f-4a37-9d9e-2f1d0c3b4a5e'
export const OTHER_DEVICE_ID = '7d1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b'

export async function createTestApp(options: { bot?: boolean } = {}) {
  const { db } = await createTestDatabase()
  const clock = createClock()
  const logger = pino({ level: 'silent' })
  const events = createEvents<LineState>(error => {
    throw error
  })
  const queue = createQueueService({ db, events, now: clock.now })
  const buttonEvents = createEvents<ButtonState>(error => {
    throw error
  })
  const buttons = createButtonService({ db, events: buttonEvents, now: clock.now })
  const statusMessages = createStatusMessageStore(db)
  const discord = options.bot ? await createTestDiscord() : null
  const botDeps = { queue, buttons, statusMessages, logger }
  const bot = discord
    ? createBot(
        {
          applicationId: APPLICATION_ID,
          publicKey: discord.publicKeyHex,
          token: 'test-token',
          publicUrl: 'https://maiq.test',
          fetch: discord.fetch,
        },
        botDeps,
        { statusDelayMs: 60_000 }
      )
    : null
  const chatListener = new ChatListener(botDeps)
  const receiveChat = async (raw: GatewayMessage): Promise<void> => {
    if (!bot) throw new Error('test setup: receiveChat needs createTestApp({ bot: true })')
    await chatListener.handle(chatListener.parseRawData(raw, bot.client), bot.client)
  }
  bot?.publishOn(events, buttonEvents)
  const deps: AppDeps = {
    db,
    logger,
    events,
    buttonEvents,
    queue,
    buttons,
    turnstileSiteKey: 'test-site-key',
    verifyTurnstile: token => Promise.resolve(token === PASSING_TOKEN),
    discordHandler: bot ? request => bot.handleInteraction(request) : null,
  }
  return { app: createApp(deps), deps, clock, db, statusMessages, discord, bot, receiveChat }
}

export const postJson = (app: Hono, path: string, body: unknown): Promise<Response> =>
  Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )

export const reportBody = (overrides: Record<string, unknown> = {}) => ({
  lineId: 'burbank',
  players: 2,
  queue: 1,
  deviceId: DEVICE_ID,
  turnstileToken: PASSING_TOKEN,
  ...overrides,
})

export async function createTestBotApp() {
  const t = await createTestApp({ bot: true })
  const { discord, bot } = t
  if (!discord || !bot) throw new Error('test setup: bot was not created')
  const send = async (payload: unknown, options: { tamper?: boolean } = {}) =>
    t.app.request(await discord.signedRequest(payload, options))
  return { ...t, discord, bot, send }
}

export type TestBotApp = Awaited<ReturnType<typeof createTestBotApp>>
