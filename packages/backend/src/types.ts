import type { AppDb } from './db/types.js';
import type { StorageAdapter } from './storage/types.js';

export type AppVariables = { db: AppDb; storage: StorageAdapter };
