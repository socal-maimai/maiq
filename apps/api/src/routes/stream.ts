import {
  BUTTON_UPDATED_EVENT,
  LINE_UPDATED_EVENT,
  STREAM_PATH,
  toButtonStateJson,
  toLineStateJson,
} from '@maiq/types'
import type { Hono } from 'hono'
import { streamSSE, type SSEMessage } from 'hono/streaming'
import type { AppDeps } from '@maiq/api/lib/deps'

const HEARTBEAT_MS = 20_000

type Client = (message: SSEMessage) => void

export function mountStream(app: Hono, deps: AppDeps): void {
  const clients = new Set<Client>()
  const broadcast = (event: string, toJson: () => unknown): void => {
    if (clients.size === 0) return
    const message = { event, data: JSON.stringify(toJson()) }
    for (const client of clients) client(message)
  }
  deps.events.subscribe(state => broadcast(LINE_UPDATED_EVENT, () => toLineStateJson(state)))
  deps.buttonEvents.subscribe(state =>
    broadcast(BUTTON_UPDATED_EVENT, () => toButtonStateJson(state))
  )

  app.get(`/api${STREAM_PATH}`, c =>
    streamSSE(c, async stream => {
      const send: Client = message => {
        stream.writeSSE(message).catch((error: unknown) => {
          deps.logger.debug({ err: error }, 'Dropped an SSE event for a closed stream')
        })
      }
      clients.add(send)
      const aborted = Promise.withResolvers<void>()
      stream.onAbort(() => {
        clients.delete(send)
        aborted.resolve()
      })

      while (!stream.aborted) {
        // oxlint-disable-next-line no-await-in-loop -- heartbeats must be sent one after another
        await stream.writeSSE({ event: 'ping', data: '' })
        // oxlint-disable-next-line no-await-in-loop -- sleeping between heartbeats is the point
        await Promise.race([stream.sleep(HEARTBEAT_MS), aborted.promise])
      }
    })
  )
}
