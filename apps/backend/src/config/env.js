import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'sgi-dyd-dev-secret-change-me',
  dataFile: process.env.DATA_FILE || path.join(root, 'data', 'db.json'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
