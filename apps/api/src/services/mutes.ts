import { eq, isNull, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { mutedReporters, type Database } from '@maiq/db'

type HiddenFields = { hiddenAt: Date | null; hiddenBy: string | null }

export async function hiddenFieldsFor(
  db: Database,
  reporter: string,
  at: Date
): Promise<HiddenFields> {
  const [muted] = await db
    .select({ mutedBy: mutedReporters.mutedBy })
    .from(mutedReporters)
    .where(eq(mutedReporters.reporter, reporter))
  return muted ? { hiddenAt: at, hiddenBy: muted.mutedBy } : { hiddenAt: null, hiddenBy: null }
}

export const isShown = (hiddenAt: AnyPgColumn): SQL => isNull(hiddenAt)
