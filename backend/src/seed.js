import fs from 'fs';
import { env } from './config/env.js';
import { initialData } from './db/initialData.js';

fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(env.dataFile, JSON.stringify(initialData, null, 2));
console.log(`Seed creado en ${env.dataFile}`);
