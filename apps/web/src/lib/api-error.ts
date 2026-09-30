export class ApiError extends Error {
  readonly kind: string

  constructor(kind: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiError'
    this.kind = kind
  }
}

const NETWORK_ERROR_HINT = "That didn't go through. Try again."

export function hintForError(error: unknown): string {
  if (error instanceof TypeError) return NETWORK_ERROR_HINT
  if (error instanceof ApiError) {
    return error.kind === 'unknown' ? NETWORK_ERROR_HINT : error.message
  }
  return error instanceof Error ? error.message : NETWORK_ERROR_HINT
}
