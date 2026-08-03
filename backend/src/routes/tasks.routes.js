import { Router } from 'express';
import { requireAuth, requirePermission } from '../features/auth.js';
import { enrichProject } from '../features/serializers.js';
import { now } from '../db/initialData.js';
import {
  appendTimeline,
  completeStage,
  createApprovalRequest,
  nextNumericId,
  notify,
  updateProjectStatus
} from '../features/workflow.js';
import { registerDecision } from '../services/common.js';

function canActOnStage(user, project, stage) {
  return user.role?.code === 'ADMIN' || project?.responsibleUserId === user.id || stage?.assignedUserId === user.id;
}

function canValidate(user, project, approval) {
  return user.role?.code === 'ADMIN' || project?.responsibleUserId === user.id || approval.approverUserId === user.id || user.permissions?.includes('approvals:manage');
}

export function createTasksRouter(db) {
  const router = Router();

  router.put('/project-stages/:id', requireAuth(db), requirePermission('workflow:execute'), (req, res) => {
    const result = db.transact((data) => {
      const stage = data.projectStages.find((item) => item.id === Number(req.params.id));
      if (!stage) throw new Error('Tarea no encontrada.');
      const project = data.projects.find((item) => item.id === stage.projectId);
      if (!canActOnStage(req.user, project, stage)) throw new Error('No tenés permiso para modificar esta tarea.');
      const isLead = req.user.role?.code === 'ADMIN' || project.responsibleUserId === req.user.id;
      if ((req.body.assignedUserId !== undefined || req.body.startDate || req.body.dueDate || req.body.slaDays !== undefined) && !isLead) {
        throw new Error('Solo el jefe del proyecto puede modificar responsable y fechas.');
      }
      const previousAssignee = stage.assignedUserId;
      stage.formData = { ...(stage.formData || {}), ...(req.body.formData || {}) };
      if (req.body.assignedUserId !== undefined) stage.assignedUserId = Number(req.body.assignedUserId);
      if (req.body.startDate !== undefined) stage.startDate = req.body.startDate;
      if (req.body.dueDate !== undefined) stage.dueDate = req.body.dueDate;
      if (req.body.slaDays !== undefined) stage.slaDays = Number(req.body.slaDays);
      if (req.body.progressPercent !== undefined) stage.progressPercent = Math.min(100, Math.max(0, Number(req.body.progressPercent)));
      if (req.body.status) stage.status = req.body.status;
      stage.updatedAt = now();
      appendTimeline(data, { type: 'workflow', title: 'Tarea actualizada', detail: `${stage.name} · ${stage.status}`, by: req.user.name, projectId: stage.projectId, projectStageId: stage.id });
      if (previousAssignee !== stage.assignedUserId) {
        notify(data, { title: 'Nueva tarea asignada', message: `${stage.name} · ${project.name}`, userId: stage.assignedUserId, roleId: null, projectId: project.id, projectStageId: stage.id, type: 'task' });
      }
      updateProjectStatus(data, stage.projectId);
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.post('/project-stages/:id/progress', requireAuth(db), requirePermission('workflow:execute'), (req, res) => {
    const result = db.transact((data) => {
      const stage = data.projectStages.find((item) => item.id === Number(req.params.id));
      if (!stage) throw new Error('Tarea no encontrada.');
      const project = data.projects.find((item) => item.id === stage.projectId);
      if (!canActOnStage(req.user, project, stage)) throw new Error('No tenés permiso para registrar avances.');
      data.taskProgress ||= [];
      stage.formData = { ...(stage.formData || {}), ...(req.body.formData || {}) };
      stage.progressPercent = Math.min(99, Math.max(0, Number(req.body.progressPercent ?? stage.progressPercent ?? 0)));
      if (!['Pendiente validación', 'Completa'].includes(stage.status)) stage.status = 'En curso';
      stage.updatedAt = now();
      const progress = {
        id: nextNumericId(data, 'taskProgress'),
        projectId: stage.projectId,
        projectStageId: stage.id,
        marketingTaskId: null,
        progressPercent: stage.progressPercent,
        note: req.body.note || 'Avance guardado.',
        formData: req.body.formData || {},
        byUserId: req.user.id,
        createdAt: now()
      };
      data.taskProgress.push(progress);
      appendTimeline(data, { type: 'progress', title: 'Avance de tarea guardado', detail: `${stage.name} · ${stage.progressPercent}% · ${progress.note}`, by: req.user.name, projectId: stage.projectId, projectStageId: stage.id });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.post('/project-stages/:id/approval/request', requireAuth(db), requirePermission('workflow:execute'), (req, res) => {
    const result = db.transact((data) => {
      const stage = data.projectStages.find((item) => item.id === Number(req.params.id));
      if (!stage) throw new Error('Tarea no encontrada.');
      const project = data.projects.find((item) => item.id === stage.projectId);
      if (!canActOnStage(req.user, project, stage)) throw new Error('Solo el responsable puede enviar la tarea a validar.');
      const approval = createApprovalRequest(data, stage, req.user, req.body.comment || '');
      return { approval, project: enrichProject(project, data) };
    });
    res.json(result);
  });

  router.put('/checklist-items/:id/toggle', requireAuth(db), requirePermission('checklist:update'), (req, res) => {
    const result = db.transact((data) => {
      const item = data.checklistItems.find((row) => row.id === Number(req.params.id));
      if (!item) throw new Error('Ítem no encontrado.');
      const stage = data.projectStages.find((row) => row.id === item.projectStageId);
      const project = data.projects.find((row) => row.id === item.projectId);
      if (!canActOnStage(req.user, project, stage)) throw new Error('No tenés permiso para modificar este checklist.');
      item.done = req.body.done !== undefined ? Boolean(req.body.done) : !item.done;
      item.doneBy = item.done ? req.user.id : null;
      item.doneAt = item.done ? now() : null;
      appendTimeline(data, { type: 'checklist', title: item.done ? 'Checklist completado' : 'Checklist reabierto', detail: item.label, by: req.user.name, projectId: item.projectId, projectStageId: item.projectStageId });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.post('/marketing-tasks/:id/progress', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const task = (data.marketingTasks || []).find((item) => item.id === Number(req.params.id));
      if (!task) throw new Error('Tarea de Marketing no encontrada.');
      const project = data.projects.find((item) => item.id === task.projectId);
      const canAct = req.user.role?.code === 'ADMIN' || task.ownerUserId === req.user.id || project?.responsibleUserId === req.user.id;
      if (!canAct) throw new Error('No tenés permiso para registrar avances.');
      data.taskProgress ||= [];
      task.templateData = { ...(task.templateData || {}), ...(req.body.templateData || {}) };
      task.progressPercent = Math.min(99, Math.max(0, Number(req.body.progressPercent ?? task.progressPercent ?? 0)));
      if (!['Pendiente validación', 'Completo'].includes(task.status)) task.status = 'En curso';
      task.updatedAt = now();
      data.taskProgress.push({
        id: nextNumericId(data, 'taskProgress'),
        projectId: task.projectId,
        projectStageId: null,
        marketingTaskId: task.id,
        progressPercent: task.progressPercent,
        note: req.body.note || 'Avance guardado.',
        formData: req.body.templateData || {},
        byUserId: req.user.id,
        createdAt: now()
      });
      appendTimeline(data, { type: 'progress', title: 'Avance de Marketing guardado', detail: `${task.title} · ${task.progressPercent}%`, by: req.user.name, projectId: task.projectId });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.post('/marketing-tasks/:id/approval/request', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const task = (data.marketingTasks || []).find((item) => item.id === Number(req.params.id));
      if (!task) throw new Error('Tarea de Marketing no encontrada.');
      const project = data.projects.find((item) => item.id === task.projectId);
      if (req.user.role?.code !== 'ADMIN' && task.ownerUserId !== req.user.id && project?.responsibleUserId !== req.user.id) throw new Error('Solo el responsable puede enviar la tarea a validar.');
      const required = ['resultado', 'detalleTrabajo', 'entregable'];
      const missing = required.filter((key) => !String(task.templateData?.[key] || '').trim());
      if (missing.length) throw new Error('Completá resultado, detalle del trabajo y entregable antes de enviar.');
      const existing = (data.approvalRequests || []).find((item) => item.marketingTaskId === task.id && item.status === 'Pendiente');
      if (existing) return { approval: existing, project: enrichProject(project, data) };
      const approval = {
        id: nextNumericId(data, 'approvalRequests'),
        projectId: task.projectId,
        projectStageId: null,
        marketingTaskId: task.id,
        transitionId: null,
        title: `Validar tarea de Marketing: ${task.title}`,
        status: 'Pendiente',
        requestedBy: req.user.id,
        approverUserId: project.responsibleUserId,
        approverRoleId: 'role_jefe',
        comment: req.body.comment || '',
        createdAt: now(),
        resolvedAt: null,
        resolvedBy: null
      };
      data.approvalRequests.push(approval);
      task.status = 'Pendiente validación';
      task.updatedAt = now();
      notify(data, { title: 'Tarea de Marketing para validar', message: `${task.title} · ${project.name}`, userId: project.responsibleUserId, roleId: null, projectId: project.id, marketingTaskId: task.id, type: 'approval' });
      appendTimeline(data, { type: 'approval', title: 'Tarea de Marketing enviada a validación', detail: task.title, by: req.user.name, projectId: project.id });
      return { approval, project: enrichProject(project, data) };
    });
    res.json(result);
  });

  router.post('/approvals/:id/approve', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const approval = data.approvalRequests.find((item) => item.id === Number(req.params.id));
      if (!approval || approval.status !== 'Pendiente') throw new Error('Validación no encontrada o ya resuelta.');
      const project = data.projects.find((item) => item.id === approval.projectId);
      if (!canValidate(req.user, project, approval)) throw new Error('Solo el jefe del proyecto puede validar.');
      approval.status = 'Aprobado';
      approval.resolvedAt = now();
      approval.resolvedBy = req.user.id;
      approval.resolutionComment = req.body.comment || '';
      if (approval.projectStageId) {
        const stage = data.projectStages.find((item) => item.id === approval.projectStageId);
        registerDecision(data, { projectId: approval.projectId, projectStageId: stage.id, title: approval.title, decision: 'Aprobado', rationale: approval.resolutionComment }, req.user);
        completeStage(data, stage, req.user);
      } else if (approval.marketingTaskId) {
        const task = data.marketingTasks.find((item) => item.id === approval.marketingTaskId);
        task.status = 'Completo';
        task.progressPercent = 100;
        task.completedAt = now();
        task.updatedAt = now();
        appendTimeline(data, { type: 'marketing', title: 'Tarea de Marketing validada', detail: task.title, by: req.user.name, projectId: project.id });
      }
      notify(data, { title: 'Tarea validada', message: approval.title, userId: approval.requestedBy, roleId: null, projectId: approval.projectId, projectStageId: approval.projectStageId, marketingTaskId: approval.marketingTaskId, type: 'approval-result' });
      return enrichProject(project, data);
    });
    res.json(result);
  });

  router.post('/approvals/:id/reject', requireAuth(db), (req, res) => {
    const result = db.transact((data) => {
      const approval = data.approvalRequests.find((item) => item.id === Number(req.params.id));
      if (!approval || approval.status !== 'Pendiente') throw new Error('Validación no encontrada o ya resuelta.');
      const project = data.projects.find((item) => item.id === approval.projectId);
      if (!canValidate(req.user, project, approval)) throw new Error('Solo el jefe del proyecto puede rechazar.');
      approval.status = 'Rechazado';
      approval.resolvedAt = now();
      approval.resolvedBy = req.user.id;
      approval.resolutionComment = req.body.comment || '';
      if (approval.projectStageId) {
        const stage = data.projectStages.find((item) => item.id === approval.projectStageId);
        stage.status = 'Requiere ajustes';
        stage.updatedAt = now();
      } else if (approval.marketingTaskId) {
        const task = data.marketingTasks.find((item) => item.id === approval.marketingTaskId);
        task.status = 'Requiere ajustes';
        task.updatedAt = now();
      }
      notify(data, { title: 'Tarea observada', message: `${approval.title}${approval.resolutionComment ? ` · ${approval.resolutionComment}` : ''}`, userId: approval.requestedBy, roleId: null, projectId: approval.projectId, projectStageId: approval.projectStageId, marketingTaskId: approval.marketingTaskId, type: 'rejection' });
      appendTimeline(data, { type: 'approval', title: 'Tarea observada', detail: approval.resolutionComment || approval.title, by: req.user.name, projectId: approval.projectId, projectStageId: approval.projectStageId });
      updateProjectStatus(data, project.id);
      return enrichProject(project, data);
    });
    res.json(result);
  });

  return router;
}
