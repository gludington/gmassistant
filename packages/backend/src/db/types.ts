import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema.js';

// Common base satisfied by both LibSQLDatabase and DrizzleD1Database
export type AppDb = BaseSQLiteDatabase<'async', any, typeof schema>;
