import { describe, expect, test } from 'bun:test'
import pino from 'pino'
import { createTurnstileVerifier } from '@maiq/api/lib/turnstile'

const logger = pino({ level: 'silent' })

function fakeFetch(reply: () => Response) {
  const calls: { url: string; form: FormData }[] = []
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ url, form: init.body as FormData })
    return Promise.resolve(reply())
  }
  return { fetch, calls }
}

describe('createTurnstileVerifier', () => {
  test('posts the secret, token, and IP and accepts success', async () => {
    const fake = fakeFetch(() => Response.json({ success: true }))
    const verify = createTurnstileVerifier({ secret: 's3cret', logger, fetch: fake.fetch })
    expect(await verify('token-1', '203.0.113.9')).toBe(true)
    expect(fake.calls[0]?.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(fake.calls[0]?.form.get('secret')).toBe('s3cret')
    expect(fake.calls[0]?.form.get('response')).toBe('token-1')
    expect(fake.calls[0]?.form.get('remoteip')).toBe('203.0.113.9')
  })

  test('omits remoteip when the IP is unknown', async () => {
    const fake = fakeFetch(() => Response.json({ success: true }))
    await createTurnstileVerifier({ secret: 's', logger, fetch: fake.fetch })('t', null)
    expect(fake.calls[0]?.form.has('remoteip')).toBe(false)
  })

  test('rejects when Cloudflare says no', async () => {
    const fake = fakeFetch(() =>
      Response.json({ success: false, 'error-codes': ['invalid-input-response'] })
    )
    expect(
      await createTurnstileVerifier({ secret: 's', logger, fetch: fake.fetch })('t', null)
    ).toBe(false)
  })

  test('rejects on an HTTP error', async () => {
    const fake = fakeFetch(() => new Response('nope', { status: 500 }))
    expect(
      await createTurnstileVerifier({ secret: 's', logger, fetch: fake.fetch })('t', null)
    ).toBe(false)
  })

  test('rejects instead of throwing when the request fails', async () => {
    const verify = createTurnstileVerifier({
      secret: 's',
      logger,
      fetch: () => Promise.reject(new Error('network down')),
    })
    expect(await verify('t', null)).toBe(false)
  })

  test('rejects instead of throwing on a non-JSON body', async () => {
    const verify = createTurnstileVerifier({
      secret: 's',
      logger,
      fetch: () => Promise.resolve(new Response('not json', { status: 200 })),
    })
    expect(await verify('t', null)).toBe(false)
  })
})

const reply = (hostname: string) => () => Response.json({ success: true, hostname })

describe('createTurnstileVerifier hostname check', () => {
  test('accepts a token solved on the expected hostname', async () => {
    const fake = fakeFetch(reply('maiq.example.dev'))
    const verify = createTurnstileVerifier({
      secret: 's',
      expectedHostname: 'maiq.example.dev',
      logger,
      fetch: fake.fetch,
    })
    expect(await verify('t', null)).toBe(true)
  })

  test('rejects a token solved on another hostname, such as localhost', async () => {
    const fake = fakeFetch(reply('localhost'))
    const verify = createTurnstileVerifier({
      secret: 's',
      expectedHostname: 'maiq.example.dev',
      logger,
      fetch: fake.fetch,
    })
    expect(await verify('t', null)).toBe(false)
  })

  test('skips the check when no hostname is expected', async () => {
    const fake = fakeFetch(reply('example.com'))
    const verify = createTurnstileVerifier({ secret: 's', logger, fetch: fake.fetch })
    expect(await verify('t', null)).toBe(true)
  })
})
