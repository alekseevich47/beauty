import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString: string, opts?: { max?: number; ssl?: boolean }) {
  const client = postgres(connectionString, {
    max: opts?.max ?? 20,
    ssl: opts?.ssl ? 'require' : undefined,
    prepare: false,
  });
  return drizzle(client, { schema });
}

export { schema };
export * from './schema';
