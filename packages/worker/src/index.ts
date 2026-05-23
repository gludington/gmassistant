import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@gmassisstant/backend/db/schema';
import { createApp } from '@gmassisstant/backend/app';
import { R2Storage } from './storage/r2.js';

export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const db = drizzle(env.DB, { schema });
    const storage = new R2Storage(env.UPLOADS);
    return createApp(db, storage).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
