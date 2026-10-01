import {
  GetAdminReports,
  GetAdminSession,
  PostAdminModeration,
  PostAdminMute,
  PostAdminTestReport,
  toLineStateJson,
} from '@maiq/types'
import type { AdminSession } from '@maiq/api/lib/admin-session'
import { declareRoute } from '@maiq/api/lib/router'

const actor = (admin: AdminSession): string => `discord:${admin.id}`

const ms = (date: Date | null): number | null => date?.getTime() ?? null

export const adminSessionRoute = declareRoute(GetAdminSession, ({ res, admin }) =>
  Promise.resolve(res.goodAdminSession({ id: admin.id, name: admin.name }))
)

export const adminReportsRoute = declareRoute(GetAdminReports, async ({ res, deps }) => {
  const { queue, buttons, mutes } = await deps.moderation.recent()
  return res.goodAdminReports({
    queue: queue.map(row => ({
      id: row.id,
      lineId: row.lineId,
      reporter: row.reporter,
      createdAt: row.createdAt.getTime(),
      hiddenAt: ms(row.hiddenAt),
      hiddenBy: row.hiddenBy,
      test: row.test,
      reporterName: row.reporterName,
      players: row.players,
      queue: row.queue,
      kind: row.kind,
      source: row.source,
      inGeofence: row.inGeofence,
    })),
    buttons: buttons.map(row => ({
      id: row.id,
      lineId: row.lineId,
      reporter: row.reporter,
      createdAt: row.createdAt.getTime(),
      hiddenAt: ms(row.hiddenAt),
      hiddenBy: row.hiddenBy,
      test: row.test,
      cab: row.cab,
      side: row.side,
      button: row.button,
      kind: row.kind,
      description: row.description,
    })),
    mutes: mutes.map(row => ({
      reporter: row.reporter,
      mutedBy: row.mutedBy,
      createdAt: row.createdAt.getTime(),
    })),
  })
})

export const adminModerationRoute = declareRoute(
  PostAdminModeration,
  async ({ body, res, deps, admin }) => {
    const found = await deps.moderation.setHidden(body.table, body.id, body.hidden, actor(admin))
    return found ? res.goodModeration() : res.badUnknownReport()
  }
)

export const adminMuteRoute = declareRoute(PostAdminMute, async ({ body, res, deps, admin }) => {
  await deps.moderation.setMuted(body.reporter, body.muted, actor(admin))
  return res.goodMute()
})

export const adminTestReportRoute = declareRoute(
  PostAdminTestReport,
  async ({ body, res, deps, admin }) => {
    const count = { players: body.players, queue: body.queue }
    const result = await deps.moderation.submitTest(body.lineId, count, actor(admin))
    if (result.ok) return res.goodTestReport({ line: toLineStateJson(result.state) })
    if (result.error === 'unknownLine') return res.badUnknownLine()
    return res.badPlayersOverCap({ maxPlayers: result.maxPlayers })
  }
)
