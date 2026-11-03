import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '../src/db/schema'
import type { Database } from '../src/db/types'

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

/** An in-process Postgres with the app's migrations applied. */
export async function createTestDb(): Promise<{ db: Database; client: PGlite }> {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder })
  return { db, client }
}
