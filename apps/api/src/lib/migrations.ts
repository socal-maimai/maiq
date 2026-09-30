import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { MIGRATIONS_DIR } from '@maiq/db'
import type { Logger } from '@maiq/api/lib/logger'

const MIGRATION_LOCK_KEY = 7_415_203_991

export async function runMigrations(databaseUrl: string, logger: Logger): Promise<void> {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`
    logger.info('Running database migrations')
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR })
    logger.info('Database migrations complete')
  } finally {
    await client.end()
  }
}
