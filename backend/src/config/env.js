import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'sgi-dyd-dev-secret-change-me',
  dataFile: process.env.DATA_FILE || path.join(root, 'data', 'db.json'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    rejectUnauthorized: String(process.env.SMTP_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false'
  }
};
