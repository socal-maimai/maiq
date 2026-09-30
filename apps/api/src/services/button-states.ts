import { and, desc, eq, inArray, lte } from 'drizzle-orm'
import type { ButtonState } from '@maiq/core/button-service'
import {
  buttonKey,
  buttonVerdict,
  RECENT_REPORTS,
  type ButtonRef,
  type ReportKind,
} from '@maiq/core/buttons'
import { buttonReports, type Database } from '@maiq/db'

const columns = {
  lineId: buttonReports.lineId,
  cab: buttonReports.cab,
  side: buttonReports.side,
  button: buttonReports.button,
  kind: buttonReports.kind,
  description: buttonReports.description,
  reporter: buttonReports.reporter,
  createdAt: buttonReports.createdAt,
}

type Row = ButtonRef & {
  kind: ReportKind
  description: string
  reporter: string
  createdAt: Date
}

const newestFirst = [desc(buttonReports.createdAt), desc(buttonReports.id)] as const

function toStates(rows: readonly Row[], now: Date): ButtonState[] {
  return [...Map.groupBy(rows, buttonKey).values()].flatMap(group => {
    const [newest] = group
    if (!newest) return []
    const votes = group.map(row => ({ reporter: row.reporter, kind: row.kind, at: row.createdAt }))
    return [
      {
        lineId: newest.lineId,
        cab: newest.cab,
        side: newest.side,
        button: newest.button,
        ...buttonVerdict(votes, now),
        recent: group.slice(0, RECENT_REPORTS).map(row => ({
          kind: row.kind,
          description: row.description,
          at: row.createdAt,
        })),
      },
    ]
  })
}

const byPosition =
  (lineIds: readonly string[]) =>
  (a: ButtonRef, b: ButtonRef): number =>
    lineIds.indexOf(a.lineId) - lineIds.indexOf(b.lineId) ||
    a.cab - b.cab ||
    a.side - b.side ||
    a.button - b.button

export async function loadButtonStates(
  db: Database,
  lineIds: readonly string[],
  now: Date
): Promise<ButtonState[]> {
  if (lineIds.length === 0) return []
  const rows = await db
    .select(columns)
    .from(buttonReports)
    .where(and(inArray(buttonReports.lineId, [...lineIds]), lte(buttonReports.createdAt, now)))
    .orderBy(...newestFirst)
  return toStates(rows, now).toSorted(byPosition(lineIds))
}

export async function loadButtonState(
  db: Database,
  ref: ButtonRef,
  now: Date
): Promise<ButtonState | undefined> {
  const rows = await db
    .select(columns)
    .from(buttonReports)
    .where(
      and(
        eq(buttonReports.lineId, ref.lineId),
        eq(buttonReports.cab, ref.cab),
        eq(buttonReports.side, ref.side),
        eq(buttonReports.button, ref.button),
        lte(buttonReports.createdAt, now)
      )
    )
    .orderBy(...newestFirst)
  return toStates(rows, now)[0]
}
