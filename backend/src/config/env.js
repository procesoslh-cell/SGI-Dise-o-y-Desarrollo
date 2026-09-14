import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const number = (value, fallback) => Number(value || fallback);
const bool = (value, fallback = false) => String(value ?? fallback).toLowerCase() === 'true';

export const env = {
  port: number(process.env.PORT, 4000),
  jwtSecret: process.env.JWT_SECRET || 'sgi-dyd-dev-secret-change-me',
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  postgres: {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: number(process.env.POSTGRES_PORT, 5432),
    database: process.env.POSTGRES_DB || 'sgi_diseno_test',
    user: process.env.POSTGRES_USER || 'sgi_diseno',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: bool(process.env.POSTGRES_SSL, false)
      ? { rejectUnauthorized: bool(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED, true) }
      : false
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: number(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    rejectUnauthorized: bool(process.env.SMTP_REJECT_UNAUTHORIZED, true)
  }
};
