import type { Point } from '@maiq/core/geo'
import type { QueryClient } from '@tanstack/svelte-query'
import { deviceId } from '$lib/device'
import { clientConfigQuery } from '$lib/query'
import { getTurnstileToken } from '$lib/turnstile'
import { viewer } from '$lib/viewer.svelte'

export async function writerFields(
  queryClient: QueryClient
): Promise<{ deviceId: string; turnstileToken: string; location?: Point }> {
  const { turnstileSiteKey } = await queryClient.fetchQuery(clientConfigQuery)
  const turnstileToken = await getTurnstileToken(turnstileSiteKey)
  const position = viewer.position
  return { deviceId: deviceId(), turnstileToken, ...(position ? { location: position } : {}) }
}
