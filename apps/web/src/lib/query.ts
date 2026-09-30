import { buttonKey } from '@maiq/core/buttons'
import {
  GetButtons,
  GetClientConfig,
  GetLines,
  type ButtonStateJson,
  type LineStateJson,
} from '@maiq/types'
import { QueryClient, queryOptions } from '@tanstack/svelte-query'
import { apiRequest } from '$lib/api'
import { ApiError } from '$lib/api-error'

export const queryKeys = {
  lines: ['lines'] as const,
  buttons: ['buttons'] as const,
  clientConfig: ['client-config'] as const,
}

export const linesQuery = queryOptions({
  queryKey: queryKeys.lines,
  queryFn: async () => (await apiRequest(GetLines)).data.lines,
  refetchInterval: 60_000,
})

export const buttonsQuery = queryOptions({
  queryKey: queryKeys.buttons,
  queryFn: async () => {
    const response = await apiRequest(GetButtons)
    if (response.kind !== 'goodButtons') throw new ApiError(response.kind, response.message)
    return response.data.buttons
  },
  refetchInterval: 5 * 60_000,
})

export const clientConfigQuery = queryOptions({
  queryKey: queryKeys.clientConfig,
  queryFn: async () => (await apiRequest(GetClientConfig)).data,
  staleTime: Number.POSITIVE_INFINITY,
})

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) =>
          failureCount < 3 && (!(error instanceof ApiError) || error.kind === 'unknown'),
      },
    },
  })
}

export function storeLine(queryClient: QueryClient, line: LineStateJson): void {
  queryClient.setQueryData<LineStateJson[]>(queryKeys.lines, lines =>
    lines?.map(existing => (existing.lineId === line.lineId ? line : existing))
  )
}

export function storeButton(queryClient: QueryClient, button: ButtonStateJson): void {
  queryClient.setQueryData<ButtonStateJson[]>(queryKeys.buttons, buttons => {
    if (!buttons) return buttons
    const index = buttons.findIndex(existing => buttonKey(existing) === buttonKey(button))
    return index === -1 ? [...buttons, button] : buttons.with(index, button)
  })
}
