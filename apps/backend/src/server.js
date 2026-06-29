import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import { env } from './config/env.js';
import { JsonDatabase } from './db/jsonDatabase.js';
import { hashPassword, initialData, now, uid } from './db/initialData.js';
import { createSession, requireAuth, requirePermission, sanitizeUser, verifyPassword } from './features/auth.js';
import { bootstrapFor, enrichProject } from './features/serializers.js';
import {
  appendTimeline,
  completeStage,
  createApprovalRequest,
  createChecklistForStages,
  createProjectStages,
  generateProjectCode,
  getTransitionForStage,
  hasOpenApproval,
  nextNumericId,
  notify,
  notifyStageAssignment,
  defaultUserForRole,
  updateProjectStatus
} from './features/workflow.js';

fs.mkdirSync(env.uploadDir, { recursive: true });
const upload = multer({ dest: env.uploadDir });
const db = new JsonDatabase(env.dataFile, initialData);
const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(env.uploadDir));

function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function upsertByProject(data, collection, projectId, payload, extra = {}) {
  let row = data[collection].find((item) => item.projectId === projectId);
  if (!row) {
    row = { id: nextNumericId(data, collection), projectId, createdAt: now(), ...extra };
    data[collection].push(row);
  }
  Object.assign(row, payload, { updatedAt: now() });
  return row;
}

function registerDecision(data, payload, user) {
  const decision = {
    id: nextNumericId(data, 'decisions'),
    code: payload.code || 'MANUAL',
    projectId: Number(payload.projectId),
    projectStageId: payload.projectStageId ? Number(payload.projectStageId) : null,
    title: payload.title,
    decision: payload.decision,
    rationale: payload.rationale || '',
    byUserId: user.id,
    createdAt: now()
  };
  data.decisions.push(decision);
  appendTimeline(data, {
    type: 'decision',
    title: `Decisión registrada: ${decision.title}`,
    detail: `${decision.decision}. ${decision.rationale}`,
    by: user.name,
    projectId: decision.projectId,
    projectStageId: decision.projectStageId
  });
  return decision;
}


function requireBody(fields, body) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
      throw new Error(`Campo obligatorio: ${field}`);
    }
  }
}

function normalizeCode(value, fallback = '') {
  return String(value || fallback).trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
}

function collectionLabel(collection) {
  return ({ businessUnits: 'unidad de negocio', categories: 'categoría', subcategories: 'subcategoría' }[collection] || collection);
}

function parseItems(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '').split('\n').flatMap((line) => line.split(',')).map((item) => item.trim()).filter(Boolean);
}

function parseFields(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error('Los campos del formulario deben ser un JSON válido.');
  }
}


function latestDocumentVersion(data, payload) {
  const related = data.documents.filter((doc) => {
    if (payload.templateId) return doc.projectId === payload.projectId && doc.projectStageId === payload.projectStageId && doc.templateId === payload.templateId;
    return doc.projectId === payload.projectId && doc.projectStageId === payload.projectStageId && doc.name === payload.name;
  }).sort((a, b) => (b.versionNumber || 1) - (a.versionNumber || 1));
  return related[0] || null;
}

function documentStatusClass(status) {
  return ['Pendiente', 'Cargado', 'Observado', 'Aprobado'].includes(status) ? status : 'Cargado';
}

function checkDueNotifications(data) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const exists = (type, refId) => data.notifications.some((n) => n.type === type && n.refId === refId && String(n.createdAt || '').slice(0, 10) === todayKey && !n.read);
  for (const stage of data.projectStages || []) {
    if (['Completa', 'Bloqueada'].includes(stage.status) || !stage.dueDate) continue;
    const diff = Math.ceil((new Date(`${stage.dueDate}T23:59:59`) - new Date()) / 86400000);
    if (diff <= 2 && !exists('sla', `stage-${stage.id}`)) {
      notify(data, { title: diff < 0 ? 'Etapa vencida' : 'Etapa por vencer', message: `${stage.name} vence ${stage.dueDate}.`, userId: stage.assignedUserId, roleId: stage.responsibleRoleId, projectId: stage.projectId, projectStageId: stage.id, type: 'sla', refId: `stage-${stage.id}` });
    }
  }
  for (const task of data.marketingTasks || []) {
    if (task.status === 'Completo' || !task.dueDate) continue;
    const diff = Math.ceil((new Date(`${task.dueDate}T23:59:59`) - new Date()) / 86400000);
    if (diff <= 2 && !exists('marketing-due', `task-${task.id}`)) {
      notify(data, { title: task.status === 'Bloqueado' ? 'Tarea bloqueada' : 'Tarea de marketing por vencer', message: `${task.title} vence ${task.dueDate}.`, userId: task.ownerUserId, roleId: null, projectId: task.projectId, projectStageId: null, type: task.status === 'Bloqueado' ? 'blocker' : 'marketing-due', refId: `task-${task.id}` });
    }
  }
  for (const milestone of data.launchMilestones || []) {
    if (milestone.status === 'Completo' || !milestone.date) continue;
    const diff = Math.ceil((new Date(`${milestone.date}T23:59:59`) - new Date()) / 86400000);
    if (diff <= 7 && !exists('launch', `milestone-${milestone.id}`)) {
      notify(data, { title: diff < 0 ? 'Hito vencido' : 'Hito próximo', message: `${milestone.title} · ${milestone.date}.`, userId: null, roleId: milestone.ownerRoleId, projectId: milestone.projectId, projectStageId: null, type: 'launch', refId: `milestone-${milestone.id}` });
    }
  }
}

function ensureStageOrder(data, workflowId) {
  const workflowStages = data.stages.filter((stage) => stage.workflowId === Number(workflowId)).sort((a, b) => a.order - b.order || a.id - b.id);
  workflowStages.forEach((stage, index) => { stage.order = index + 1; });
  const workflow = data.workflows.find((item) => item.id === Number(workflowId));
  if (workflow) workflow.stageIds = workflowStages.map((stage) => stage.id);
}

function createDefaultForm(data, stageName, fields = []) {
  const form = {
    id: nextNumericId(data, 'forms'),
    name: stageName,
    description: 'Formulario configurable creado desde Administración.',
    fields: fields.length ? fields : [
      { key: 'observaciones', label: 'Observaciones', type: 'textarea' },
      { key: 'resultado', label: 'Resultado', type: 'select', options: ['Pendiente', 'Aprobado', 'Requiere ajustes'] }
    ]
  };
  data.forms.push(form);
  return form;
}

function createDefaultChecklist(data, stageId, items) {
  const template = { id: nextNumericId(data, 'checklistTemplates'), stageId, items: parseItems(items || 'Tarea principal, Validación completa, Documentación adjunta') };
  data.checklistTemplates.push(template);
  return template;
}

function createDefaultDocumentTemplate(data, stageId, payload = {}) {
  const template = {
    id: nextNumericId(data, 'documentTemplates'),
    name: payload.documentName || `Documento requerido etapa ${stageId}`,
    stageId,
    type: payload.documentType || 'general',
    required: payload.documentRequired !== false
  };
  data.documentTemplates.push(template);
  return template;
}

app.get('/api/health', (req, res) => {
  const data = db.read();
  res.json({ ok: true, product: data.meta.product, version: data.meta.version });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const data = db.read();
  const user = data.users.find((u) => (u.username === username || u.email === username) && u.active);
  if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  const token = createSession(db, user, req);
  const fresh = db.read();
  res.json({ token, user: sanitizeUser(user, fresh) });
});

app.post('/api/auth/password/recovery/start', (req, res) => {
  const { username } = req.body;
  const result = db.transact((data) => {
    const user = data.users.find((u) => u.username === username || u.email === username);
    const token = uid('pwd');
    data.passwordRecoveryRequests.push({ id: uid('rec'), username, userId: user?.id || null, token, usedAt: null, createdAt: now() });
    data.timeline.push({ id: uid('tl'), type: 'security', title: 'Solicitud de recuperación', detail: `Se solicitó recuperación para ${username}.`, by: 'Sistema', createdAt: now() });
    return { ok: true, message: 'Solicitud registrada. Base lista para conectar email corporativo.', devToken: token };
  });
  res.json(result);
});

app.get('/api/bootstrap', requireAuth(db), (req, res) => {
  db.transact((data) => {
    checkDueNotifications(data);
    return data.meta;
  });
  res.json(bootstrapFor(db.read(), req.user));
});

app.get('/api/security/sessions', requireAuth(db), requirePermission('admin:users'), (req, res) => {
  res.json(db.read().sessions.slice().reverse());
});

app.post('/api/users', requireAuth(db), requirePermission('admin:users'), (req, res) => {
  const created = db.transact((data) => {
    const id = nextNumericId(data, 'users');
    if (data.users.some((u) => u.username === req.body.username || u.email === req.body.email)) throw new Error('Ya existe un usuario con ese usuario/email.');
    const user = {
      id,
      name: req.body.name,
      email: req.body.email,
      username: req.body.username,
      roleId: req.body.roleId,
      passwordHash: hashPassword(req.body.password || '1234'),
      active: req.body.active !== false,
      createdAt: now()
    };
    data.users.push(user);
    appendTimeline(data, { type: 'admin', title: 'Usuario creado', detail: `${user.name} fue dado de alta.`, by: req.user.name });
    return publicUser(user);
  });
  res.json(created);
});

app.put('/api/users/:id', requireAuth(db), requirePermission('admin:users'), (req, res) => {
  const updated = db.transact((data) => {
    const user = data.users.find((u) => u.id === Number(req.params.id));
    if (!user) throw new Error('Usuario no encontrado.');
    Object.assign(user, {
      name: req.body.name ?? user.name,
      email: req.body.email ?? user.email,
      username: req.body.username ?? user.username,
      roleId: req.body.roleId ?? user.roleId,
      active: req.body.active ?? user.active,
      updatedAt: now()
    });
    if (req.body.password) user.passwordHash = hashPassword(req.body.password);
    appendTimeline(data, { type: 'admin', title: 'Usuario actualizado', detail: `${user.name} fue modificado.`, by: req.user.name });
    return publicUser(user);
  });
  res.json(updated);
});

app.delete('/api/users/:id', requireAuth(db), requirePermission('admin:users'), (req, res) => {
  const result = db.transact((data) => {
    const user = data.users.find((u) => u.id === Number(req.params.id));
    if (!user) throw new Error('Usuario no encontrado.');
    if (user.id === req.user.id) throw new Error('No podés desactivar tu propio usuario desde esta pantalla.');
    user.active = false;
    user.updatedAt = now();
    appendTimeline(data, { type: 'admin', title: 'Usuario desactivado', detail: `${user.name} quedó inactivo.`, by: req.user.name });
    return publicUser(user);
  });
  res.json(result);
});

app.post('/api/roles', requireAuth(db), requirePermission('admin:roles'), (req, res) => {
  const role = db.transact((data) => {
    const created = { id: uid('role'), code: req.body.code, name: req.body.name, description: req.body.description || '', permissionIds: req.body.permissionIds || [] };
    data.roles.push(created);
    appendTimeline(data, { type: 'admin', title: 'Rol creado', detail: `${created.name} agregado.`, by: req.user.name });
    return created;
  });
  res.json(role);
});

app.put('/api/roles/:id', requireAuth(db), requirePermission('admin:roles'), (req, res) => {
  const role = db.transact((data) => {
    const item = data.roles.find((r) => r.id === req.params.id);
    if (!item) throw new Error('Rol no encontrado.');
    Object.assign(item, req.body);
    appendTimeline(data, { type: 'admin', title: 'Rol actualizado', detail: `${item.name} modificado.`, by: req.user.name });
    return item;
  });
  res.json(role);
});

app.delete('/api/roles/:id', requireAuth(db), requirePermission('admin:roles'), (req, res) => {
  const result = db.transact((data) => {
    const role = data.roles.find((r) => r.id === req.params.id);
    if (!role) throw new Error('Rol no encontrado.');
    if (role.code === 'ADMIN') throw new Error('El rol Administrador no se puede eliminar.');
    if (data.users.some((user) => user.roleId === role.id && user.active)) throw new Error('No se puede eliminar un rol con usuarios activos. Desactivalos o reasignalos primero.');
    data.roles = data.roles.filter((r) => r.id !== role.id);
    appendTimeline(data, { type: 'admin', title: 'Rol eliminado', detail: `${role.name} eliminado.`, by: req.user.name });
    return { ok: true };
  });
  res.json(result);
});

app.post('/api/catalog/:collection', requireAuth(db), requirePermission('admin:catalogs'), (req, res) => {
  const allowed = ['businessUnits', 'categories', 'subcategories'];
  if (!allowed.includes(req.params.collection)) return res.status(400).json({ error: 'Catálogo inválido.' });
  const item = db.transact((data) => {
    const id = nextNumericId(data, req.params.collection);
    const created = { id, active: true, ...req.body };
    data[req.params.collection].push(created);
    appendTimeline(data, { type: 'admin', title: 'Catálogo actualizado', detail: `Alta en ${req.params.collection}: ${created.name}.`, by: req.user.name });
    return created;
  });
  res.json(item);
});

app.put('/api/catalog/:collection/:id', requireAuth(db), requirePermission('admin:catalogs'), (req, res) => {
  const allowed = ['businessUnits', 'categories', 'subcategories'];
  if (!allowed.includes(req.params.collection)) return res.status(400).json({ error: 'Catálogo inválido.' });
  const item = db.transact((data) => {
    const row = data[req.params.collection].find((x) => x.id === Number(req.params.id));
    if (!row) throw new Error(`${collectionLabel(req.params.collection)} no encontrada.`);
    Object.assign(row, req.body, { updatedAt: now() });
    if (row.businessUnitId !== undefined) row.businessUnitId = Number(row.businessUnitId);
    if (row.categoryId !== undefined) row.categoryId = Number(row.categoryId);
    appendTimeline(data, { type: 'admin', title: 'Catálogo actualizado', detail: `${collectionLabel(req.params.collection)}: ${row.name}.`, by: req.user.name });
    return row;
  });
  res.json(item);
});

app.delete('/api/catalog/:collection/:id', requireAuth(db), requirePermission('admin:catalogs'), (req, res) => {
  const allowed = ['businessUnits', 'categories', 'subcategories'];
  if (!allowed.includes(req.params.collection)) return res.status(400).json({ error: 'Catálogo inválido.' });
  const result = db.transact((data) => {
    const row = data[req.params.collection].find((x) => x.id === Number(req.params.id));
    if (!row) throw new Error(`${collectionLabel(req.params.collection)} no encontrada.`);
    const id = Number(req.params.id);
    const used = req.params.collection === 'businessUnits' ? data.projects.some((p) => p.businessUnitId === id) || data.categories.some((c) => c.businessUnitId === id)
      : req.params.collection === 'categories' ? data.projects.some((p) => p.categoryId === id) || data.subcategories.some((s) => s.categoryId === id)
      : data.projects.some((p) => p.subcategoryId === id);
    if (used) {
      row.active = false;
      row.updatedAt = now();
      appendTimeline(data, { type: 'admin', title: 'Catálogo desactivado', detail: `${collectionLabel(req.params.collection)} ${row.name} quedó inactiva por tener uso histórico.`, by: req.user.name });
      return row;
    }
    data[req.params.collection] = data[req.params.collection].filter((x) => x.id !== id);
    appendTimeline(data, { type: 'admin', title: 'Catálogo eliminado', detail: `${collectionLabel(req.params.collection)} ${row.name} eliminado.`, by: req.user.name });
    return { ok: true };
  });
  res.json(result);
});


app.post('/api/workflows', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    requireBody(['name'], req.body);
    const id = nextNumericId(data, 'workflows');
    const workflow = {
      id,
      code: normalizeCode(req.body.code, `WF-${id}`),
      name: req.body.name,
      version: req.body.version || '1.0.0',
      active: req.body.active !== false,
      description: req.body.description || '',
      stageIds: []
    };
    data.workflows.push(workflow);
    appendTimeline(data, { type: 'workflow-config', title: 'Workflow creado', detail: `${workflow.code} · ${workflow.name}`, by: req.user.name });
    return workflow;
  });
  res.json(result);
});

app.put('/api/workflows/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const workflow = data.workflows.find((item) => item.id === Number(req.params.id));
    if (!workflow) throw new Error('Workflow no encontrado.');
    Object.assign(workflow, {
      code: req.body.code !== undefined ? normalizeCode(req.body.code, workflow.code) : workflow.code,
      name: req.body.name ?? workflow.name,
      version: req.body.version ?? workflow.version,
      active: req.body.active !== undefined ? Boolean(req.body.active) : workflow.active,
      description: req.body.description ?? workflow.description,
      updatedAt: now()
    });
    appendTimeline(data, { type: 'workflow-config', title: 'Workflow actualizado', detail: `${workflow.code} · ${workflow.name}`, by: req.user.name });
    return workflow;
  });
  res.json(result);
});

app.delete('/api/workflows/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const workflowId = Number(req.params.id);
    const workflow = data.workflows.find((item) => item.id === workflowId);
    if (!workflow) throw new Error('Workflow no encontrado.');
    if (data.projects.some((project) => project.workflowId === workflowId)) throw new Error('No se puede eliminar un workflow con proyectos asociados. Podés desactivarlo.');
    const stageIds = data.stages.filter((stage) => stage.workflowId === workflowId).map((stage) => stage.id);
    data.transitions = data.transitions.filter((transition) => transition.workflowId !== workflowId);
    data.stages = data.stages.filter((stage) => stage.workflowId !== workflowId);
    data.forms = data.forms.filter((form) => !stageIds.some((stageId) => data.stages.find((s) => s.id === stageId)?.formId === form.id));
    data.checklistTemplates = data.checklistTemplates.filter((tpl) => !stageIds.includes(tpl.stageId));
    data.documentTemplates = data.documentTemplates.filter((tpl) => !stageIds.includes(tpl.stageId));
    data.workflows = data.workflows.filter((item) => item.id !== workflowId);
    appendTimeline(data, { type: 'workflow-config', title: 'Workflow eliminado', detail: `${workflow.code} · ${workflow.name}`, by: req.user.name });
    return { ok: true };
  });
  res.json(result);
});

app.post('/api/workflows/:id/stages', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const workflowId = Number(req.params.id);
    const workflow = data.workflows.find((item) => item.id === workflowId);
    if (!workflow) throw new Error('Workflow no encontrado.');
    requireBody(['name'], req.body);
    const form = req.body.formId ? data.forms.find((item) => item.id === Number(req.body.formId)) : createDefaultForm(data, req.body.name, parseFields(req.body.fieldsJson));
    if (!form) throw new Error('Formulario no encontrado.');
    const stage = {
      id: nextNumericId(data, 'stages'),
      workflowId,
      order: req.body.order ? Number(req.body.order) : data.stages.filter((item) => item.workflowId === workflowId).length + 1,
      phase: req.body.phase || 'Producto',
      name: req.body.name,
      responsibleRoleId: req.body.responsibleRoleId || 'role_jefe',
      slaDays: Number(req.body.slaDays || 1),
      formId: form.id,
      checklistTemplateId: null
    };
    data.stages.push(stage);
    const checklist = createDefaultChecklist(data, stage.id, req.body.checklistItems);
    const doc = createDefaultDocumentTemplate(data, stage.id, req.body);
    stage.checklistTemplateId = checklist.id;
    data.slas.push({ id: nextNumericId(data, 'slas'), stageId: stage.id, days: stage.slaDays, calendar: 'laboral', notifyBeforeDays: Number(req.body.notifyBeforeDays || 2) });
    ensureStageOrder(data, workflowId);
    appendTimeline(data, { type: 'workflow-config', title: 'Etapa creada', detail: `${workflow.name} · ${stage.name}`, by: req.user.name });
    return { stage, form, checklist, documentTemplate: doc };
  });
  res.json(result);
});

app.put('/api/stages/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const stage = data.stages.find((item) => item.id === Number(req.params.id));
    if (!stage) throw new Error('Etapa no encontrada.');
    Object.assign(stage, {
      order: req.body.order !== undefined ? Number(req.body.order) : stage.order,
      phase: req.body.phase ?? stage.phase,
      name: req.body.name ?? stage.name,
      responsibleRoleId: req.body.responsibleRoleId ?? stage.responsibleRoleId,
      slaDays: req.body.slaDays !== undefined ? Number(req.body.slaDays) : stage.slaDays,
      formId: req.body.formId !== undefined ? Number(req.body.formId) : stage.formId,
      checklistTemplateId: req.body.checklistTemplateId !== undefined ? Number(req.body.checklistTemplateId) : stage.checklistTemplateId,
      updatedAt: now()
    });
    const sla = data.slas.find((item) => item.stageId === stage.id);
    if (sla) sla.days = stage.slaDays;
    else data.slas.push({ id: nextNumericId(data, 'slas'), stageId: stage.id, days: stage.slaDays, calendar: 'laboral', notifyBeforeDays: 2 });
    ensureStageOrder(data, stage.workflowId);
    appendTimeline(data, { type: 'workflow-config', title: 'Etapa actualizada', detail: `${stage.order}. ${stage.name}`, by: req.user.name });
    return stage;
  });
  res.json(result);
});

app.delete('/api/stages/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const stage = data.stages.find((item) => item.id === Number(req.params.id));
    if (!stage) throw new Error('Etapa no encontrada.');
    if (data.projectStages.some((projectStage) => projectStage.stageId === stage.id)) throw new Error('No se puede eliminar una etapa usada por proyectos. Creá un nuevo workflow o duplicá el flujo para cambios mayores.');
    data.transitions = data.transitions.filter((transition) => transition.fromStageId !== stage.id && transition.toStageId !== stage.id);
    data.slas = data.slas.filter((sla) => sla.stageId !== stage.id);
    data.checklistTemplates = data.checklistTemplates.filter((tpl) => tpl.stageId !== stage.id);
    data.documentTemplates = data.documentTemplates.filter((tpl) => tpl.stageId !== stage.id);
    data.stages = data.stages.filter((item) => item.id !== stage.id);
    ensureStageOrder(data, stage.workflowId);
    appendTimeline(data, { type: 'workflow-config', title: 'Etapa eliminada', detail: stage.name, by: req.user.name });
    return { ok: true };
  });
  res.json(result);
});

app.post('/api/forms', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    requireBody(['name'], req.body);
    const form = { id: nextNumericId(data, 'forms'), name: req.body.name, description: req.body.description || '', fields: parseFields(req.body.fieldsJson || req.body.fields || '[]') };
    data.forms.push(form);
    appendTimeline(data, { type: 'workflow-config', title: 'Formulario creado', detail: form.name, by: req.user.name });
    return form;
  });
  res.json(result);
});

app.put('/api/forms/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const form = data.forms.find((item) => item.id === Number(req.params.id));
    if (!form) throw new Error('Formulario no encontrado.');
    Object.assign(form, {
      name: req.body.name ?? form.name,
      description: req.body.description ?? form.description,
      fields: req.body.fieldsJson !== undefined || req.body.fields !== undefined ? parseFields(req.body.fieldsJson || req.body.fields) : form.fields,
      updatedAt: now()
    });
    appendTimeline(data, { type: 'workflow-config', title: 'Formulario actualizado', detail: form.name, by: req.user.name });
    return form;
  });
  res.json(result);
});

app.delete('/api/forms/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const formId = Number(req.params.id);
    if (data.stages.some((stage) => stage.formId === formId)) throw new Error('No se puede eliminar un formulario usado por una etapa.');
    data.forms = data.forms.filter((item) => item.id !== formId);
    appendTimeline(data, { type: 'workflow-config', title: 'Formulario eliminado', detail: `ID ${formId}`, by: req.user.name });
    return { ok: true };
  });
  res.json(result);
});

app.post('/api/transitions', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    requireBody(['workflowId', 'fromStageId', 'toStageId', 'action'], req.body);
    const transition = {
      id: nextNumericId(data, 'transitions'),
      workflowId: Number(req.body.workflowId),
      fromStageId: Number(req.body.fromStageId),
      toStageId: Number(req.body.toStageId),
      action: req.body.action,
      requiresApproval: Boolean(req.body.requiresApproval),
      approverRoleId: req.body.approverRoleId || null,
      decisionCode: req.body.decisionCode || 'MANUAL'
    };
    data.transitions.push(transition);
    appendTimeline(data, { type: 'workflow-config', title: 'Transición creada', detail: transition.action, by: req.user.name });
    return transition;
  });
  res.json(result);
});

app.put('/api/transitions/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const transition = data.transitions.find((item) => item.id === Number(req.params.id));
    if (!transition) throw new Error('Transición no encontrada.');
    Object.assign(transition, {
      workflowId: req.body.workflowId !== undefined ? Number(req.body.workflowId) : transition.workflowId,
      fromStageId: req.body.fromStageId !== undefined ? Number(req.body.fromStageId) : transition.fromStageId,
      toStageId: req.body.toStageId !== undefined ? Number(req.body.toStageId) : transition.toStageId,
      action: req.body.action ?? transition.action,
      requiresApproval: req.body.requiresApproval !== undefined ? Boolean(req.body.requiresApproval) : transition.requiresApproval,
      approverRoleId: req.body.approverRoleId !== undefined ? req.body.approverRoleId || null : transition.approverRoleId,
      decisionCode: req.body.decisionCode ?? transition.decisionCode,
      updatedAt: now()
    });
    appendTimeline(data, { type: 'workflow-config', title: 'Transición actualizada', detail: transition.action, by: req.user.name });
    return transition;
  });
  res.json(result);
});

app.delete('/api/transitions/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const id = Number(req.params.id);
    data.transitions = data.transitions.filter((item) => item.id !== id);
    appendTimeline(data, { type: 'workflow-config', title: 'Transición eliminada', detail: `ID ${id}`, by: req.user.name });
    return { ok: true };
  });
  res.json(result);
});

app.put('/api/checklist-templates/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const template = data.checklistTemplates.find((item) => item.id === Number(req.params.id));
    if (!template) throw new Error('Plantilla de checklist no encontrada.');
    template.items = parseItems(req.body.items);
    template.updatedAt = now();
    appendTimeline(data, { type: 'workflow-config', title: 'Checklist plantilla actualizada', detail: `Etapa ${template.stageId}`, by: req.user.name });
    return template;
  });
  res.json(result);
});

app.put('/api/document-templates/:id', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const template = data.documentTemplates.find((item) => item.id === Number(req.params.id));
    if (!template) throw new Error('Plantilla documental no encontrada.');
    Object.assign(template, {
      name: req.body.name ?? template.name,
      type: req.body.type ?? template.type,
      required: req.body.required !== undefined ? Boolean(req.body.required) : template.required,
      updatedAt: now()
    });
    appendTimeline(data, { type: 'workflow-config', title: 'Documento plantilla actualizado', detail: template.name, by: req.user.name });
    return template;
  });
  res.json(result);
});

app.post('/api/flowchart-decisions', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    requireBody(['code', 'name', 'question'], req.body);
    const decision = { code: normalizeCode(req.body.code), name: req.body.name, question: req.body.question, positive: req.body.positive || '', negative: req.body.negative || '' };
    if (data.flowchartDecisions.some((item) => item.code === decision.code)) throw new Error('Ya existe una decisión con ese código.');
    data.flowchartDecisions.push(decision);
    appendTimeline(data, { type: 'workflow-config', title: 'Decisión del flujograma creada', detail: `${decision.code} · ${decision.name}`, by: req.user.name });
    return decision;
  });
  res.json(result);
});

app.put('/api/flowchart-decisions/:code', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    const decision = data.flowchartDecisions.find((item) => item.code === req.params.code);
    if (!decision) throw new Error('Decisión del flujograma no encontrada.');
    Object.assign(decision, { name: req.body.name ?? decision.name, question: req.body.question ?? decision.question, positive: req.body.positive ?? decision.positive, negative: req.body.negative ?? decision.negative, updatedAt: now() });
    appendTimeline(data, { type: 'workflow-config', title: 'Decisión del flujograma actualizada', detail: `${decision.code} · ${decision.name}`, by: req.user.name });
    return decision;
  });
  res.json(result);
});

app.delete('/api/flowchart-decisions/:code', requireAuth(db), requirePermission('workflow:configure'), (req, res) => {
  const result = db.transact((data) => {
    data.flowchartDecisions = data.flowchartDecisions.filter((item) => item.code !== req.params.code);
    appendTimeline(data, { type: 'workflow-config', title: 'Decisión del flujograma eliminada', detail: req.params.code, by: req.user.name });
    return { ok: true };
  });
  res.json(result);
});

app.get('/api/projects', requireAuth(db), requirePermission('projects:read'), (req, res) => {
  const data = db.read();
  res.json(data.projects.map((p) => enrichProject(p, data)));
});

app.post('/api/projects', requireAuth(db), requirePermission('projects:create'), (req, res) => {
  const project = db.transact((data) => {
    const id = nextNumericId(data, 'projects');
    const created = {
      id,
      code: req.body.code || generateProjectCode(data),
      name: req.body.name,
      businessUnitId: Number(req.body.businessUnitId),
      categoryId: Number(req.body.categoryId),
      subcategoryId: Number(req.body.subcategoryId),
      responsibleUserId: Number(req.body.responsibleUserId),
      targetDate: req.body.targetDate,
      status: req.body.status || 'Solicitud',
      priority: req.body.priority || 'Media',
      workflowId: Number(req.body.workflowId || 1),
      createdBy: req.user.id,
      createdAt: now(),
      updatedAt: now()
    };
    data.projects.push(created);
    const stages = createProjectStages(id, created.workflowId, data, req.body.stageAssignments || {});
    data.projectStages.push(...stages);
    data.checklistItems.push(...createChecklistForStages(data, id, stages));
    data.projectBriefs.push({ id: nextNumericId(data, 'projectBriefs'), projectId: id, origenSolicitud: '', necesidad: '', clienteObjetivo: '', fechaObjetivo: req.body.targetDate, oportunidad: '', createdAt: now(), updatedAt: now() });
    appendTimeline(data, { type: 'project', title: 'Proyecto creado', detail: `${created.code} · ${created.name}`, by: req.user.name, projectId: id });
    stages.forEach((stage) => notifyStageAssignment(data, stage, created, stage.status === 'Bloqueada'));
    const firstStage = stages.find((stage) => stage.order === 1);
    if (firstStage) appendTimeline(data, { type: 'workflow', title: 'Primera etapa habilitada', detail: `${firstStage.name} asignada a ${data.users.find((user) => user.id === firstStage.assignedUserId)?.name || 'responsable'}.`, by: 'Sistema', projectId: id, projectStageId: firstStage.id });
    return enrichProject(created, data);
  });
  res.json(project);
});

app.put('/api/projects/:id', requireAuth(db), requirePermission('projects:update'), (req, res) => {
  const project = db.transact((data) => {
    const item = data.projects.find((p) => p.id === Number(req.params.id));
    if (!item) throw new Error('Proyecto no encontrado.');
    Object.assign(item, {
      name: req.body.name ?? item.name,
      businessUnitId: req.body.businessUnitId ? Number(req.body.businessUnitId) : item.businessUnitId,
      categoryId: req.body.categoryId ? Number(req.body.categoryId) : item.categoryId,
      subcategoryId: req.body.subcategoryId ? Number(req.body.subcategoryId) : item.subcategoryId,
      responsibleUserId: req.body.responsibleUserId ? Number(req.body.responsibleUserId) : item.responsibleUserId,
      targetDate: req.body.targetDate ?? item.targetDate,
      status: req.body.status ?? item.status,
      priority: req.body.priority ?? item.priority,
      updatedAt: now()
    });
    appendTimeline(data, { type: 'project', title: 'Proyecto actualizado', detail: `${item.code} · ${item.name}`, by: req.user.name, projectId: item.id });
    return enrichProject(item, data);
  });
  res.json(project);
});

app.delete('/api/projects/:id', requireAuth(db), requirePermission('projects:close'), (req, res) => {
  const result = db.transact((data) => {
    const project = data.projects.find((p) => p.id === Number(req.params.id));
    if (!project) throw new Error('Proyecto no encontrado.');
    project.status = 'Cerrado';
    project.closedAt = now();
    project.updatedAt = now();
    appendTimeline(data, { type: 'project', title: 'Proyecto cerrado/desactivado', detail: `${project.code} · ${project.name}`, by: req.user.name, projectId: project.id });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.put('/api/projects/:id/brief', requireAuth(db), requirePermission('brief:update'), (req, res) => {
  const result = db.transact((data) => {
    const projectId = Number(req.params.id);
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Proyecto no encontrado.');
    const brief = upsertByProject(data, 'projectBriefs', projectId, req.body);
    appendTimeline(data, { type: 'brief', title: 'Brief actualizado', detail: `${project.code} · ${project.name}`, by: req.user.name, projectId });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.put('/api/projects/:id/product-analysis', requireAuth(db), requirePermission('analysis:update'), (req, res) => {
  const result = db.transact((data) => {
    const projectId = Number(req.params.id);
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Proyecto no encontrado.');
    const analysis = upsertByProject(data, 'productAnalyses', projectId, req.body, { analystUserId: req.user.id });
    analysis.analystUserId = req.user.id;
    appendTimeline(data, { type: 'analysis', title: 'Análisis de producto actualizado', detail: `${project.code} · recomendación: ${analysis.recomendacion || '-'}`, by: req.user.name, projectId });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.put('/api/projects/:id/launch-plan', requireAuth(db), requirePermission('marketing:manage'), (req, res) => {
  const result = db.transact((data) => {
    const projectId = Number(req.params.id);
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Proyecto no encontrado.');
    const plan = upsertByProject(data, 'launchPlans', projectId, { ...req.body, marketingOwnerUserId: req.user.id });
    appendTimeline(data, { type: 'marketing', title: 'Plan de marketing actualizado', detail: plan.mainMessage || 'Plan actualizado.', by: req.user.name, projectId });
    return enrichProject(project, data);
  });
  res.json(result);
});



app.post('/api/projects/:id/marketing-tasks', requireAuth(db), requirePermission('marketing:manage'), (req, res) => {
  const result = db.transact((data) => {
    const projectId = Number(req.params.id);
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Proyecto no encontrado.');
    data.marketingTasks ||= [];
    const task = {
      id: nextNumericId(data, 'marketingTasks'),
      projectId,
      title: req.body.title,
      channel: req.body.channel || 'General',
      status: req.body.status || 'Pendiente',
      priority: req.body.priority || 'Media',
      dueDate: req.body.dueDate,
      ownerUserId: req.body.ownerUserId ? Number(req.body.ownerUserId) : req.user.id,
      required: req.body.required !== false,
      notes: req.body.notes || '',
      createdAt: now(),
      updatedAt: now()
    };
    data.marketingTasks.push(task);
    appendTimeline(data, { type: 'marketing', title: 'Tarea de marketing creada', detail: `${task.title} · ${task.channel}`, by: req.user.name, projectId });
    notify(data, { title: 'Nueva tarea de marketing', message: task.title, userId: task.ownerUserId, roleId: 'role_marketing', projectId, projectStageId: null, type: 'marketing' });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.put('/api/marketing-tasks/:id', requireAuth(db), requirePermission('marketing:manage'), (req, res) => {
  const result = db.transact((data) => {
    const task = (data.marketingTasks || []).find((item) => item.id === Number(req.params.id));
    if (!task) throw new Error('Tarea de marketing no encontrada.');
    Object.assign(task, {
      title: req.body.title ?? task.title,
      channel: req.body.channel ?? task.channel,
      status: req.body.status ?? task.status,
      priority: req.body.priority ?? task.priority,
      dueDate: req.body.dueDate ?? task.dueDate,
      ownerUserId: req.body.ownerUserId !== undefined ? Number(req.body.ownerUserId) : task.ownerUserId,
      required: req.body.required !== undefined ? Boolean(req.body.required) : task.required,
      notes: req.body.notes ?? task.notes,
      updatedAt: now()
    });
    const project = data.projects.find((p) => p.id === task.projectId);
    appendTimeline(data, { type: 'marketing', title: 'Tarea de marketing actualizada', detail: `${task.title} · estado ${task.status}`, by: req.user.name, projectId: task.projectId });
    if (task.status === 'Completo') {
      notify(data, { title: 'Entregable marketing completo', message: task.title, userId: project?.responsibleUserId || null, roleId: 'role_jefe', projectId: task.projectId, projectStageId: null, type: 'marketing' });
    }
    return enrichProject(project, data);
  });
  res.json(result);
});

app.delete('/api/marketing-tasks/:id', requireAuth(db), requirePermission('marketing:manage'), (req, res) => {
  const result = db.transact((data) => {
    const task = (data.marketingTasks || []).find((item) => item.id === Number(req.params.id));
    if (!task) throw new Error('Tarea de marketing no encontrada.');
    data.marketingTasks = data.marketingTasks.filter((item) => item.id !== task.id);
    const project = data.projects.find((p) => p.id === task.projectId);
    appendTimeline(data, { type: 'marketing', title: 'Tarea de marketing eliminada', detail: task.title, by: req.user.name, projectId: task.projectId });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.post('/api/projects/:id/launch-milestones', requireAuth(db), requirePermission('launch:manage'), (req, res) => {
  const result = db.transact((data) => {
    const projectId = Number(req.params.id);
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Proyecto no encontrado.');
    data.launchMilestones ||= [];
    const milestone = {
      id: nextNumericId(data, 'launchMilestones'),
      projectId,
      title: req.body.title,
      date: req.body.date,
      type: req.body.type || 'Lanzamiento',
      status: req.body.status || 'Pendiente',
      ownerRoleId: req.body.ownerRoleId || 'role_marketing',
      createdAt: now(),
      updatedAt: now()
    };
    data.launchMilestones.push(milestone);
    appendTimeline(data, { type: 'launch', title: 'Hito de lanzamiento creado', detail: `${milestone.title} · ${milestone.date}`, by: req.user.name, projectId });
    notify(data, { title: 'Nuevo hito de lanzamiento', message: `${milestone.title} para ${milestone.date}`, userId: null, roleId: milestone.ownerRoleId, projectId, projectStageId: null, type: 'launch' });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.put('/api/launch-milestones/:id', requireAuth(db), requirePermission('launch:manage'), (req, res) => {
  const result = db.transact((data) => {
    const milestone = (data.launchMilestones || []).find((item) => item.id === Number(req.params.id));
    if (!milestone) throw new Error('Hito de lanzamiento no encontrado.');
    Object.assign(milestone, {
      title: req.body.title ?? milestone.title,
      date: req.body.date ?? milestone.date,
      type: req.body.type ?? milestone.type,
      status: req.body.status ?? milestone.status,
      ownerRoleId: req.body.ownerRoleId ?? milestone.ownerRoleId,
      updatedAt: now()
    });
    const project = data.projects.find((p) => p.id === milestone.projectId);
    appendTimeline(data, { type: 'launch', title: 'Hito de lanzamiento actualizado', detail: `${milestone.title} · estado ${milestone.status}`, by: req.user.name, projectId: milestone.projectId });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.delete('/api/launch-milestones/:id', requireAuth(db), requirePermission('launch:manage'), (req, res) => {
  const result = db.transact((data) => {
    const milestone = (data.launchMilestones || []).find((item) => item.id === Number(req.params.id));
    if (!milestone) throw new Error('Hito de lanzamiento no encontrado.');
    data.launchMilestones = data.launchMilestones.filter((item) => item.id !== milestone.id);
    const project = data.projects.find((p) => p.id === milestone.projectId);
    appendTimeline(data, { type: 'launch', title: 'Hito de lanzamiento eliminado', detail: milestone.title, by: req.user.name, projectId: milestone.projectId });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.put('/api/project-stages/:id', requireAuth(db), requirePermission('workflow:execute'), (req, res) => {
  const stage = db.transact((data) => {
    const item = data.projectStages.find((x) => x.id === Number(req.params.id));
    if (!item) throw new Error('Etapa no encontrada.');
    item.formData = { ...item.formData, ...(req.body.formData || {}) };
    const previousAssignee = item.assignedUserId;
    item.assignedUserId = req.body.assignedUserId === undefined ? item.assignedUserId : Number(req.body.assignedUserId) || defaultUserForRole(data, item.responsibleRoleId);
    item.status = req.body.status || item.status;
    item.updatedAt = now();
    appendTimeline(data, { type: 'workflow', title: 'Etapa actualizada', detail: `${item.name} fue actualizada.`, by: req.user.name, projectId: item.projectId, projectStageId: item.id });
    if (req.body.assignedUserId !== undefined && previousAssignee !== item.assignedUserId) {
      const project = data.projects.find((p) => p.id === item.projectId);
      appendTimeline(data, { type: 'assignment', title: 'Responsable de tarea actualizado', detail: `${item.name} asignada a ${data.users.find((user) => user.id === item.assignedUserId)?.name || 'responsable'}.`, by: req.user.name, projectId: item.projectId, projectStageId: item.id });
      notifyStageAssignment(data, item, project, item.status === 'Bloqueada');
    }
    updateProjectStatus(data, item.projectId);
    return item;
  });
  res.json(stage);
});

app.post('/api/project-stages/:id/approval/request', requireAuth(db), requirePermission('workflow:execute'), (req, res) => {
  const approval = db.transact((data) => {
    const item = data.projectStages.find((x) => x.id === Number(req.params.id));
    if (!item) throw new Error('Etapa no encontrada.');
    const transition = getTransitionForStage(data, item);
    if (!transition?.requiresApproval) throw new Error('Esta etapa no requiere aprobación configurada.');
    return createApprovalRequest(data, item, req.user, req.body.comment || '');
  });
  res.json(approval);
});

app.post('/api/project-stages/:id/complete', requireAuth(db), requirePermission('workflow:execute'), (req, res) => {
  const result = db.transact((data) => {
    const item = data.projectStages.find((x) => x.id === Number(req.params.id));
    if (!item) throw new Error('Etapa no encontrada.');
    const transition = getTransitionForStage(data, item);
    if (transition?.requiresApproval) {
      const approved = data.approvalRequests.find((approval) => approval.projectStageId === item.id && approval.status === 'Aprobado');
      if (!approved) {
        createApprovalRequest(data, item, req.user, req.body.comment || 'Solicitud generada al intentar completar etapa.');
        const project = data.projects.find((p) => p.id === item.projectId);
        return enrichProject(project, data);
      }
    }
    completeStage(data, item, req.user);
    const project = data.projects.find((p) => p.id === item.projectId);
    return enrichProject(project, data);
  });
  res.json(result);
});

app.put('/api/checklist-items/:id/toggle', requireAuth(db), requirePermission('checklist:update'), (req, res) => {
  const item = db.transact((data) => {
    const checklistItem = data.checklistItems.find((x) => x.id === Number(req.params.id));
    if (!checklistItem) throw new Error('Ítem de checklist no encontrado.');
    checklistItem.done = req.body.done !== undefined ? Boolean(req.body.done) : !checklistItem.done;
    checklistItem.doneBy = checklistItem.done ? req.user.id : null;
    checklistItem.doneAt = checklistItem.done ? now() : null;
    appendTimeline(data, {
      type: 'checklist',
      title: checklistItem.done ? 'Checklist completado' : 'Checklist reabierto',
      detail: checklistItem.label,
      by: req.user.name,
      projectId: checklistItem.projectId,
      projectStageId: checklistItem.projectStageId
    });
    return checklistItem;
  });
  res.json(item);
});

app.post('/api/approvals/:id/approve', requireAuth(db), requirePermission('approvals:manage'), (req, res) => {
  const result = db.transact((data) => {
    const approval = data.approvalRequests.find((item) => item.id === Number(req.params.id));
    if (!approval) throw new Error('Aprobación no encontrada.');
    if (approval.status !== 'Pendiente') throw new Error('La aprobación ya fue resuelta.');
    const stage = data.projectStages.find((item) => item.id === approval.projectStageId);
    approval.status = 'Aprobado';
    approval.resolvedAt = now();
    approval.resolvedBy = req.user.id;
    approval.resolutionComment = req.body.comment || '';
    registerDecision(data, {
      code: data.transitions.find((t) => t.id === approval.transitionId)?.decisionCode || 'APR',
      projectId: approval.projectId,
      projectStageId: approval.projectStageId,
      title: approval.title,
      decision: 'Aprobado',
      rationale: approval.resolutionComment
    }, req.user);
    completeStage(data, stage, req.user);
    const project = data.projects.find((p) => p.id === approval.projectId);
    notify(data, { title: 'Aprobación aceptada', message: `${approval.title} fue aprobada.`, userId: approval.requestedBy, roleId: null, projectId: approval.projectId, projectStageId: approval.projectStageId, type: 'approval' });
    return enrichProject(project, data);
  });
  res.json(result);
});

app.post('/api/approvals/:id/reject', requireAuth(db), requirePermission('approvals:manage'), (req, res) => {
  const result = db.transact((data) => {
    const approval = data.approvalRequests.find((item) => item.id === Number(req.params.id));
    if (!approval) throw new Error('Aprobación no encontrada.');
    if (approval.status !== 'Pendiente') throw new Error('La aprobación ya fue resuelta.');
    const stage = data.projectStages.find((item) => item.id === approval.projectStageId);
    approval.status = 'Rechazado';
    approval.resolvedAt = now();
    approval.resolvedBy = req.user.id;
    approval.resolutionComment = req.body.comment || '';
    if (stage) {
      stage.status = 'Requiere ajustes';
      stage.updatedAt = now();
    }
    registerDecision(data, {
      code: data.transitions.find((t) => t.id === approval.transitionId)?.decisionCode || 'REJ',
      projectId: approval.projectId,
      projectStageId: approval.projectStageId,
      title: approval.title,
      decision: 'Rechazado',
      rationale: approval.resolutionComment
    }, req.user);
    updateProjectStatus(data, approval.projectId);
    notify(data, { title: 'Aprobación rechazada', message: `${approval.title} requiere ajustes.`, userId: approval.requestedBy, roleId: null, projectId: approval.projectId, projectStageId: approval.projectStageId, type: 'rejection' });
    const project = data.projects.find((p) => p.id === approval.projectId);
    return enrichProject(project, data);
  });
  res.json(result);
});

app.post('/api/decisions', requireAuth(db), requirePermission('decisions:manage'), (req, res) => {
  const decision = db.transact((data) => registerDecision(data, req.body, req.user));
  res.json(decision);
});

app.post('/api/upload/:scope/:id', requireAuth(db), requirePermission('documents:upload'), upload.single('file'), (req, res) => {
  const scope = req.params.scope;
  const id = Number(req.params.id);
  const doc = db.transact((data) => {
    const stage = scope === 'stage' ? data.projectStages.find((s) => s.id === id) : null;
    const projectId = scope === 'project' ? id : stage?.projectId;
    if (!projectId) throw new Error('Proyecto o etapa no encontrada.');
    const templateId = req.body.templateId ? Number(req.body.templateId) : null;
    const previous = latestDocumentVersion(data, { projectId, projectStageId: stage?.id || null, templateId, name: req.file.originalname });
    const versionGroupId = previous?.versionGroupId || uid('docgrp');
    const document = {
      id: nextNumericId(data, 'documents'),
      name: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
      projectId,
      projectStageId: stage?.id || null,
      templateId,
      status: 'Cargado',
      versionNumber: previous ? (previous.versionNumber || 1) + 1 : 1,
      versionGroupId,
      uploadedBy: req.user.id,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now(),
      updatedAt: now()
    };
    data.documents.push(document);
    appendTimeline(data, { type: 'document', title: previous ? 'Nueva versión de documento' : 'Documento cargado', detail: `${document.name} · v${document.versionNumber}`, by: req.user.name, projectId: document.projectId, projectStageId: document.projectStageId });
    notify(data, { title: 'Documento cargado', message: `${document.name} fue cargado por ${req.user.name}.`, userId: null, roleId: 'role_jefe', projectId: document.projectId, projectStageId: document.projectStageId, type: 'document' });
    return document;
  });
  res.json(doc);
});

app.put('/api/documents/:id/status', requireAuth(db), requirePermission('documents:review'), (req, res) => {
  const result = db.transact((data) => {
    const doc = data.documents.find((item) => item.id === Number(req.params.id));
    if (!doc) throw new Error('Documento no encontrado.');
    doc.status = documentStatusClass(req.body.status);
    doc.reviewedBy = req.user.id;
    doc.reviewedAt = now();
    doc.updatedAt = now();
    if (req.body.comment) {
      data.documentComments = data.documentComments || [];
      data.documentComments.push({ id: nextNumericId(data, 'documentComments'), documentId: doc.id, projectId: doc.projectId, projectStageId: doc.projectStageId, comment: req.body.comment, byUserId: req.user.id, createdAt: now() });
    }
    appendTimeline(data, { type: 'document', title: `Documento ${doc.status.toLowerCase()}`, detail: `${doc.name}${req.body.comment ? ` · ${req.body.comment}` : ''}`, by: req.user.name, projectId: doc.projectId, projectStageId: doc.projectStageId });
    if (doc.status === 'Observado') notify(data, { title: 'Documento observado', message: `${doc.name} requiere corrección.`, userId: doc.uploadedBy, roleId: null, projectId: doc.projectId, projectStageId: doc.projectStageId, type: 'document' });
    if (doc.status === 'Aprobado') notify(data, { title: 'Documento aprobado', message: `${doc.name} fue aprobado.`, userId: doc.uploadedBy, roleId: null, projectId: doc.projectId, projectStageId: doc.projectStageId, type: 'document' });
    const project = data.projects.find((p) => p.id === doc.projectId);
    return enrichProject(project, data);
  });
  res.json(result);
});

app.post('/api/documents/:id/comments', requireAuth(db), requirePermission('documents:upload'), (req, res) => {
  const result = db.transact((data) => {
    const doc = data.documents.find((item) => item.id === Number(req.params.id));
    if (!doc) throw new Error('Documento no encontrado.');
    data.documentComments = data.documentComments || [];
    const comment = { id: nextNumericId(data, 'documentComments'), documentId: doc.id, projectId: doc.projectId, projectStageId: doc.projectStageId, comment: req.body.comment || '', byUserId: req.user.id, createdAt: now() };
    data.documentComments.push(comment);
    appendTimeline(data, { type: 'document', title: 'Comentario en documento', detail: `${doc.name}: ${comment.comment}`, by: req.user.name, projectId: doc.projectId, projectStageId: doc.projectStageId });
    return comment;
  });
  res.json(result);
});


app.put('/api/notifications/:id/read', requireAuth(db), requirePermission('notifications:read'), (req, res) => {
  db.transact((data) => {
    const item = data.notifications.find((n) => n.id === Number(req.params.id));
    if (item) item.read = true;
    return item || { ok: true };
  });
  res.json({ ok: true });
});

app.put('/api/notifications/:id/unread', requireAuth(db), requirePermission('notifications:read'), (req, res) => {
  db.transact((data) => {
    const item = data.notifications.find((n) => n.id === Number(req.params.id));
    if (item) item.read = false;
    return item || { ok: true };
  });
  res.json({ ok: true });
});

app.put('/api/notifications/read-all', requireAuth(db), requirePermission('notifications:read'), (req, res) => {
  db.transact((data) => {
    const currentUser = req.user;
    data.notifications.forEach((n) => {
      if (!n.userId || n.userId === currentUser.id || n.roleId === currentUser.roleId || currentUser.role?.code === 'ADMIN') n.read = true;
    });
    return { ok: true };
  });
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Error inesperado.' });
});

app.listen(env.port, () => {
  console.log(`SGI Diseño y Desarrollo API running on http://localhost:${env.port}`);
});
