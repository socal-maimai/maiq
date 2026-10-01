import { and, desc, gt, inArray, lte } from 'drizzle-orm'
import {
  isTrusted,
  isVerified,
  lineState,
  STALE_MS,
  type LineState,
  type ReportRow,
  type ReportSource,
} from '@maiq/core/state'
import { queueReports, type Database } from '@maiq/db'
import { isShown } from '@maiq/api/services/mutes'

const columns = {
  lineId: queueReports.lineId,
  players: queueReports.players,
  queue: queueReports.queue,
  source: queueReports.source,
  inGeofence: queueReports.inGeofence,
  createdAt: queueReports.createdAt,
}

type SelectedRow = {
  lineId: string
  players: number
  queue: number
  source: ReportSource
  inGeofence: boolean | null
  createdAt: Date
}

const toReportRow = (row: SelectedRow): ReportRow => ({
  players: row.players,
  queue: row.queue,
  trusted: isTrusted(row),
  verified: isVerified(row),
  createdAt: row.createdAt,
})

export async function loadLineStates(
  db: Database,
  lineIds: readonly string[],
  now: Date
): Promise<LineState[]> {
  if (lineIds.length === 0) return []
  const ids = [...lineIds]
  const since = new Date(now.getTime() - STALE_MS)
  const [recent, latest] = await Promise.all([
    db
      .select(columns)
      .from(queueReports)
      .where(
        and(
          inArray(queueReports.lineId, ids),
          gt(queueReports.createdAt, since),
          lte(queueReports.createdAt, now),
          isShown(queueReports.hiddenAt)
        )
      )
      .orderBy(desc(queueReports.createdAt), desc(queueReports.id)),
    db
      .selectDistinctOn([queueReports.lineId], columns)
      .from(queueReports)
      .where(
        and(
          inArray(queueReports.lineId, ids),
          lte(queueReports.createdAt, now),
          isShown(queueReports.hiddenAt)
        )
      )
      .orderBy(queueReports.lineId, desc(queueReports.createdAt), desc(queueReports.id)),
  ])
  const rowsByLine = Map.groupBy([...recent, ...latest], row => row.lineId)
  return lineIds.map(id => lineState(id, rowsByLine.get(id)?.map(toReportRow) ?? [], now))
}
