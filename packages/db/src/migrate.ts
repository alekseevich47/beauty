import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'node:path';
import postgres from 'postgres';

/**
 * Applies versioned migrations from packages/db/drizzle in journal order.
 * Never uses `drizzle-kit push`: production schema changes must be reviewable
 * files, not a live diff that can silently drop columns.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  const migrationsFolder = join(__dirname, '..', 'drizzle');
  console.log(`Applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });

  console.log('Migrations complete');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
