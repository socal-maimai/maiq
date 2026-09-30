import {
  BUTTON_UPDATED_EVENT,
  ButtonStateJsonSchema,
  LINE_UPDATED_EVENT,
  LineStateJsonSchema,
  STREAM_PATH,
} from '@maiq/types'
import type { QueryClient } from '@tanstack/svelte-query'
import { prettifyError, type z } from 'zod/mini'
import { queryKeys, storeButton, storeLine } from '$lib/query'

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000

function parseEvent<T>(schema: z.ZodMiniType<T>, name: string, data: string): T | null {
  let raw: unknown
  try {
    raw = JSON.parse(data)
  } catch (error) {
    console.error(`Ignoring a ${name} event that is not JSON`, error)
    return null
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    console.error(`Ignoring a malformed ${name} event`, prettifyError(parsed.error))
    return null
  }
  return parsed.data
}

export function subscribeToUpdates(
  queryClient: QueryClient,
  onLive: (live: boolean) => void
): () => void {
  let source: EventSource | null = null
  let retryMs = FIRST_RETRY_MS
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const refresh = (queryKey: readonly string[]): void => {
    if (queryClient.isFetching({ queryKey }) > 0) return
    void queryClient.invalidateQueries({ queryKey })
  }

  const connect = () => {
    source = new EventSource(`/api${STREAM_PATH}`)
    source.addEventListener('open', () => {
      retryMs = FIRST_RETRY_MS
      onLive(true)
      refresh(queryKeys.lines)
      refresh(queryKeys.buttons)
    })
    source.addEventListener(LINE_UPDATED_EVENT, event => {
      const line = parseEvent(LineStateJsonSchema, LINE_UPDATED_EVENT, event.data)
      if (line) storeLine(queryClient, line)
    })
    source.addEventListener(BUTTON_UPDATED_EVENT, event => {
      const button = parseEvent(ButtonStateJsonSchema, BUTTON_UPDATED_EVENT, event.data)
      if (button) storeButton(queryClient, button)
    })
    source.addEventListener('error', () => {
      source?.close()
      if (stopped) return
      onLive(false)
      retryTimer = setTimeout(connect, retryMs)
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
    })
  }

  connect()
  return () => {
    stopped = true
    clearTimeout(retryTimer)
    source?.close()
  }
}
