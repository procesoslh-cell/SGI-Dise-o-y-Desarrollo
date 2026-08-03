import fs from 'fs';
import multer from 'multer';
import { env } from './config/env.js';
import { JsonDatabase } from './db/jsonDatabase.js';
import { initialData } from './db/initialData.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

export const db = new JsonDatabase(env.dataFile, initialData);
export const upload = multer({ dest: env.uploadDir });
