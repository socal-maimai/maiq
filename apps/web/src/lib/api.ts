import type {
  AnyRouteDefinition,
  ResponseDefinition,
  RouteBodyInput,
  RouteResponse,
} from '@maiq/types'
import { prettifyError } from 'zod/mini'
import { ApiError } from '$lib/api-error'

function kindOf(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'kind' in payload) {
    return String(payload.kind)
  }
  return 'unknown'
}

function parseEnvelope<T extends AnyRouteDefinition>(route: T, payload: unknown): RouteResponse<T> {
  const kind = kindOf(payload)
  const definitions: readonly ResponseDefinition[] = [...route.goodResponses, ...route.badResponses]
  const definition = definitions.find(d => d.kind === kind)
  if (!definition) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message)
        : `Unexpected response from ${route.method} ${route.path}`
    throw new ApiError(kind, message)
  }
  const parsed = definition.schema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiError(
      kind,
      `Invalid ${kind} response from ${route.method} ${route.path}: ${prettifyError(parsed.error)}`
    )
  }
  return parsed.data as RouteResponse<T>
}

export async function apiRequest<T extends AnyRouteDefinition>(
  route: T,
  body?: RouteBodyInput<T>
): Promise<RouteResponse<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const init: RequestInit = { method: route.method, headers, cache: 'no-store' }
  if (route.body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const response = await fetch(`/api${route.path}`, init)
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new ApiError('unknown', `The server sent a non-JSON ${response.status} response`, {
      cause: error,
    })
  }
  return parseEnvelope(route, payload)
}
