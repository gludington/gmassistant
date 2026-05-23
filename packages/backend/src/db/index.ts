import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

export type { AppDb } from './types.js';

export function createLibsqlDb(
  url = process.env.DATABASE_URL ?? 'file:./gmassisstant.db',
  authToken = process.env.DATABASE_AUTH_TOKEN,
) {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}
