import { and, asc, eq, gt, sql } from 'drizzle-orm'
import { findLine, LINE_IDS } from '@maiq/core/arcades'
import type { ButtonReportInput, ButtonService, ButtonWriteError } from '@maiq/core/button-service'
import { buttonKey, checkDescription, isButtonOf, type ButtonRef } from '@maiq/core/buttons'
import { buttonReports, type Database } from '@maiq/db'
import type { ButtonEvents } from '@maiq/api/lib/events'
import { loadButtonState, loadButtonStates } from '@maiq/api/services/button-states'

export const REPORT_WINDOW_MS = 10 * 60_000
export const MAX_REPORTS_PER_WINDOW = 30
export const BUTTON_COOLDOWN_MS = 10 * 60_000

type Limit = Extract<ButtonWriteError, { retryAfterMs: number }>
type RecentRow = ButtonRef & { createdAt: Date }

function checkLimits(recent: readonly RecentRow[], ref: ButtonRef, at: Date): Limit | null {
  const last = recent.findLast(row => buttonKey(row) === buttonKey(ref))
  if (last) {
    const retryAfterMs = last.createdAt.getTime() + BUTTON_COOLDOWN_MS - at.getTime()
    return { error: 'buttonCooldown', retryAfterMs }
  }
  const blocking = recent[recent.length - MAX_REPORTS_PER_WINDOW]
  if (blocking) {
    const retryAfterMs = blocking.createdAt.getTime() + REPORT_WINDOW_MS - at.getTime()
    return { error: 'tooManyReports', retryAfterMs }
  }
  return null
}

type ButtonServiceOptions = { db: Database; events: ButtonEvents; now: () => Date }

export function createButtonService({ db, events, now }: ButtonServiceOptions): ButtonService {
  const insertUnlessLimited = (
    input: ButtonReportInput,
    description: string,
    at: Date
  ): Promise<Limit | null> =>
    db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`buttons|${input.reporter}`}))`)
      const recent = await tx
        .select({
          lineId: buttonReports.lineId,
          cab: buttonReports.cab,
          side: buttonReports.side,
          button: buttonReports.button,
          createdAt: buttonReports.createdAt,
        })
        .from(buttonReports)
        .where(
          and(
            eq(buttonReports.reporter, input.reporter),
            gt(buttonReports.createdAt, new Date(at.getTime() - REPORT_WINDOW_MS))
          )
        )
        .orderBy(asc(buttonReports.createdAt), asc(buttonReports.id))
      const limit = checkLimits(recent, input, at)
      if (limit) return limit
      await tx.insert(buttonReports).values({
        lineId: input.lineId,
        cab: input.cab,
        side: input.side,
        button: input.button,
        kind: input.kind,
        description,
        reporter: input.reporter,
        createdAt: at,
      })
      return null
    })

  return {
    buttonStates: (lineIds = LINE_IDS) => loadButtonStates(db, lineIds, now()),
    async submit(input) {
      const line = findLine(input.lineId)
      if (!line || !isButtonOf(line, input)) return { ok: false, error: 'unknownButton' }
      const checked = checkDescription(input.kind, input.description)
      if (!checked.ok) return { ok: false, error: 'invalidDescription', problem: checked.problem }
      const at = now()
      const limit = await insertUnlessLimited(input, checked.description, at)
      if (limit) return { ok: false, ...limit }
      const state = await loadButtonState(db, input, at)
      if (!state) throw new Error(`No state computed for button ${buttonKey(input)} after a report`)
      events.emit(state)
      return { ok: true, state }
    },
  }
}
