import fs from 'fs';
import multer from 'multer';
import { env } from './config/env.js';
import { PostgresDatabase } from './db/postgresDatabase.js';
import { initialData } from './db/initialData.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

export const db = await PostgresDatabase.connect(env.postgres, initialData);
export const upload = multer({ dest: env.uploadDir });
