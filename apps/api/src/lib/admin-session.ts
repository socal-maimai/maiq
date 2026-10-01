import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'maiq_admin'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60_000

export type AdminSession = { id: string; name: string; expiresAt: number }

const signature = (payload: string, secret: string): Buffer =>
  createHmac('sha256', secret).update(payload).digest()

export function signSession(session: AdminSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${signature(payload, secret).toString('base64url')}`
}

function isSession(value: unknown): value is AdminSession {
  if (typeof value !== 'object' || value === null) return false
  const { id, name, expiresAt } = value as Record<string, unknown>
  return typeof id === 'string' && typeof name === 'string' && typeof expiresAt === 'number'
}

export function readSession(token: string, secret: string, now: Date): AdminSession | null {
  const [payload, sent, ...rest] = token.split('.')
  if (!payload || !sent || rest.length > 0) return null
  const expected = signature(payload, secret)
  const given = Buffer.from(sent, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  let session: unknown
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!isSession(session) || session.expiresAt <= now.getTime()) return null
  return session
}
