import { Router } from 'express';
import { requireAuth } from '../features/auth.js';
import { bootstrapFor } from '../features/serializers.js';
import { checkDueNotifications } from '../services/dueNotifications.js';

export function createBootstrapRouter(db) {
  const router = Router();
  router.get('/bootstrap', requireAuth(db), (req, res) => {
    db.transact((data) => {
      checkDueNotifications(data);
      return data.meta;
    });
    res.json(bootstrapFor(db.read(), req.user));
  });
  return router;
}
