import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { ChatGateway } from '@maiq/bot/chat/gateway'
import type { BotLogger } from '@maiq/bot/deps'
import { waitFor } from 'maiq-tests-api/support/discord'

type Logged = { level: 'error' | 'warn' | 'info'; details: object; message: string }
type GatewayClient = Parameters<ChatGateway['registerClient']>[0]
type SocketHandler = (...args: unknown[]) => void

function recordingLogger() {
  const logged: Logged[] = []
  const logger: BotLogger = {
    error: (details, message) => logged.push({ level: 'error', details, message }),
    warn: (details, message) => logged.push({ level: 'warn', details, message }),
    info: (details, message) => logged.push({ level: 'info', details, message }),
  }
  return { logged, logger }
}

function fakeSocketFactory() {
  const urls: string[] = []
  const closeHandlers: SocketHandler[] = []
  const factory = (url: string) => {
    urls.push(url)
    const on = (event: string, handler: SocketHandler) => {
      if (event === 'close') closeHandlers.push(handler)
    }
    return { readyState: 0, send: () => {}, close: () => {}, on }
  }
  const closeLatest = (code: number) => closeHandlers.at(-1)?.(code, 'test close')
  return { urls, factory, closeLatest }
}

function emitGatewayError(gateway: ChatGateway, error: Error): void {
  const { emitter } = gateway as unknown as { emitter: { emit(e: string, err: Error): void } }
  emitter.emit('error', error)
}

const fakeClient = { options: { token: 'test-token' } } as GatewayClient
const GATEWAY_INFO = {
  url: 'wss://gateway.test',
  shards: 1,
  session_start_limit: { total: 1000, remaining: 1000, reset_after: 0, max_concurrency: 1 },
}
const RETRY_MS = { first: 5, max: 20 }
const fakeFetch = (respond: () => Promise<Response>): typeof fetch =>
  Object.assign(respond, { preconnect: () => {} })
const offline = fakeFetch(() => Promise.reject(new Error('offline')))
const online = fakeFetch(() => Promise.resolve(Response.json(GATEWAY_INFO)))

const fetchSpy = spyOn(globalThis, 'fetch')
afterEach(() => fetchSpy.mockReset())

describe('chat gateway', () => {
  test('logs gateway errors instead of throwing', () => {
    const { logged, logger } = recordingLogger()
    const gateway = new ChatGateway(logger)
    expect(() => emitGatewayError(gateway, new Error('socket hang up'))).not.toThrow()
    expect(logged).toEqual([
      {
        level: 'error',
        details: { err: new Error('socket hang up') },
        message: 'Discord gateway error',
      },
    ])
  })

  test('explains a 4014 close as the missing Message Content intent', () => {
    const { logged, logger } = recordingLogger()
    const gateway = new ChatGateway(logger)
    emitGatewayError(gateway, new Error('Fatal gateway close code: 4014'))
    expect(logged).toHaveLength(1)
    expect(logged[0]?.message).toContain('Message Content Intent')
  })

  test('retries a failed bootstrap until it connects', async () => {
    const { logged, logger } = recordingLogger()
    const sockets = fakeSocketFactory()
    fetchSpy.mockImplementationOnce(offline).mockImplementationOnce(online)
    const gateway = new ChatGateway(logger, {
      retryMs: RETRY_MS,
      webSocketFactory: sockets.factory,
    })
    await gateway.registerClient(fakeClient)
    expect(logged.map(l => l.message)).toEqual(['Discord gateway failed to start'])
    await waitFor(() => sockets.urls.length > 0, 'the retried connection')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(sockets.urls[0]).toStartWith('wss://gateway.test')
    gateway.disconnect()
  })

  test('keeps reconnecting after repeated drops', async () => {
    const { logged, logger } = recordingLogger()
    const sockets = fakeSocketFactory()
    fetchSpy.mockImplementation(online)
    const gateway = new ChatGateway(logger, {
      retryMs: RETRY_MS,
      webSocketFactory: sockets.factory,
    })
    await gateway.registerClient(fakeClient)
    for (let drop = 1; drop <= 8; drop++) {
      sockets.closeLatest(1006)
      // oxlint-disable-next-line no-await-in-loop -- each drop waits for the previous reconnect
      await waitFor(() => sockets.urls.length > drop, `reconnect ${drop}`)
    }
    expect(logged).toEqual([])
    gateway.disconnect()
  })

  test('stops retrying after disconnect', async () => {
    const { logger } = recordingLogger()
    const sockets = fakeSocketFactory()
    fetchSpy.mockImplementation(offline)
    const gateway = new ChatGateway(logger, {
      retryMs: RETRY_MS,
      webSocketFactory: sockets.factory,
    })
    await gateway.registerClient(fakeClient)
    gateway.disconnect()
    await Bun.sleep(RETRY_MS.max * 3)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(sockets.urls).toEqual([])
  })
})
