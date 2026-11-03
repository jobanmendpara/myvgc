import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './schema'

/** A Drizzle database, backed by Postgres in production and PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>
