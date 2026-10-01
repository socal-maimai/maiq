import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deepMerge, loadConfig } from '@maiq/config'

let dir = ''

const TEST_SITE_KEY = '1x00000000000000000000AA'
const TEST_SECRET = '1x0000000000000000000000000000000AA'
const DEFAULTS_DIR = path.join(import.meta.dir, '..', '..', 'maiq.d')

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'maiq-config-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const BASE = `port: 3000
logLevel: info
publicUrl: http://localhost:5173
databaseUrl: postgres://maiq:maiq@127.0.0.1:5432/maiq
turnstile:
  siteKey: site
  secret: secret
`

describe('deepMerge', () => {
  test('merges nested objects and skips undefined', () => {
    expect(deepMerge({ a: { b: 1, c: 2 }, d: 3 }, { a: { c: 4 }, d: undefined })).toEqual({
      a: { b: 1, c: 4 },
      d: 3,
    })
  })
})

describe('loadConfig', () => {
  test('reads the defaults file', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const config = loadConfig({ dir, env: {} })
    expect(config.port).toBe(3000)
    expect(config.turnstile).toEqual({ siteKey: 'site', secret: 'secret' })
    expect(config.discord).toBeUndefined()
  })

  test('later files override earlier ones', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    writeFileSync(path.join(dir, '10-local.yaml'), 'port: 4000\n')
    expect(loadConfig({ dir, env: {} }).port).toBe(4000)
  })

  test('env overrides files', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const config = loadConfig({
      dir,
      env: {
        MAIQ_PORT: '5000',
        MAIQ_TURNSTILE_SECRET: 'real-secret',
        MAIQ_DISCORD_APPLICATION_ID: '111',
        MAIQ_DISCORD_PUBLIC_KEY: 'abc',
        MAIQ_DISCORD_TOKEN: 'token',
      },
    })
    expect(config.port).toBe(5000)
    expect(config.turnstile.secret).toBe('real-secret')
    expect(config.discord).toEqual({ applicationId: '111', publicKey: 'abc', token: 'token' })
  })

  test('rejects partial Discord settings', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    expect(() => loadConfig({ dir, env: { MAIQ_DISCORD_TOKEN: 'token' } })).toThrow(/discord/)
  })

  const DISCORD_ENV = {
    MAIQ_DISCORD_APPLICATION_ID: '111',
    MAIQ_DISCORD_PUBLIC_KEY: 'abc',
    MAIQ_DISCORD_TOKEN: 'token',
  }
  const ADMIN_ENV = {
    MAIQ_DISCORD_CLIENT_SECRET: 'client-secret',
    MAIQ_SESSION_SECRET: 's'.repeat(32),
    MAIQ_ADMIN_IDS: ' 123456789012345678, 876543210987654321 ,',
  }

  test('reads the admin settings and splits the admin ID list', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const config = loadConfig({ dir, env: { ...DISCORD_ENV, ...ADMIN_ENV } })
    expect(config.admin).toEqual({
      clientId: '111',
      clientSecret: 'client-secret',
      sessionSecret: 's'.repeat(32),
      ids: ['123456789012345678', '876543210987654321'],
    })
  })

  test('leaves the admin dashboard off when no admin settings are set', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    expect(
      loadConfig({ dir, env: { ...DISCORD_ENV, MAIQ_ADMIN_IDS: ' , ' } }).admin
    ).toBeUndefined()
  })

  test('runs the admin dashboard without the bot when only the application ID is set', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const env = { MAIQ_DISCORD_APPLICATION_ID: '111', ...ADMIN_ENV }
    const config = loadConfig({ dir, env })
    expect(config.discord).toBeUndefined()
    expect(config.admin?.clientId).toBe('111')
  })

  test('rejects admin settings without the application ID', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    expect(() => loadConfig({ dir, env: ADMIN_ENV })).toThrow(/clientId/)
  })

  test('rejects a short session secret', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const env = { ...DISCORD_ENV, ...ADMIN_ENV, MAIQ_SESSION_SECRET: 'short' }
    expect(() => loadConfig({ dir, env })).toThrow(/sessionSecret/)
  })

  test('rejects an admin ID that is not a Discord user ID', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const env = { ...DISCORD_ENV, ...ADMIN_ENV, MAIQ_ADMIN_IDS: 'enscribe' }
    expect(() => loadConfig({ dir, env })).toThrow(/ids/)
  })

  test('explains invalid values', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    expect(() => loadConfig({ dir, env: { MAIQ_PORT: 'abc' } })).toThrow(/port/)
  })

  test('rejects a file that is not a mapping', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), '- a\n- b\n')
    expect(() => loadConfig({ dir, env: {} })).toThrow(/00-defaults.yaml/)
  })

  test('names the directory when it is missing', () => {
    expect(() => loadConfig({ dir: path.join(dir, 'missing'), env: {} })).toThrow(/missing/)
  })

  test('allows a Turnstile test secret on localhost', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const config = loadConfig({
      dir,
      env: { MAIQ_TURNSTILE_SECRET: '1x0000000000000000000000000000000AA' },
    })
    expect(config.turnstile.secret).toBe('1x0000000000000000000000000000000AA')
  })

  test('rejects a Turnstile test secret on a public host', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    expect(() =>
      loadConfig({
        dir,
        env: {
          MAIQ_PUBLIC_URL: 'https://maiq.example.com',
          MAIQ_TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
        },
      })
    ).toThrow(/MAIQ_TURNSTILE_SECRET/)
  })

  test('allows a real-looking Turnstile secret on a public host', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const config = loadConfig({
      dir,
      env: {
        MAIQ_PUBLIC_URL: 'https://maiq.example.com',
        MAIQ_TURNSTILE_SECRET: '0x4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    })
    expect(config.turnstile.secret).toBe('0x4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
  })

  test('allows Turnstile test keys on an IPv6 loopback URL', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const config = loadConfig({
      dir,
      env: {
        MAIQ_PUBLIC_URL: 'http://[::1]:5180',
        MAIQ_TURNSTILE_SITE_KEY: TEST_SITE_KEY,
        MAIQ_TURNSTILE_SECRET: TEST_SECRET,
      },
    })
    expect(config.turnstile.siteKey).toBe(TEST_SITE_KEY)
  })

  test('rejects a Turnstile test site key on a public host', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const env = {
      MAIQ_PUBLIC_URL: 'https://maiq.example.com',
      MAIQ_TURNSTILE_SITE_KEY: TEST_SITE_KEY,
    }
    expect(() => loadConfig({ dir, env })).toThrow(/MAIQ_TURNSTILE_SITE_KEY/)
  })

  test('requires MAIQ_PUBLIC_URL when NODE_ENV is production', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    expect(() => loadConfig({ dir, env: { NODE_ENV: 'production' } })).toThrow(/MAIQ_PUBLIC_URL/)
  })

  test('rejects Turnstile test keys on localhost when NODE_ENV is production', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const env = { NODE_ENV: 'production', MAIQ_PUBLIC_URL: 'http://localhost:8080' }
    const withSecret = { ...env, MAIQ_TURNSTILE_SECRET: TEST_SECRET }
    const withSiteKey = { ...env, MAIQ_TURNSTILE_SITE_KEY: TEST_SITE_KEY }
    expect(() => loadConfig({ dir, env: withSecret })).toThrow(/MAIQ_TURNSTILE_SECRET/)
    expect(() => loadConfig({ dir, env: withSiteKey })).toThrow(/MAIQ_TURNSTILE_SITE_KEY/)
  })

  test('accepts real Turnstile keys and a public URL in production', () => {
    writeFileSync(path.join(dir, '00-defaults.yaml'), BASE)
    const config = loadConfig({
      dir,
      env: { NODE_ENV: 'production', MAIQ_PUBLIC_URL: 'https://maiq.example.com' },
    })
    expect(config.publicUrl).toBe('https://maiq.example.com')
  })

  test('accepts the development defaults', () => {
    const config = loadConfig({ dir: DEFAULTS_DIR, env: {} })
    expect(config.publicUrl).toBe('http://localhost:5180')
    expect(config.turnstile).toEqual({ siteKey: TEST_SITE_KEY, secret: TEST_SECRET })
  })
})
