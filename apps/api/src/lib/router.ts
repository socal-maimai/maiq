import {
  BadCaptcha,
  BadOrigin,
  BadSignedOut,
  BadValidation,
  type AnyRouteDefinition,
  type ResponseDefinition,
  type RouteBody,
  type RouteHandlerResult,
  type RouteQuery,
  type RouteResponders,
  type Schema,
} from '@maiq/types'
import type { Context, Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AdminSession } from '@maiq/api/lib/admin-session'
import type { AppDeps } from '@maiq/api/lib/deps'

type HandlerArgs<T extends AnyRouteDefinition> = {
  body: RouteBody<T>
  query: RouteQuery<T>
  res: RouteResponders<T>
  deps: AppDeps
  ip: string | null
  admin: T['admin'] extends true ? AdminSession : null
}

type RouteHandler<T extends AnyRouteDefinition> = (
  args: HandlerArgs<T>
) => Promise<RouteHandlerResult<T>>

export type MountableRoute = {
  definition: AnyRouteDefinition
  mount(app: Hono, deps: AppDeps): void
}

const envelope = (response: ResponseDefinition, data: unknown) =>
  data === undefined
    ? { kind: response.kind, message: response.message }
    : { kind: response.kind, message: response.message, data }

type Responder = (payload?: unknown) => { status: number; body: unknown }

function buildResponders<T extends AnyRouteDefinition>(definition: T): RouteResponders<T> {
  const responders: Record<string, Responder> = {}
  const all: readonly ResponseDefinition[] = [
    ...definition.goodResponses,
    ...definition.badResponses,
  ]
  for (const response of all) {
    responders[response.kind] = payload => ({
      status: response.status,
      body: envelope(response, response.dataSchema?.parse(payload)),
    })
  }
  return responders as unknown as RouteResponders<T>
}

export const send = (c: Context, response: ResponseDefinition, data?: unknown) =>
  c.json(envelope(response, data), response.status as ContentfulStatusCode)

type ParseResult = { ok: true; value: unknown } | { ok: false; reason: string }

function parseWith(schema: Schema, raw: unknown, where: 'body' | 'query'): ParseResult {
  const result = schema.safeParse(raw)
  if (result.success) return { ok: true, value: result.data }
  const issue = result.error.issues[0]
  return {
    ok: false,
    reason: issue ? `${where}.${issue.path.join('.')}: ${issue.message}` : `${where}: not valid`,
  }
}

async function readBody(c: Context, schema: Schema): Promise<ParseResult> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return { ok: false, reason: 'body: not valid JSON' }
  }
  return parseWith(schema, raw, 'body')
}

export function declareRoute<T extends AnyRouteDefinition>(
  definition: T,
  handler: RouteHandler<T>
): MountableRoute {
  const res = buildResponders(definition)
  return {
    definition,
    mount(app, deps) {
      app.on(definition.method, `/api${definition.path}`, async c => {
        let admin: AdminSession | null = null
        if (definition.admin) {
          admin = deps.adminAuth?.session(c) ?? null
          if (!admin) return send(c, BadSignedOut)
          if (definition.method !== 'GET' && !deps.adminAuth?.isSameOrigin(c)) {
            return send(c, BadOrigin)
          }
        }
        let body: unknown
        if (definition.body) {
          const parsed = await readBody(c, definition.body)
          if (!parsed.ok) return send(c, BadValidation, { reason: parsed.reason })
          body = parsed.value
        }
        let query: unknown
        if (definition.query) {
          const parsed = parseWith(definition.query, c.req.query(), 'query')
          if (!parsed.ok) return send(c, BadValidation, { reason: parsed.reason })
          query = parsed.value
        }
        const ip = c.req.header('x-real-ip') ?? null
        if (definition.captcha) {
          const { turnstileToken } = body as { turnstileToken: string }
          if (!(await deps.verifyTurnstile(turnstileToken, ip))) return send(c, BadCaptcha)
        }
        const result = await handler({
          body: body as RouteBody<T>,
          query: query as RouteQuery<T>,
          res,
          deps,
          ip,
          admin: admin as HandlerArgs<T>['admin'],
        })
        return c.json(result.body as object, result.status as ContentfulStatusCode)
      })
    },
  }
}
