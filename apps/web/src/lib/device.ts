const KEY = 'maiq.deviceId'
let fallbackId: string | null = null

export function deviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(KEY, created)
    return created
  } catch (error) {
    console.warn('localStorage is unavailable, so this tab uses a temporary device id', error)
    fallbackId ??= crypto.randomUUID()
    return fallbackId
  }
}
