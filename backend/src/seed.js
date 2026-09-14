import { env } from './config/env.js';
import { PostgresDatabase } from './db/postgresDatabase.js';
import { initialData } from './db/initialData.js';

const db = await PostgresDatabase.connect(env.postgres, initialData);
await db.reset(initialData);
await db.close();

console.log(`Seed cargado en PostgreSQL: ${env.postgres.database}`);
