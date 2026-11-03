import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './schema'
import type { Database } from './types'

export interface PostgresConnection {
  db: Database
  close: () => Promise<void>
}

export function connectPostgres(url: string): PostgresConnection {
  const client = postgres(url, { onnotice: () => {} })
  const db = drizzle(client, { schema })
  return { db, close: () => client.end() }
}

export async function migratePostgres(url: string, migrationsFolder: string): Promise<void> {
  // A dedicated single connection, so the migration lock and session settings stay together.
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder })
  } finally {
    await client.end()
  }
}
