import { describe, expect, test } from 'bun:test'
import { ADMIN_ID, createTestApp, ORIGIN } from 'maiq-tests-api/support/app'

type TestApp = Awaited<ReturnType<typeof createTestApp>>

const cookiesOf = (res: Response): string[] => res.headers.getSetCookie()

const cookieValue = (res: Response, name: string): string | undefined =>
  cookiesOf(res)
    .find(cookie => cookie.startsWith(`${name}=`))
    ?.split(';')[0]
    ?.slice(name.length + 1)

async function startSignIn(t: TestApp) {
  const res = await t.app.request('/auth/discord')
  const location = new URL(res.headers.get('location') ?? '')
  const state = location.searchParams.get('state') ?? ''
  return { res, location, state, stateCookie: `maiq_oauth_state=${state}` }
}

const callback = (t: TestApp, query: string, cookie?: string) =>
  t.app.request(`/auth/discord/callback?${query}`, cookie ? { headers: { cookie } } : {})

describe('Discord sign-in', () => {
  test('sends the browser to Discord asking only for the identify scope', async () => {
    const t = await createTestApp()
    const { res, location, state } = await startSignIn(t)
    expect(res.status).toBe(302)
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize')
    expect(location.searchParams.get('scope')).toBe('identify')
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/auth/discord/callback`)
    expect(state.length).toBeGreaterThan(16)
    const stateCookie = cookiesOf(res).find(cookie => cookie.startsWith('maiq_oauth_state='))
    expect(stateCookie).toContain('HttpOnly')
    expect(stateCookie).toContain('Secure')
  })

  test('signs in an allowed Discord user and opens the dashboard', async () => {
    const t = await createTestApp()
    const { state, stateCookie } = await startSignIn(t)
    const res = await callback(t, `code=abc&state=${state}`, stateCookie)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/admin')
    const session = cookieValue(res, 'maiq_admin')
    expect(session).toBeTruthy()

    const me = await t.app.request('/api/v1/admin/session', {
      headers: { cookie: `maiq_admin=${session}` },
    })
    expect(await me.json()).toMatchObject({ data: { id: ADMIN_ID, name: 'admin' } })
  })

  test('refuses a Discord user who is not on the admin list', async () => {
    const t = await createTestApp()
    t.login.user = { id: '999999999999999999', username: 'troll' }
    const { state, stateCookie } = await startSignIn(t)
    const res = await callback(t, `code=abc&state=${state}`, stateCookie)
    expect(res.headers.get('location')).toBe('/admin?error=notAdmin')
    expect(cookieValue(res, 'maiq_admin')).toBeFalsy()
  })

  test('rejects a callback whose state does not match without calling Discord', async () => {
    const t = await createTestApp()
    const { stateCookie } = await startSignIn(t)
    const res = await callback(t, 'code=abc&state=forged', stateCookie)
    expect(res.headers.get('location')).toBe('/admin?error=expired')
    expect(t.login.calls).toEqual([])
  })

  test('rejects a callback that arrives without the state cookie', async () => {
    const t = await createTestApp()
    const { state } = await startSignIn(t)
    const res = await callback(t, `code=abc&state=${state}`)
    expect(res.headers.get('location')).toBe('/admin?error=expired')
  })

  test('reports a Discord failure instead of signing in', async () => {
    const t = await createTestApp()
    t.login.user = null
    const { state, stateCookie } = await startSignIn(t)
    const res = await callback(t, `code=abc&state=${state}`, stateCookie)
    expect(res.headers.get('location')).toBe('/admin?error=discord')
    expect(cookieValue(res, 'maiq_admin')).toBeFalsy()
  })

  test('treats a declined consent screen as cancelled', async () => {
    const t = await createTestApp()
    const { state, stateCookie } = await startSignIn(t)
    const res = await callback(t, `error=access_denied&state=${state}`, stateCookie)
    expect(res.headers.get('location')).toBe('/admin?error=cancelled')
  })
})

const session = (t: TestApp, cookie: string) =>
  t.app.request('/api/v1/admin/session', { headers: { cookie } })

describe('admin sessions', () => {
  test('rejects admin requests without a session', async () => {
    const t = await createTestApp()
    const res = await t.app.request('/api/v1/admin/reports')
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ kind: 'badSignedOut' })
  })

  test('rejects a tampered session cookie', async () => {
    const t = await createTestApp()
    const [payload = '', signature = ''] = t.adminCookie().split('.')
    const flipped = signature.startsWith('A') ? `B${signature.slice(1)}` : `A${signature.slice(1)}`
    expect((await session(t, `${payload}.${flipped}`)).status).toBe(401)
  })

  test('rejects a session after it expires', async () => {
    const t = await createTestApp()
    const cookie = t.adminCookie()
    t.clock.advance(8 * 24 * 60 * 60_000)
    expect((await session(t, cookie)).status).toBe(401)
  })

  test('rejects a validly signed session for someone not on the admin list', async () => {
    const t = await createTestApp()
    expect((await session(t, t.adminCookie('999999999999999999'))).status).toBe(401)
  })

  test('rejects admin writes from another origin', async () => {
    const t = await createTestApp()
    const res = await t.app.request('/api/v1/admin/mutes', {
      method: 'POST',
      headers: {
        cookie: t.adminCookie(),
        origin: 'https://evil.test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reporter: 'device:x', muted: true }),
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ kind: 'badOrigin' })
  })

  test('signs out only from the same origin', async () => {
    const t = await createTestApp()
    const foreign = await t.app.request('/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://evil.test' },
    })
    expect(foreign.status).toBe(403)
    const res = await t.app.request('/auth/logout', { method: 'POST', headers: { origin: ORIGIN } })
    expect(res.status).toBe(204)
    expect(cookiesOf(res).find(cookie => cookie.startsWith('maiq_admin='))).toContain('Max-Age=0')
  })
})
