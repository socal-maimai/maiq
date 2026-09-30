import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { MIGRATIONS_DIR, schema, type Database } from '@maiq/db'

export async function createTestDatabase(): Promise<{ client: PGlite; db: Database }> {
  const client = new PGlite()
  const pglite = drizzle(client, { schema })
  await migrate(pglite, { migrationsFolder: MIGRATIONS_DIR })
  const db: Database = pglite
  return { client, db }
}
