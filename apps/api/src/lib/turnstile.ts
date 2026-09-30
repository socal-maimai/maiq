import type { TurnstileVerifier } from '@maiq/api/lib/deps'
import type { Logger } from '@maiq/api/lib/logger'

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 5000

type SiteverifyResult = { success?: unknown; hostname?: unknown; 'error-codes'?: unknown }

export function createTurnstileVerifier(options: {
  secret: string
  expectedHostname?: string | null
  logger: Logger
  fetch?: FetchLike
}): TurnstileVerifier {
  const send: FetchLike = options.fetch ?? ((url, init) => fetch(url, init))
  return async (token, ip) => {
    const form = new FormData()
    form.set('secret', options.secret)
    form.set('response', token)
    if (ip) form.set('remoteip', ip)
    let response: Response
    try {
      response = await send(SITEVERIFY_URL, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      options.logger.error({ err: error }, 'Turnstile siteverify request failed')
      return false
    }
    if (!response.ok) {
      options.logger.error(
        { status: response.status },
        'Turnstile siteverify returned an error status'
      )
      return false
    }
    let result: SiteverifyResult
    try {
      result = (await response.json()) as SiteverifyResult
    } catch (error) {
      options.logger.error({ err: error }, 'Turnstile siteverify returned a non-JSON body')
      return false
    }
    if (result.success !== true) {
      options.logger.info({ errors: result['error-codes'] }, 'Turnstile rejected a token')
      return false
    }
    const expected = options.expectedHostname
    if (expected && result.hostname !== expected) {
      options.logger.warn(
        { hostname: result.hostname, expected },
        'Turnstile token was solved on another hostname'
      )
      return false
    }
    return true
  }
}
