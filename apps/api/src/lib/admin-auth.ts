import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import {
  readSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signSession,
  type AdminSession,
} from '@maiq/api/lib/admin-session'
import type { Logger } from '@maiq/api/lib/logger'

const DISCORD_API = 'https://discord.com/api/v10'
const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize'
const STATE_COOKIE = 'maiq_oauth_state'
const STATE_TTL_SECONDS = 10 * 60
const CALLBACK_PATH = '/auth/discord/callback'
const DASHBOARD_PATH = '/admin'

export type SignInError = 'cancelled' | 'expired' | 'notAdmin' | 'discord'

export type AdminAuthOptions = {
  clientId: string
  clientSecret: string
  sessionSecret: string
  ids: readonly string[]
  publicUrl: string
  logger: Logger
  now: () => Date
  fetch?: typeof fetch
}

export type AdminAuth = {
  session(c: Context): AdminSession | null
  isSameOrigin(c: Context): boolean
  mount(app: Hono): void
}

type DiscordUser = { id: string; username: string; global_name?: string | null }

const sameText = (a: string, b: string): boolean =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export function createAdminAuth(options: AdminAuthOptions): AdminAuth {
  const doFetch = options.fetch ?? fetch
  const ids = new Set(options.ids)
  const origin = new URL(options.publicUrl).origin
  const redirectUri = `${origin}${CALLBACK_PATH}`
  const secure = origin.startsWith('https:')
  const cookieBase = { httpOnly: true, secure, sameSite: 'Lax' } as const

  const dashboard = (c: Context, error?: SignInError) =>
    c.redirect(error ? `${DASHBOARD_PATH}?error=${error}` : DASHBOARD_PATH)

  async function discordUser(code: string): Promise<DiscordUser> {
    const credentials = Buffer.from(`${options.clientId}:${options.clientSecret}`).toString(
      'base64'
    )
    const tokenResponse = await doFetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    if (!tokenResponse.ok) {
      throw new Error(`Discord token exchange returned ${tokenResponse.status}`)
    }
    const { access_token: accessToken } = (await tokenResponse.json()) as { access_token: string }
    const userResponse = await doFetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!userResponse.ok) throw new Error(`Discord /users/@me returned ${userResponse.status}`)
    return (await userResponse.json()) as DiscordUser
  }

  async function callback(c: Context): Promise<Response> {
    const expected = getCookie(c, STATE_COOKIE)
    deleteCookie(c, STATE_COOKIE, { path: '/auth' })
    if (c.req.query('error')) return dashboard(c, 'cancelled')
    const state = c.req.query('state')
    const code = c.req.query('code')
    if (!expected || !state || !code || !sameText(state, expected)) return dashboard(c, 'expired')
    let user: DiscordUser
    try {
      user = await discordUser(code)
    } catch (error) {
      options.logger.error({ err: error }, 'Discord sign-in failed')
      return dashboard(c, 'discord')
    }
    if (!ids.has(user.id)) {
      options.logger.warn({ discordId: user.id }, 'Discord user is not on MAIQ_ADMIN_IDS')
      return dashboard(c, 'notAdmin')
    }
    const expiresAt = options.now().getTime() + SESSION_TTL_MS
    const session = { id: user.id, name: user.global_name ?? user.username, expiresAt }
    setCookie(c, SESSION_COOKIE, signSession(session, options.sessionSecret), {
      ...cookieBase,
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
    options.logger.info({ discordId: user.id }, 'Admin signed in')
    return dashboard(c)
  }

  const isSameOrigin = (c: Context): boolean => c.req.header('origin') === origin

  return {
    isSameOrigin,
    session(c) {
      const token = getCookie(c, SESSION_COOKIE)
      if (!token) return null
      const session = readSession(token, options.sessionSecret, options.now())
      return session && ids.has(session.id) ? session : null
    },
    mount(app) {
      app.get('/auth/discord', c => {
        const state = randomBytes(16).toString('base64url')
        setCookie(c, STATE_COOKIE, state, {
          ...cookieBase,
          path: '/auth',
          maxAge: STATE_TTL_SECONDS,
        })
        const url = new URL(AUTHORIZE_URL)
        url.search = new URLSearchParams({
          client_id: options.clientId,
          response_type: 'code',
          redirect_uri: redirectUri,
          scope: 'identify',
          state,
          prompt: 'none',
        }).toString()
        return c.redirect(url.toString())
      })
      app.get(CALLBACK_PATH, c => callback(c))
      app.post('/auth/logout', c => {
        if (!isSameOrigin(c)) return c.body(null, 403)
        deleteCookie(c, SESSION_COOKIE, { path: '/', secure })
        return c.body(null, 204)
      })
    },
  }
}
