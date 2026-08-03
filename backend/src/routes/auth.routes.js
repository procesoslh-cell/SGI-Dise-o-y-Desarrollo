import { Router } from 'express';
import { createSession, sanitizeUser, verifyPassword } from '../features/auth.js';
import { now, uid } from '../db/initialData.js';

export function createAuthRouter(db) {
  const router = Router();

  router.get('/health', (req, res) => {
    const data = db.read();
    res.json({ ok: true, product: data.meta.product, version: data.meta.version });
  });

  router.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const data = db.read();
    const user = data.users.find((item) => (item.username === username || item.email === username) && item.active);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    const token = createSession(db, user, req);
    res.json({ token, user: sanitizeUser(user, db.read()) });
  });

  router.post('/auth/password/recovery/start', (req, res) => {
    const result = db.transact((data) => {
      const username = req.body?.username || '';
      const user = data.users.find((item) => item.username === username || item.email === username);
      const token = uid('pwd');
      data.passwordRecoveryRequests ||= [];
      data.passwordRecoveryRequests.push({ id: uid('rec'), username, userId: user?.id || null, token, usedAt: null, createdAt: now() });
      return { ok: true, message: 'Solicitud registrada. La integración de email queda preparada para la siguiente etapa.', devToken: token };
    });
    res.json(result);
  });

  return router;
}
