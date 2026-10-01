import type { Hono } from 'hono'
import pino from 'pino'
import { createBot } from '@maiq/bot'
import { ChatListener } from '@maiq/bot/chat/listener'
import type { ButtonState } from '@maiq/core/button-service'
import type { LineState } from '@maiq/core/state'
import { createApp } from '@maiq/api/app'
import { createAdminAuth } from '@maiq/api/lib/admin-auth'
import { signSession, SESSION_COOKIE, SESSION_TTL_MS } from '@maiq/api/lib/admin-session'
import type { AppDeps } from '@maiq/api/lib/deps'
import { createEvents } from '@maiq/api/lib/events'
import { createButtonService } from '@maiq/api/services/buttons'
import { createModerationService } from '@maiq/api/services/moderation'
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
export const ADMIN_ID = '123456789012345678'
export const SESSION_SECRET = 'test-session-secret-that-is-32-chars'
export const ORIGIN = 'https://maiq.test'

export type DiscordLogin = { user: { id: string; username: string } | null; calls: string[] }

function fakeDiscordFetch(login: DiscordLogin): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input)
    login.calls.push(url)
    if (!login.user) return new Response('{}', { status: 401 })
    if (url.endsWith('/oauth2/token')) return Response.json({ access_token: 'access' })
    if (url.endsWith('/users/@me')) return Response.json(login.user)
    return new Response('not found', { status: 404 })
  }) as typeof fetch
}

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
  const login: DiscordLogin = { user: { id: ADMIN_ID, username: 'admin' }, calls: [] }
  const adminAuth = createAdminAuth({
    clientId: APPLICATION_ID,
    clientSecret: 'client-secret',
    sessionSecret: SESSION_SECRET,
    ids: [ADMIN_ID],
    publicUrl: ORIGIN,
    logger,
    now: clock.now,
    fetch: fakeDiscordFetch(login),
  })
  const moderation = createModerationService({ db, events, buttonEvents, now: clock.now })
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
    adminAuth,
    moderation,
  }
  const adminCookie = (id = ADMIN_ID) => {
    const session = { id, name: 'admin', expiresAt: clock.now().getTime() + SESSION_TTL_MS }
    return `${SESSION_COOKIE}=${signSession(session, SESSION_SECRET)}`
  }
  return {
    app: createApp(deps),
    deps,
    clock,
    db,
    statusMessages,
    discord,
    bot,
    receiveChat,
    login,
    adminCookie,
  }
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
