import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod/mini'

z.config(z.locales.en())

const text = () => z.string().check(z.minLength(1))

const ConfigSchema = z.object({
  port: z.int().check(z.gte(1), z.lte(65_535)),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  publicUrl: z.url(),
  databaseUrl: text(),
  turnstile: z.object({ siteKey: text(), secret: text() }),
  discord: z.optional(z.object({ applicationId: text(), publicKey: text(), token: text() })),
  admin: z.optional(
    z.object({
      clientId: text(),
      clientSecret: text(),
      sessionSecret: z.string().check(z.minLength(32)),
      ids: z.array(z.string().check(z.regex(/^\d{15,21}$/))).check(z.minLength(1)),
    })
  ),
})

export type Config = z.output<typeof ConfigSchema>
type Tree = { [key: string]: unknown }
type Env = Record<string, string | undefined>

const TURNSTILE_TEST_SITE_KEYS = new Set([
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
])
const TURNSTILE_TEST_SECRETS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
])
export const isTurnstileTestSecret = (secret: string): boolean => TURNSTILE_TEST_SECRETS.has(secret)

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

function productionReason(config: Config, env: Env): string | null {
  if (env['NODE_ENV'] === 'production') return 'NODE_ENV is production'
  if (LOOPBACK_HOSTNAMES.has(new URL(config.publicUrl).hostname)) return null
  return `publicUrl (${config.publicUrl}) is not localhost`
}

function assertProductionReady(config: Config, env: Env): void {
  if (env['NODE_ENV'] === 'production' && !env['MAIQ_PUBLIC_URL']) {
    throw new Error(
      'NODE_ENV is production but MAIQ_PUBLIC_URL is not set, so publicUrl would fall back to ' +
        `the development default (${config.publicUrl}). Set MAIQ_PUBLIC_URL to the site's ` +
        'public URL, for example https://maiq.example.'
    )
  }
  const reason = productionReason(config, env)
  if (reason === null) return
  const testKeys: [string, boolean][] = [
    ['MAIQ_TURNSTILE_SITE_KEY', TURNSTILE_TEST_SITE_KEYS.has(config.turnstile.siteKey)],
    ['MAIQ_TURNSTILE_SECRET', TURNSTILE_TEST_SECRETS.has(config.turnstile.secret)],
  ]
  for (const [name, isTestKey] of testKeys) {
    if (!isTestKey) continue
    throw new Error(
      `${name} is one of Cloudflare's published Turnstile test keys, but ${reason}. ` +
        'Set MAIQ_TURNSTILE_SITE_KEY and MAIQ_TURNSTILE_SECRET to real Turnstile keys.'
    )
  }
}

const isTree = (value: unknown): value is Tree =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function deepMerge(base: Tree, override: Tree): Tree {
  const result: Tree = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    const existing = result[key]
    result[key] = isTree(existing) && isTree(value) ? deepMerge(existing, value) : value
  }
  return result
}

function withoutEmpty(tree: Tree): Tree {
  const result: Tree = {}
  for (const [key, value] of Object.entries(tree)) {
    if (value === undefined) continue
    if (isTree(value)) {
      const nested = withoutEmpty(value)
      if (Object.keys(nested).length > 0) result[key] = nested
      continue
    }
    result[key] = value
  }
  return result
}

function listFromEnv(value: string | undefined): string[] | undefined {
  const items = value
    ?.split(',')
    .map(item => item.trim())
    .filter(item => item !== '')
  return items?.length ? items : undefined
}

function discordFromEnv(env: Env): Tree | undefined {
  const publicKey = env['MAIQ_DISCORD_PUBLIC_KEY'] || undefined
  const token = env['MAIQ_DISCORD_TOKEN'] || undefined
  if (!publicKey && !token) return undefined
  return { applicationId: env['MAIQ_DISCORD_APPLICATION_ID'] || undefined, publicKey, token }
}

function adminFromEnv(env: Env): Tree | undefined {
  const fields = {
    clientSecret: env['MAIQ_DISCORD_CLIENT_SECRET'] || undefined,
    sessionSecret: env['MAIQ_SESSION_SECRET'] || undefined,
    ids: listFromEnv(env['MAIQ_ADMIN_IDS']),
  }
  if (Object.values(fields).every(value => value === undefined)) return undefined
  return { clientId: env['MAIQ_DISCORD_APPLICATION_ID'] || undefined, ...fields }
}

function fromEnv(env: Env): Tree {
  const port = env['MAIQ_PORT']
  return withoutEmpty({
    port: port === undefined ? undefined : Number(port),
    logLevel: env['MAIQ_LOG_LEVEL'],
    publicUrl: env['MAIQ_PUBLIC_URL'],
    databaseUrl: env['MAIQ_DATABASE_URL'],
    turnstile: {
      siteKey: env['MAIQ_TURNSTILE_SITE_KEY'] || undefined,
      secret: env['MAIQ_TURNSTILE_SECRET'] || undefined,
    },
    discord: discordFromEnv(env),
    admin: adminFromEnv(env),
  })
}

function readConfigDir(dir: string): Tree {
  let files: string[]
  try {
    files = readdirSync(dir)
      .filter(file => /\.(ya?ml|json)$/.test(file))
      .toSorted()
  } catch (error) {
    throw new Error(`Cannot read the maiq config directory ${dir}. Set MAIQ_CONFIG_DIR.`, {
      cause: error,
    })
  }
  let merged: Tree = {}
  for (const file of files) {
    const parsed: unknown = parse(readFileSync(path.join(dir, file), 'utf8'))
    if (!isTree(parsed)) {
      throw new Error(`Config file ${path.join(dir, file)} must contain a mapping at the top level`)
    }
    merged = deepMerge(merged, parsed)
  }
  return merged
}

export function loadConfig(options: { dir: string; env: Env }): Config {
  const merged = deepMerge(readConfigDir(options.dir), fromEnv(options.env))
  const result = ConfigSchema.safeParse(merged)
  if (!result.success) {
    const source = `from ${options.dir} and MAIQ_* env vars`
    throw new Error(`Invalid maiq config (${source}):\n${z.prettifyError(result.error)}`)
  }
  assertProductionReady(result.data, options.env)
  return result.data
}
