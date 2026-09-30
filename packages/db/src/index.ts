import path from 'node:path'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@maiq/db/schema'

export * from '@maiq/db/schema'
export { schema }

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export const MIGRATIONS_DIR = path.join(import.meta.dir, '..', 'migrations')

export function createDatabase(url: string) {
  const client = postgres(url, {
    onnotice: () => {},
    max: 10,
    idle_timeout: 20,
    max_lifetime: 30 * 60,
  })
  const db: Database = drizzle(client, { schema })
  return { client, db }
}
