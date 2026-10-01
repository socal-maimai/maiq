import {
  GetAdminReports,
  GetAdminSession,
  PostAdminModeration,
  PostAdminMute,
  PostAdminTestReport,
  type AnyRouteDefinition,
  type RouteBodyInput,
} from '@maiq/types'
import { queryOptions, type QueryClient } from '@tanstack/svelte-query'
import { apiRequest } from '$lib/api'
import { ApiError } from '$lib/api-error'

export const adminKeys = {
  session: ['admin', 'session'] as const,
  reports: ['admin', 'reports'] as const,
}

export const adminSessionQuery = queryOptions({
  queryKey: adminKeys.session,
  queryFn: async () => {
    const response = await apiRequest(GetAdminSession)
    return response.kind === 'goodAdminSession' ? response.data : null
  },
  staleTime: Number.POSITIVE_INFINITY,
})

export const adminReportsQuery = queryOptions({
  queryKey: adminKeys.reports,
  queryFn: async () => {
    const response = await apiRequest(GetAdminReports)
    if (response.kind !== 'goodAdminReports') throw new ApiError(response.kind, response.message)
    return response.data
  },
  refetchInterval: 30_000,
})

async function write<T extends AnyRouteDefinition>(
  queryClient: QueryClient,
  route: T,
  body: RouteBodyInput<T>
): Promise<void> {
  const response = await apiRequest(route, body)
  if (response.kind === 'badSignedOut') {
    await queryClient.invalidateQueries({ queryKey: adminKeys.session })
  }
  if (!response.kind.startsWith('good')) throw new ApiError(response.kind, response.message)
  await queryClient.invalidateQueries({ queryKey: adminKeys.reports })
}

export const adminActions = (queryClient: QueryClient) => ({
  setHidden: (body: RouteBodyInput<typeof PostAdminModeration>) =>
    write(queryClient, PostAdminModeration, body),
  setMuted: (body: RouteBodyInput<typeof PostAdminMute>) => write(queryClient, PostAdminMute, body),
  sendTest: (body: RouteBodyInput<typeof PostAdminTestReport>) =>
    write(queryClient, PostAdminTestReport, body),
})

export const SIGN_IN_ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  expired: 'That sign-in took too long. Try again.',
  notAdmin: 'That Discord account is not on the admin list.',
  discord: 'Discord did not answer. Try again.',
}

export async function signOut(queryClient: QueryClient): Promise<void> {
  const response = await fetch('/auth/logout', { method: 'POST' })
  if (!response.ok) throw new Error(`Sign-out returned ${response.status}`)
  queryClient.setQueryData(adminKeys.session, null)
}
