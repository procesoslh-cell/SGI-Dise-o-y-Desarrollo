import { Router } from 'express';
import { requireAuth, requirePermission, sanitizeUser } from '../features/auth.js';
import { hashPassword, now } from '../db/initialData.js';
import { appendTimeline, nextNumericId } from '../features/workflow.js';

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validateUnique(data, { username, email }, excludeId = null) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (data.users.some((user) => user.id !== excludeId && normalizeUsername(user.username) === normalizedUsername)) {
    throw new Error('Ya existe un usuario con ese nombre de acceso.');
  }
  if (normalizedEmail && data.users.some((user) => user.id !== excludeId && String(user.email || '').trim().toLowerCase() === normalizedEmail)) {
    throw new Error('Ya existe un usuario con ese correo electrónico.');
  }
}

export function createUsersRouter(db) {
  const router = Router();

  router.post('/users', requireAuth(db), requirePermission('admin:users'), (req, res) => {
    const result = db.transact((data) => {
      const name = String(req.body?.name || '').trim();
      const username = normalizeUsername(req.body?.username);
      const email = String(req.body?.email || '').trim();
      const password = String(req.body?.password || '');
      const roleId = req.body?.roleId;
      if (!name || !username || !email || !password || !roleId) throw new Error('Completá nombre, usuario, email, contraseña y rol.');
      if (password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');
      if (!data.roles.some((role) => role.id === roleId)) throw new Error('El rol seleccionado no existe.');
      validateUnique(data, { username, email });
      const user = {
        id: nextNumericId(data, 'users'),
        name,
        username,
        email,
        roleId,
        passwordHash: hashPassword(password),
        active: req.body.active !== false,
        createdAt: now(),
        updatedAt: now()
      };
      data.users.push(user);
      appendTimeline(data, { type: 'security', title: 'Usuario creado', detail: `${user.name} · ${data.roles.find((role) => role.id === roleId)?.name}`, by: req.user.name });
      return sanitizeUser(user, data);
    });
    res.json(result);
  });

  router.put('/users/:id', requireAuth(db), requirePermission('admin:users'), (req, res) => {
    const result = db.transact((data) => {
      const user = data.users.find((item) => item.id === Number(req.params.id));
      if (!user) throw new Error('Usuario no encontrado.');
      const name = req.body.name !== undefined ? String(req.body.name).trim() : user.name;
      const username = req.body.username !== undefined ? normalizeUsername(req.body.username) : user.username;
      const email = req.body.email !== undefined ? String(req.body.email).trim() : user.email;
      const roleId = req.body.roleId ?? user.roleId;
      const active = req.body.active !== undefined ? Boolean(req.body.active) : user.active;
      if (!name || !username || !email || !roleId) throw new Error('Nombre, usuario, email y rol son obligatorios.');
      if (!data.roles.some((role) => role.id === roleId)) throw new Error('El rol seleccionado no existe.');
      if (user.id === req.user.id && active === false) throw new Error('No podés desactivar tu propio usuario.');
      validateUnique(data, { username, email }, user.id);
      Object.assign(user, { name, username, email, roleId, active, updatedAt: now() });
      if (req.body.password) {
        if (String(req.body.password).length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');
        user.passwordHash = hashPassword(String(req.body.password));
        user.passwordChangedAt = now();
      }
      appendTimeline(data, { type: 'security', title: 'Usuario actualizado', detail: `${user.name} · ${data.roles.find((role) => role.id === roleId)?.name} · ${user.active ? 'Activo' : 'Inactivo'}`, by: req.user.name });
      return sanitizeUser(user, data);
    });
    res.json(result);
  });

  router.delete('/users/:id', requireAuth(db), requirePermission('admin:users'), (req, res) => {
    const result = db.transact((data) => {
      const user = data.users.find((item) => item.id === Number(req.params.id));
      if (!user) throw new Error('Usuario no encontrado.');
      if (user.id === req.user.id) throw new Error('No podés desactivar tu propio usuario.');
      user.active = false;
      user.updatedAt = now();
      appendTimeline(data, { type: 'security', title: 'Usuario desactivado', detail: user.name, by: req.user.name });
      return { ok: true, userId: user.id };
    });
    res.json(result);
  });

  return router;
}
