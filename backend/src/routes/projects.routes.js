import { Router } from 'express';
import { requireAuth, requirePermission } from '../features/auth.js';
import { enrichProject } from '../features/serializers.js';
import { datePlus, now } from '../db/initialData.js';
import {
  appendTimeline,
  createChecklistForStages,
  createProjectStages,
  generateProjectCode,
  nextNumericId,
  notify,
  notifyStageAssignment,
  updateProjectStatus
} from '../features/workflow.js';
import { upsertByProject } from '../services/common.js';
import { dispatchEmailJobs, queueEmail, queueMarketingAssignmentEmail } from '../services/emailService.js';

const numeric = (value) => value === undefined || value === null || value === '' ? null : Number(value);

function canManageProject(user, project) {
  return user.role?.code === 'ADMIN' || project.responsibleUserId === user.id || user.permissions?.includes('projects:update');
}

function buildMarketingTask(data, projectId, payload) {
  const template = (data.marketingTaskTemplates || []).find((item) => item.id === Number(payload.templateId));
  const ownerUserId = Number(payload.ownerUserId);
  const owner = data.users.find((user) => user.id === ownerUserId && user.active);
  if (!owner) throw new Error('Seleccioná un usuario activo como responsable.');
  const durationDays = Math.max(1, Number(payload.durationDays || template?.durationDays || 1));
  const startDate = payload.startDate;
  if (!startDate) throw new Error('Indicá la fecha de inicio de la tarea.');
  const dueDate = payload.dueDate || datePlus(durationDays - 1, startDate);
  const title = payload.title || template?.title;
  if (!title) throw new Error('Indicá la tarea de Marketing.');
  return {
    id: nextNumericId(data, 'marketingTasks'),
    projectId,
    templateId: template?.id || null,
    title,
    area: payload.area || template?.area || payload.channel || 'Marketing',
    channel: payload.channel || template?.area || 'Marketing',
    durationDays,
    status: payload.status || 'Pendiente',
    priority: payload.priority || 'Media',
    startDate,
    dueDate,
    ownerUserId,
    required: payload.required !== false,
    notes: payload.notes || '',
    templateData: payload.templateData || {},
    progressPercent: Number(payload.progressPercent || 0),
    createdAt: now(),
    updatedAt: now()
  };
}

function registerMarketingAssignment(data, { project, task, assignedBy }) {
  const recipient = data.users.find((user) => user.id === task.ownerUserId);
  notify(data, {
    title: 'Nueva tarea del Plan de Marketing',
    message: `${task.title} · ${project.name} · vence ${task.dueDate}`,
    userId: task.ownerUserId,
    roleId: null,
    projectId: project.id,
    marketingTaskId: task.id,
    type: 'marketing'
  });
  const email = queueMarketingAssignmentEmail(data, { project, task, recipient, assignedBy });
  return email.id;
}

export function createProjectsRouter(db) {
  const router = Router();

  router.get('/projects', requireAuth(db), requirePermission('projects:read'), (req, res) => {
    const data = db.read();
    res.json(data.projects.filter((project) => !project.deletedAt).map((project) => enrichProject(project, data)));
  });

  router.post('/projects', requireAuth(db), requirePermission('projects:create'), (req, res) => {
    const result = db.transact((data) => {
      const id = nextNumericId(data, 'projects');
      const workflowId = Number(req.body.workflowId || 1);
      const workflow = data.workflows.find((item) => item.id === workflowId);
      const workflowStages = data.stages.filter((stage) => workflow?.stageIds?.includes(stage.id)).sort((a, b) => a.order - b.order);
      const startDate = req.body.startDate || new Date().toISOString().slice(0, 10);
      const selectedStageIds = (req.body.selectedStageIds || workflowStages.map((stage) => stage.id)).map(Number);
      const project = {
        id,
        code: req.body.code || generateProjectCode(data),
        name: req.body.name,
        businessUnitId: Number(req.body.businessUnitId),
        segmentId: Number(req.body.segmentId),
        categoryId: Number(req.body.categoryId),
        subcategoryId: Number(req.body.subcategoryId),
        responsibleUserId: Number(req.body.responsibleUserId),
        startDate,
        targetDate: req.body.targetDate,
        status: 'Solicitud',
        priority: req.body.priority || 'Media',
        workflowId,
        projectMode: 'nuevo',
        designOrigin: req.body.designOrigin || 'Diseño propio',
        createdBy: req.user.id,
        createdAt: now(),
        updatedAt: now()
      };
      data.projects.push(project);
      const projectStages = createProjectStages(id, workflowId, data, req.body.stageAssignments || {}, {
        startDate,
        currentStageId: selectedStageIds[0],
        stageIds: selectedStageIds,
        stageSchedules: req.body.stageSchedules || {}
      });
      data.projectStages.push(...projectStages);
      data.checklistItems.push(...createChecklistForStages(data, id, projectStages));
      data.projectBriefs.push({
        id: nextNumericId(data, 'projectBriefs'),
        projectId: id,
        status: 'Borrador',
        marketingReviewerUserId: numeric(req.body.marketingReviewerUserId),
        createdAt: now(),
        updatedAt: now()
      });
      data.launchPlans.push({
        id: nextNumericId(data, 'launchPlans'),
        projectId: id,
        marketingOwnerUserId: numeric(req.body.marketingReviewerUserId),
        status: 'Borrador',
        createdAt: now(),
        updatedAt: now()
      });
      updateProjectStatus(data, id);
      const active = projectStages.find((stage) => stage.status === 'En curso');
      if (active) notifyStageAssignment(data, active, project, false);
      appendTimeline(data, {
        type: 'project',
        title: 'Proyecto creado',
        detail: `${project.code} · ${project.name} · ${projectStages.length} tareas planificadas`,
        by: req.user.name,
        projectId: id
      });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.put('/projects/:id', requireAuth(db), requirePermission('projects:update'), (req, res) => {
    const result = db.transact((data) => {
      const project = data.projects.find((item) => item.id === Number(req.params.id));
      if (!project || project.deletedAt) throw new Error('Proyecto no encontrado.');
      if (!canManageProject(req.user, project)) throw new Error('No tenés permiso para editar este proyecto.');
      Object.assign(project, {
        name: req.body.name ?? project.name,
        responsibleUserId: numeric(req.body.responsibleUserId) ?? project.responsibleUserId,
        startDate: req.body.startDate ?? project.startDate,
        targetDate: req.body.targetDate ?? project.targetDate,
        priority: req.body.priority ?? project.priority,
        designOrigin: req.body.designOrigin ?? project.designOrigin,
        updatedAt: now()
      });
      appendTimeline(data, { type: 'project', title: 'Proyecto actualizado', detail: `${project.code} · ${project.name}`, by: req.user.name, projectId: project.id });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.delete('/projects/:id', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const project = data.projects.find((item) => item.id === Number(req.params.id));
      if (!project || project.deletedAt) throw new Error('Proyecto no encontrado.');
      if (!canManageProject(req.user, project) && project.createdBy !== req.user.id) throw new Error('Solo el creador o el jefe del proyecto pueden eliminarlo.');
      project.status = 'Eliminado';
      project.deletedAt = now();
      project.deletedBy = req.user.id;
      project.updatedAt = now();
      appendTimeline(data, { type: 'project', title: 'Proyecto eliminado', detail: `${project.code} · ${project.name}. La trazabilidad se conserva.`, by: req.user.name, projectId: project.id });
      return { ok: true, projectId: project.id };
    });
    res.json(result);
  });

  router.put('/projects/:id/brief', requireAuth(db), requirePermission('brief:update'), (req, res) => {
    const result = db.transact((data) => {
      const projectId = Number(req.params.id);
      const project = data.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Proyecto no encontrado.');
      const brief = upsertByProject(data, 'projectBriefs', projectId, { ...req.body, status: req.body.status || 'Borrador' });
      appendTimeline(data, { type: 'brief', title: 'Avance de brief guardado', detail: `${project.code} · estado ${brief.status}`, by: req.user.name, projectId });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.post('/projects/:id/brief/submit', requireAuth(db), requirePermission('brief:update'), (req, res) => {
    const result = db.transact((data) => {
      const projectId = Number(req.params.id);
      const project = data.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Proyecto no encontrado.');
      const brief = upsertByProject(data, 'projectBriefs', projectId, { ...req.body, status: 'Pendiente validación', submittedAt: now(), submittedBy: req.user.id });
      const marketingUser = data.users.find((user) => user.id === brief.marketingReviewerUserId) || data.users.find((user) => user.roleId === 'role_marketing' && user.active);
      brief.marketingReviewerUserId = marketingUser?.id || null;
      notify(data, {
        title: 'Brief pendiente de validación',
        message: `${project.code} · ${project.name} requiere revisión de Marketing.`,
        userId: marketingUser?.id || null,
        roleId: marketingUser ? null : 'role_marketing',
        projectId,
        type: 'brief-approval'
      });
      const emailJob = queueEmail(data, {
        toUserId: marketingUser?.id || null,
        to: marketingUser?.email || null,
        subject: `Brief para validar · ${project.code}`,
        body: `${req.user.name} envió el brief de ${project.name} para validación. Ingresá al SGI para revisarlo.`,
        projectId
      });
      appendTimeline(data, { type: 'brief', title: 'Brief enviado a validación', detail: `Responsable Marketing: ${marketingUser?.name || 'sin configurar'}`, by: req.user.name, projectId });
      return { project: enrichProject(project, data), emailJobIds: [emailJob.id] };
    });
    void dispatchEmailJobs(db, result.emailJobIds);
    res.json(result.project);
  });

  router.post('/projects/:id/brief/review', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const projectId = Number(req.params.id);
      const project = data.projects.find((item) => item.id === projectId);
      const brief = data.projectBriefs.find((item) => item.projectId === projectId);
      if (!project || !brief) throw new Error('Brief no encontrado.');
      const canReview = req.user.role?.code === 'ADMIN' || req.user.id === brief.marketingReviewerUserId || req.user.roleId === 'role_marketing';
      if (!canReview) throw new Error('Solo Marketing puede validar este brief.');
      const approved = req.body.decision === 'Aprobado';
      brief.status = approved ? 'Aprobado' : 'Observado';
      brief.reviewComment = req.body.comment || '';
      brief.reviewedAt = now();
      brief.reviewedBy = req.user.id;
      brief.updatedAt = now();
      notify(data, {
        title: approved ? 'Brief aprobado' : 'Brief observado',
        message: `${project.code} · ${project.name}${brief.reviewComment ? ` · ${brief.reviewComment}` : ''}`,
        userId: brief.submittedBy || project.responsibleUserId,
        roleId: null,
        projectId,
        type: 'brief-result'
      });
      appendTimeline(data, { type: 'brief', title: approved ? 'Brief aprobado' : 'Brief observado', detail: brief.reviewComment || 'Sin comentario.', by: req.user.name, projectId });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.put('/projects/:id/launch-plan', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const projectId = Number(req.params.id);
      const project = data.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Proyecto no encontrado.');
      if (!canManageProject(req.user, project) && req.user.roleId !== 'role_marketing') throw new Error('No tenés permiso para editar el plan de marketing.');
      upsertByProject(data, 'launchPlans', projectId, req.body);
      appendTimeline(data, { type: 'marketing', title: 'Plan de marketing actualizado', detail: project.name, by: req.user.name, projectId });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.post('/projects/:id/marketing-tasks', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const projectId = Number(req.params.id);
      const project = data.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Proyecto no encontrado.');
      if (!canManageProject(req.user, project)) throw new Error('Solo el jefe del proyecto puede asignar tareas del Plan de Marketing.');
      data.marketingTasks ||= [];
      const task = buildMarketingTask(data, projectId, req.body || {});
      data.marketingTasks.push(task);
      const emailJobId = registerMarketingAssignment(data, { project, task, assignedBy: req.user.name });
      appendTimeline(data, { type: 'marketing', title: 'Tarea del Plan de Marketing asignada', detail: `${task.title} · ${task.startDate} a ${task.dueDate}`, by: req.user.name, projectId });
      return { project: enrichProject(project, data), emailJobIds: [emailJobId] };
    });
    void dispatchEmailJobs(db, result.emailJobIds);
    res.json(result.project);
  });

  router.post('/projects/:id/marketing-tasks/bulk', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const projectId = Number(req.params.id);
      const project = data.projects.find((item) => item.id === projectId);
      if (!project) throw new Error('Proyecto no encontrado.');
      if (!canManageProject(req.user, project)) throw new Error('Solo el jefe del proyecto puede cargar el Plan de Marketing.');
      const requested = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
      if (!requested.length) throw new Error('No se recibieron tareas para cargar.');
      data.marketingTasks ||= [];
      const existingTemplateIds = new Set(data.marketingTasks.filter((item) => item.projectId === projectId && item.templateId).map((item) => Number(item.templateId)));
      const created = [];
      const skipped = [];
      const emailJobIds = [];
      requested.forEach((payload) => {
        const templateId = Number(payload.templateId);
        if (templateId && existingTemplateIds.has(templateId)) {
          skipped.push(templateId);
          return;
        }
        const task = buildMarketingTask(data, projectId, payload);
        data.marketingTasks.push(task);
        created.push(task);
        if (task.templateId) existingTemplateIds.add(Number(task.templateId));
        emailJobIds.push(registerMarketingAssignment(data, { project, task, assignedBy: req.user.name }));
      });
      appendTimeline(data, {
        type: 'marketing',
        title: 'Plan de Marketing cargado',
        detail: `${created.length} tareas creadas${skipped.length ? ` · ${skipped.length} ya existían` : ''}`,
        by: req.user.name,
        projectId
      });
      return { project: enrichProject(project, data), emailJobIds, created: created.length, skipped: skipped.length };
    });
    void dispatchEmailJobs(db, result.emailJobIds);
    res.json({ project: result.project, created: result.created, skipped: result.skipped });
  });

  router.put('/marketing-tasks/:id', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const task = (data.marketingTasks || []).find((item) => item.id === Number(req.params.id));
      if (!task) throw new Error('Tarea de Marketing no encontrada.');
      const project = data.projects.find((item) => item.id === task.projectId);
      const canEdit = canManageProject(req.user, project) || task.ownerUserId === req.user.id || req.user.role?.code === 'ADMIN';
      if (!canEdit) throw new Error('No tenés permiso para actualizar esta tarea.');
      const previousOwnerUserId = task.ownerUserId;
      const template = (data.marketingTaskTemplates || []).find((item) => item.id === Number(req.body.templateId ?? task.templateId));
      Object.assign(task, {
        templateId: req.body.templateId !== undefined ? Number(req.body.templateId) || null : task.templateId,
        title: req.body.title ?? template?.title ?? task.title,
        area: req.body.area ?? template?.area ?? task.area,
        channel: req.body.channel ?? template?.area ?? task.channel,
        durationDays: req.body.durationDays !== undefined ? Math.max(1, Number(req.body.durationDays)) : (template?.durationDays ?? task.durationDays),
        status: req.body.status ?? task.status,
        priority: req.body.priority ?? task.priority,
        startDate: req.body.startDate ?? task.startDate,
        dueDate: req.body.dueDate ?? task.dueDate,
        ownerUserId: req.body.ownerUserId !== undefined ? Number(req.body.ownerUserId) : task.ownerUserId,
        notes: req.body.notes ?? task.notes,
        templateData: { ...(task.templateData || {}), ...(req.body.templateData || {}) },
        progressPercent: req.body.progressPercent !== undefined ? Number(req.body.progressPercent) : task.progressPercent,
        updatedAt: now()
      });
      const emailJobIds = [];
      if (previousOwnerUserId !== task.ownerUserId) {
        const newOwner = data.users.find((user) => user.id === task.ownerUserId && user.active);
        if (!newOwner) throw new Error('El nuevo responsable no es un usuario activo.');
        emailJobIds.push(registerMarketingAssignment(data, { project, task, assignedBy: req.user.name }));
      }
      appendTimeline(data, { type: 'marketing', title: 'Tarea de Marketing actualizada', detail: `${task.title} · ${task.status}`, by: req.user.name, projectId: task.projectId });
      if (task.status === 'Completo') {
        notify(data, { title: 'Tarea de Marketing completada', message: task.title, userId: project?.responsibleUserId, roleId: null, projectId: task.projectId, marketingTaskId: task.id, type: 'marketing-complete' });
      }
      return { project: enrichProject(project, data), emailJobIds };
    });
    void dispatchEmailJobs(db, result.emailJobIds);
    res.json(result.project);
  });

  router.delete('/marketing-tasks/:id', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const task = (data.marketingTasks || []).find((item) => item.id === Number(req.params.id));
      if (!task) throw new Error('Tarea de Marketing no encontrada.');
      const project = data.projects.find((item) => item.id === task.projectId);
      if (!canManageProject(req.user, project)) throw new Error('Solo el jefe del proyecto puede eliminar esta tarea.');
      data.marketingTasks = data.marketingTasks.filter((item) => item.id !== task.id);
      appendTimeline(data, { type: 'marketing', title: 'Tarea de Marketing eliminada', detail: task.title, by: req.user.name, projectId: task.projectId });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  return router;
}
