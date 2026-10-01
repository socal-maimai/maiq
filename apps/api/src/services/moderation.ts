import { desc, eq } from 'drizzle-orm'
import { findLine } from '@maiq/core/arcades'
import { checkCount, maxPlayers } from '@maiq/core/caps'
import type { Count } from '@maiq/core/count'
import { buttonVerdict, type ButtonRef } from '@maiq/core/buttons'
import type { LineState } from '@maiq/core/state'
import { buttonReports, mutedReporters, queueReports, type Database } from '@maiq/db'
import type { ReportTable } from '@maiq/types'
import type { ButtonEvents, LineEvents } from '@maiq/api/lib/events'
import { loadButtonState } from '@maiq/api/services/button-states'
import { loadLineStates } from '@maiq/api/services/line-states'

export const RECENT_LIMIT = 150

export type TestReportResult =
  | { ok: true; state: LineState }
  | { ok: false; error: 'unknownLine' }
  | { ok: false; error: 'playersOverCap'; maxPlayers: number }

export type ModerationService = ReturnType<typeof createModerationService>

type ModerationOptions = {
  db: Database
  events: LineEvents
  buttonEvents: ButtonEvents
  now: () => Date
}

export function createModerationService({ db, events, buttonEvents, now }: ModerationOptions) {
  async function publishLine(lineId: string): Promise<LineState> {
    const [state] = await loadLineStates(db, [lineId], now())
    if (!state) throw new Error(`No state computed for line ${lineId} after moderation`)
    events.emit(state)
    return state
  }

  async function publishButton(ref: ButtonRef): Promise<void> {
    const at = now()
    const state = (await loadButtonState(db, ref, at)) ?? {
      ...ref,
      ...buttonVerdict([], at),
      recent: [],
    }
    buttonEvents.emit(state)
  }

  const hiddenFields = (hidden: boolean, by: string) =>
    hidden ? { hiddenAt: now(), hiddenBy: by } : { hiddenAt: null, hiddenBy: null }

  return {
    async recent() {
      const [queue, buttons, mutes] = await Promise.all([
        db
          .select()
          .from(queueReports)
          .orderBy(desc(queueReports.createdAt), desc(queueReports.id))
          .limit(RECENT_LIMIT),
        db
          .select()
          .from(buttonReports)
          .orderBy(desc(buttonReports.createdAt), desc(buttonReports.id))
          .limit(RECENT_LIMIT),
        db.select().from(mutedReporters).orderBy(desc(mutedReporters.createdAt)),
      ])
      return { queue, buttons, mutes }
    },

    async setHidden(table: ReportTable, id: number, hidden: boolean, by: string) {
      if (table === 'queue') {
        const [row] = await db
          .update(queueReports)
          .set(hiddenFields(hidden, by))
          .where(eq(queueReports.id, id))
          .returning({ lineId: queueReports.lineId })
        if (!row) return false
        await publishLine(row.lineId)
        return true
      }
      const [row] = await db
        .update(buttonReports)
        .set(hiddenFields(hidden, by))
        .where(eq(buttonReports.id, id))
        .returning({
          lineId: buttonReports.lineId,
          cab: buttonReports.cab,
          side: buttonReports.side,
          button: buttonReports.button,
        })
      if (!row) return false
      await publishButton(row)
      return true
    },

    async setMuted(reporter: string, muted: boolean, by: string): Promise<void> {
      if (!muted) {
        await db.delete(mutedReporters).where(eq(mutedReporters.reporter, reporter))
        return
      }
      await db
        .insert(mutedReporters)
        .values({ reporter, mutedBy: by, createdAt: now() })
        .onConflictDoNothing()
    },

    async submitTest(lineId: string, count: Count, by: string): Promise<TestReportResult> {
      const line = findLine(lineId)
      if (!line) return { ok: false, error: 'unknownLine' }
      const problem = checkCount(line, count)
      if (problem === 'playersOverCap') {
        return { ok: false, error: problem, maxPlayers: maxPlayers(line) }
      }
      await db.insert(queueReports).values({
        lineId: line.id,
        players: count.players,
        queue: count.queue,
        kind: 'report',
        source: 'web',
        reporter: by,
        inGeofence: null,
        test: true,
        createdAt: now(),
      })
      return { ok: true, state: await publishLine(line.id) }
    },
  }
}
