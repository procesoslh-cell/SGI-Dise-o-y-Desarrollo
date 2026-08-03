import { Router } from 'express';
import { requireAuth, requirePermission } from '../features/auth.js';

export function createNotificationsRouter(db) {
  const router = Router();

  router.put('/notifications/:id/read', requireAuth(db), requirePermission('notifications:read'), (req, res) => {
    db.transact((data) => {
      const item = data.notifications.find((notification) => notification.id === Number(req.params.id));
      if (item) item.read = true;
      return item || { ok: true };
    });
    res.json({ ok: true });
  });

  router.put('/notifications/read-all', requireAuth(db), requirePermission('notifications:read'), (req, res) => {
    db.transact((data) => {
      data.notifications.forEach((notification) => {
        const applies = !notification.userId || notification.userId === req.user.id || notification.roleId === req.user.roleId || req.user.role?.code === 'ADMIN';
        if (applies) notification.read = true;
      });
      return { ok: true };
    });
    res.json({ ok: true });
  });

  return router;
}
