import crypto from 'crypto';
import { env } from '../config/env.js';
import { hashPassword, now, uid } from '../db/initialData.js';

const base64url = (input) => Buffer.from(input).toString('base64url');
const sign = (content) => crypto.createHmac('sha256', env.jwtSecret).update(content).digest('base64url');

export function createToken(payload, expiresInSeconds = 60 * 60 * 8) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) return null;
  const expected = sign(`${header}.${body}`);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function verifyPassword(password, passwordHash) {
  const [salt, stored] = String(passwordHash || '').split(':');
  if (!salt || !stored) return false;
  const current = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(current));
}

export function sanitizeUser(user, data) {
  if (!user) return null;
  const role = data.roles.find((r) => r.id === user.roleId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    roleId: user.roleId,
    role,
    permissions: role?.permissionIds || []
  };
}

export function requireAuth(db) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    const data = db.read();
    const user = data.users.find((u) => u.id === payload.userId && u.active);
    if (!user) return res.status(401).json({ error: 'Usuario inactivo o inexistente.' });
    req.user = sanitizeUser(user, data);
    req.rawUser = user;
    req.data = data;
    next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (req.user?.permissions?.includes(permission) || req.user?.role?.code === 'ADMIN') return next();
    return res.status(403).json({ error: `No tenés permiso: ${permission}` });
  };
}

export function createSession(db, user, req) {
  const token = createToken({ userId: user.id, username: user.username, sessionId: uid('ses') });
  db.transact((data) => {
    data.sessions.push({ id: uid('ses'), userId: user.id, tokenPreview: token.slice(0, 18), ip: req.ip, userAgent: req.headers['user-agent'], createdAt: now(), revokedAt: null });
    data.timeline.push({ id: uid('tl'), type: 'security', title: 'Inicio de sesión', detail: `${user.name} ingresó al sistema.`, by: user.name, createdAt: now() });
  });
  return token;
}
