import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { db, upload } from './context.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createBootstrapRouter } from './routes/bootstrap.routes.js';
import { createProjectsRouter } from './routes/projects.routes.js';
import { createTasksRouter } from './routes/tasks.routes.js';
import { createFilesRouter } from './routes/files.routes.js';
import { createNotificationsRouter } from './routes/notifications.routes.js';
import { createUsersRouter } from './routes/users.routes.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '12mb' }));
  app.use('/uploads', express.static(env.uploadDir));

  app.get('/api/health', async (req, res, next) => {
    try {
      const database = await db.health();
      res.json({
        status: 'ok',
        service: 'SGI Diseño y Desarrollo',
        database: 'postgresql',
        databaseStatus: database.ok ? 'ok' : 'error',
        databaseTime: database.database_time || null,
        normalizedEntities: {
          users: database.users || 0,
          projects: database.projects || 0,
          projectStages: database.project_stages || 0,
          marketingTasks: database.marketing_tasks || 0
        }
      });
    } catch (error) {
      next(error);
    }
  });

  const routers = [
    createAuthRouter(db),
    createBootstrapRouter(db),
    createProjectsRouter(db),
    createTasksRouter(db),
    createFilesRouter(db, upload),
    createNotificationsRouter(db),
    createUsersRouter(db)
  ];
  routers.forEach((router) => app.use('/api', router));

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(error.status || 400).json({ error: error.message || 'Error inesperado.' });
  });

  return app;
}
