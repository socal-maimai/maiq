export function retryText(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
  const wait = seconds < 60 ? `${seconds}s` : `${Math.ceil(retryAfterMs / 60_000)} min`
  return `Try again in ${wait}.`
}
