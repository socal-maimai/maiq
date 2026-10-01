import { expect } from 'bun:test'
import type { ChatListener } from '@maiq/bot/chat/listener'
import type { TestBotApp } from 'maiq-tests-api/support/app'

export const APPLICATION_ID = '111'
export const USER_ID = '555'
export const CHANNEL_ID = '222'
export const GUILD_ID = '444'
const INTERACTIONS_URL = 'https://maiq.test/discord/interactions'
export const ORIGINAL = '/api/v10/webhooks/111/tok/messages/%40original'
export const CALLBACK = '/api/v10/interactions/333/tok/callback'

type DiscordFile = { field: string; name: string; data: Blob }

export type DiscordCall = { method: string; path: string; body: unknown; files: DiscordFile[] }

type Override = { method: string; path: string; response: () => Response }

function fakeMessage(id: string) {
  return {
    id,
    channel_id: CHANNEL_ID,
    content: '',
    author: {
      id: APPLICATION_ID,
      username: 'maiq',
      discriminator: '0',
      global_name: null,
      avatar: null,
    },
    timestamp: new Date().toISOString(),
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    mention_roles: [],
    attachments: [],
    embeds: [],
    pinned: false,
    type: 0,
  }
}

const base = {
  id: '333',
  application_id: APPLICATION_ID,
  token: 'tok',
  version: 1,
  channel: { id: CHANNEL_ID, type: 0 },
  guild_id: GUILD_ID,
  member: {
    user: { id: USER_ID, username: 'u', discriminator: '0', global_name: null, avatar: null },
    permissions: '16',
  },
  locale: 'en-US',
  app_permissions: '0',
  entitlements: [],
  authorizing_integration_owners: {},
  attachment_size_limit: 1,
}

export const commandInteraction = (
  name: string,
  options: [string, string][],
  member: { userId?: string; permissions?: string } = {}
) => ({
  ...base,
  member: {
    user: { ...base.member.user, id: member.userId ?? USER_ID },
    permissions: member.permissions ?? base.member.permissions,
  },
  type: 2,
  data: {
    id: '1',
    name,
    type: 1,
    options: options.map(([optionName, value]) => ({ name: optionName, type: 3, value })),
  },
})

export const PICKER_MESSAGE_ID = '901'

export function buttonInteraction(
  customId: string,
  options: { userId?: string; repliedTo?: string } = {}
) {
  const reference = options.repliedTo
    ? { message_reference: { message_id: options.repliedTo, channel_id: CHANNEL_ID } }
    : {}
  return {
    ...base,
    member: { user: { ...base.member.user, id: options.userId ?? USER_ID } },
    type: 3,
    message: { ...fakeMessage(PICKER_MESSAGE_ID), ...reference },
    data: { custom_id: customId, component_type: 2 },
  }
}

export type GatewayMessage = Parameters<ChatListener['parseRawData']>[0]
let nextChatMessageId = 800

export function fakeGatewayMessage(options: {
  content: string
  channelId?: string
  authorId?: string
  bot?: boolean
  webhookId?: string
  dm?: boolean
}): GatewayMessage {
  const message: GatewayMessage = {
    ...fakeMessage(String(nextChatMessageId++)),
    channel_id: options.channelId ?? CHANNEL_ID,
    guild_id: GUILD_ID,
    content: options.content,
    author: {
      id: options.authorId ?? USER_ID,
      username: 'u',
      discriminator: '0',
      global_name: null,
      avatar: null,
      ...(options.bot ? { bot: true } : {}),
    },
    type: 0,
  }
  if (options.webhookId) message.webhook_id = options.webhookId
  if (options.dm) delete message.guild_id
  return message
}

export const modalInteraction = (customId: string, fields: Record<string, string>) => ({
  ...base,
  type: 5,
  data: {
    custom_id: customId,
    components: Object.entries(fields).map(([fieldId, value], index) => ({
      type: 18,
      id: index * 2 + 1,
      component: { type: 4, id: index * 2 + 2, custom_id: fieldId, value },
    })),
  },
})

function requestBody(body: RequestInit['body']): { body: unknown; files: DiscordFile[] } {
  if (typeof body === 'string') return { body: JSON.parse(body), files: [] }
  if (!(body instanceof FormData)) return { body: undefined, files: [] }
  const files: DiscordFile[] = []
  let json: unknown
  for (const [field, value] of body.entries()) {
    const entry: unknown = value
    if (field === 'payload_json' && typeof entry === 'string') json = JSON.parse(entry)
    else if (entry instanceof File) files.push({ field, name: entry.name, data: entry })
  }
  return { body: json, files }
}

export async function createTestDiscord() {
  const keyPair = (await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const publicKeyHex = Buffer.from(
    await crypto.subtle.exportKey('raw', keyPair.publicKey)
  ).toString('hex')
  const calls: DiscordCall[] = []
  const overrides: Override[] = []
  let nextMessageId = 900

  const fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const method = init?.method ?? 'GET'
    calls.push({ method, path: url.pathname, ...requestBody(init?.body) })
    const override = overrides.find(o => o.method === method && o.path === url.pathname)
    if (override) return Promise.resolve(override.response())
    if (url.searchParams.get('with_response') === 'true') {
      return Promise.resolve(Response.json({ resource: { message: fakeMessage('1') } }))
    }
    if (method === 'POST' && /^\/api\/v10\/channels\/\d+\/messages$/.test(url.pathname)) {
      return Promise.resolve(Response.json(fakeMessage(String(nextMessageId++))))
    }
    if (method === 'PUT' || method === 'DELETE') {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    return Promise.resolve(Response.json(fakeMessage('1')))
  }

  async function signedRequest(payload: unknown, options: { tamper?: boolean } = {}) {
    const body = JSON.stringify(payload)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = Buffer.from(
      await crypto.subtle.sign(
        'Ed25519',
        keyPair.privateKey,
        new TextEncoder().encode(timestamp + body)
      )
    ).toString('hex')
    const sent = options.tamper ? signature.replace(/^./, c => (c === 'a' ? 'b' : 'a')) : signature
    return new Request(INTERACTIONS_URL, {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': sent,
        'x-signature-timestamp': timestamp,
      },
    })
  }

  return {
    publicKeyHex,
    calls,
    fetch,
    signedRequest,
    respondWith(method: string, path: string, response: () => Response) {
      overrides.push({ method, path, response })
    },
  }
}

export async function waitFor(check: () => boolean, what: string, timeoutMs = 2000): Promise<void> {
  const started = Date.now()
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${what}`)
    // oxlint-disable-next-line no-await-in-loop -- polling is sequential by nature
    await Bun.sleep(5)
  }
}

export const edits = (calls: DiscordCall[]): DiscordCall[] =>
  calls.filter(c => c.method === 'PATCH' && c.path === ORIGINAL)

export const callbacks = (calls: DiscordCall[]): unknown[] =>
  calls.filter(c => c.method === 'POST' && c.path === CALLBACK).map(c => c.body)

export const contentOf = (call: DiscordCall | undefined): string | undefined =>
  (call?.body as { content?: string } | undefined)?.content

export async function replyTo(
  t: TestBotApp,
  payload: unknown,
  timeoutMs?: number
): Promise<DiscordCall> {
  const before = edits(t.discord.calls).length
  const res = await t.send(payload)
  expect(res.status).toBe(202)
  await waitFor(() => edits(t.discord.calls).length > before, 'the reply edit', timeoutMs)
  const reply = edits(t.discord.calls).at(-1)
  if (!reply) throw new Error('no reply edit recorded')
  return reply
}
