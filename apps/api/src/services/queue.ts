import { and, desc, eq, sql } from 'drizzle-orm'
import { findLine, LINE_IDS, type Line } from '@maiq/core/arcades'
import { checkCount, MAX_QUEUE, maxPlayers } from '@maiq/core/caps'
import type { Count } from '@maiq/core/count'
import type { QueueService, WriteResult, Writer } from '@maiq/core/queue'
import { queueReports, type Database } from '@maiq/db'
import type { LineEvents } from '@maiq/api/lib/events'
import { loadLineStates } from '@maiq/api/services/line-states'
import { hiddenFieldsFor } from '@maiq/api/services/mutes'

export const REPORT_COOLDOWN_MS = 60_000
export const CONFIRM_COOLDOWN_MS = 5 * 60_000

type Kind = 'report' | 'confirm'

const COOLDOWN_MS: Record<Kind, number> = {
  report: REPORT_COOLDOWN_MS,
  confirm: CONFIRM_COOLDOWN_MS,
}

type QueueServiceOptions = { db: Database; events: LineEvents; now: () => Date }

export function createQueueService({ db, events, now }: QueueServiceOptions): QueueService {
  const lineStates = (lineIds: readonly string[] = LINE_IDS) => loadLineStates(db, lineIds, now())

  const insertUnlessCoolingDown = (
    line: Line,
    kind: Kind,
    count: Count,
    writer: Writer,
    at: Date
  ): Promise<number> =>
    db.transaction(async tx => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${writer.reporter}|${line.id}`}))`
      )
      const [last] = await tx
        .select({ createdAt: queueReports.createdAt })
        .from(queueReports)
        .where(
          and(
            eq(queueReports.reporter, writer.reporter),
            eq(queueReports.lineId, line.id),
            eq(queueReports.kind, kind)
          )
        )
        .orderBy(desc(queueReports.createdAt))
        .limit(1)
      const remaining = last ? COOLDOWN_MS[kind] - (at.getTime() - last.createdAt.getTime()) : 0
      if (remaining > 0) return remaining
      await tx.insert(queueReports).values({
        lineId: line.id,
        players: count.players,
        queue: count.queue,
        kind,
        source: writer.source,
        reporter: writer.reporter,
        reporterName: writer.reporterName ?? null,
        inGeofence: writer.inGeofence,
        createdAt: at,
        ...(await hiddenFieldsFor(tx, writer.reporter, at)),
      })
      return 0
    })

  async function write(line: Line, kind: Kind, count: Count, writer: Writer): Promise<WriteResult> {
    const retryAfterMs = await insertUnlessCoolingDown(line, kind, count, writer, now())
    if (retryAfterMs > 0) return { ok: false, error: 'rateLimited', retryAfterMs }
    const [state] = await lineStates([line.id])
    if (!state) throw new Error(`No state computed for line ${line.id} after writing a ${kind}`)
    events.emit(state)
    return { ok: true, state }
  }

  return {
    lineStates,
    async submitReport(input) {
      const line = findLine(input.lineId)
      if (!line) return { ok: false, error: 'unknownLine' }
      const problem = checkCount(line, input.count)
      if (problem === 'playersOverCap') {
        return { ok: false, error: problem, maxPlayers: maxPlayers(line) }
      }
      if (problem === 'queueOverCap') return { ok: false, error: problem, maxQueue: MAX_QUEUE }
      return write(line, 'report', input.count, input)
    },
    async confirm(input) {
      const line = findLine(input.lineId)
      if (!line) return { ok: false, error: 'unknownLine' }
      const [current] = await lineStates([line.id])
      if (!current?.count) return { ok: false, error: 'nothingToConfirm' }
      return write(line, 'confirm', current.count, input)
    },
  }
}
