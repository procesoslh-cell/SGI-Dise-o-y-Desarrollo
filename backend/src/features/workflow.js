import { datePlus, now, uid } from '../db/initialData.js';

export function generateProjectCode(data) {
  const year = new Date().getFullYear();
  const count = data.projects.filter((p) => p.code?.startsWith(`SGI-${year}`)).length + 1;
  return `SGI-${year}-${String(count).padStart(4, '0')}`;
}

export function nextNumericId(data, collection) {
  const items = data[collection] || [];
  return items.length ? Math.max(...items.map((x) => Number(x.id) || 0)) + 1 : 1;
}

export function defaultUserForRole(data, roleId, fallbackUserId = null) {
  if (fallbackUserId && data.users.some((user) => user.id === Number(fallbackUserId) && user.active)) return Number(fallbackUserId);
  return data.users.find((user) => user.roleId === roleId && user.active)?.id || null;
}

export function createProjectStages(projectId, workflowId, data, stageAssignments = {}, options = {}) {
  const workflow = data.workflows.find((w) => w.id === workflowId);
  const allowedIds = new Set((options.stageIds || workflow?.stageIds || []).map(Number));
  const stages = data.stages
    .filter((stage) => workflow?.stageIds?.includes(stage.id) && allowedIds.has(stage.id))
    .sort((a, b) => a.order - b.order);
  if (!stages.length) throw new Error('El proyecto debe incluir al menos una etapa.');

  const currentMax = nextNumericId(data, 'projectStages');
  const baseDate = options.startDate || new Date().toISOString().slice(0, 10);
  const selectedCurrentStageId = Number(options.currentStageId || stages[0]?.id);
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.id === selectedCurrentStageId));
  let offset = 0;
  const stageSchedules = options.stageSchedules || {};

  return stages.map((stage, index) => {
    const override = stageAssignments[String(stage.id)] || stageAssignments[stage.id];
    const schedule = stageSchedules[String(stage.id)] || stageSchedules[stage.id] || {};
    const durationDays = Math.max(1, Number(schedule.slaDays || stage.slaDays || 1));
    const stageStartDate = schedule.startDate || datePlus(offset, baseDate);
    const stageDueDate = schedule.dueDate || datePlus(offset + durationDays - 1, baseDate);
    const isCompletedHistory = index < currentIndex;
    const item = {
      id: currentMax + index,
      projectId,
      workflowId,
      stageId: stage.id,
      order: index + 1,
      phase: stage.phase,
      name: stage.name,
      responsibleRoleId: stage.responsibleRoleId,
      assignedUserId: defaultUserForRole(data, stage.responsibleRoleId, override),
      slaDays: durationDays,
      startDate: stageStartDate,
      dueDate: stageDueDate,
      status: isCompletedHistory ? 'Completa' : index === currentIndex ? 'En curso' : 'Bloqueada',
      formData: isCompletedHistory ? {
        resultado: 'Completado',
        detalleTrabajo: 'Etapa marcada como completada durante la carga inicial del proyecto.',
        entregable: 'Registro histórico validado durante la migración.'
      } : {},
      historicalLoad: Boolean(options.importMode && isCompletedHistory),
      createdAt: now(),
      updatedAt: now()
    };
    if (isCompletedHistory) item.completedAt = `${stageDueDate}T18:00:00.000Z`;
    offset += durationDays;
    return item;
  });
}

export function createChecklistForStages(data, projectId, projectStages) {
  let id = nextNumericId(data, 'checklistItems');
  return projectStages.flatMap((projectStage) => {
    const template = data.checklistTemplates.find((tpl) => tpl.stageId === projectStage.stageId);
    return (template?.items || []).map((label, index) => {
      const completed = projectStage.status === 'Completa';
      return {
        id: id++,
        projectId,
        projectStageId: projectStage.id,
        stageId: projectStage.stageId,
        label,
        required: index < 3,
        done: completed,
        doneBy: completed ? projectStage.assignedUserId : null,
        doneAt: completed ? projectStage.completedAt || now() : null,
        createdAt: now()
      };
    });
  });
}

export function appendTimeline(data, payload) {
  data.timeline.push({ id: uid('tl'), createdAt: now(), ...payload });
}

export function notify(data, payload) {
  const id = nextNumericId(data, 'notifications');
  data.notifications.push({ id, read: false, createdAt: now(), ...payload });
}

export function notifyStageAssignment(data, projectStage, project, planned = false) {
  const userId = projectStage.assignedUserId || defaultUserForRole(data, projectStage.responsibleRoleId);
  const projectLabel = project ? `${project.code} · ${project.name}` : `Proyecto ${projectStage.projectId}`;
  notify(data, {
    title: planned ? 'Tarea programada' : 'Es tu turno de actuar',
    message: `${projectStage.name} · ${projectLabel}.`,
    userId,
    roleId: userId ? null : projectStage.responsibleRoleId,
    projectId: projectStage.projectId,
    projectStageId: projectStage.id,
    type: planned ? 'task-planned' : 'task'
  });
}

export function updateProjectStatus(data, projectId) {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return;
  const stages = data.projectStages.filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order);
  const open = stages.find((s) => !['Completa', 'Bloqueada'].includes(s.status));
  const allDone = stages.length > 0 && stages.every((s) => s.status === 'Completa');
  const launched = stages.find((s) => ['Lanzamiento', 'Lanzamiento de producto'].includes(s.name))?.status === 'Completa';
  const marketingStages = stages.filter((s) => s.phase === 'Marketing');
  const marketingDone = marketingStages.length === 0 || marketingStages.every((s) => s.status === 'Completa');
  if (allDone) project.status = 'Cerrado';
  else if (launched && !marketingDone) project.status = 'Marketing';
  else if (open?.status === 'Pendiente validación') project.status = 'Validación';
  else if (open?.phase) project.status = open.phase;
  project.updatedAt = now();
}

export function getTransitionForStage(data, projectStage) {
  return data.transitions.find((transition) => transition.workflowId === projectStage.workflowId && transition.fromStageId === projectStage.stageId);
}

export function hasOpenApproval(data, projectStage) {
  return data.approvalRequests.find((approval) => approval.projectStageId === projectStage.id && approval.status === 'Pendiente');
}

function validateStageForReview(data, projectStage) {
  if (projectStage.status === 'Bloqueada') throw new Error('La tarea todavía está bloqueada.');
  if (projectStage.status === 'Completa') throw new Error('La tarea ya está completa.');

  const stageDefinition = data.stages.find((stage) => stage.id === projectStage.stageId);
  const form = data.forms.find((item) => item.id === stageDefinition?.formId);
  const missingFields = (form?.fields || [])
    .filter((field) => field.required)
    .filter((field) => String(projectStage.formData?.[field.key] ?? '').trim() === '')
    .map((field) => field.label);
  if (missingFields.length) throw new Error(`Completá la plantilla antes de enviarla a validación: ${missingFields.join(', ')}.`);

  const pendingChecklist = data.checklistItems
    .filter((item) => item.projectStageId === projectStage.id && item.required && !item.done)
    .map((item) => item.label);
  if (pendingChecklist.length) throw new Error(`Completá el checklist obligatorio: ${pendingChecklist.join(', ')}.`);
}

export function createApprovalRequest(data, projectStage, byUser, comment = '') {
  validateStageForReview(data, projectStage);
  const transition = getTransitionForStage(data, projectStage);
  if (!transition) throw new Error('No hay validación configurada para esta etapa.');
  const existing = hasOpenApproval(data, projectStage);
  if (existing) return existing;

  const project = data.projects.find((item) => item.id === projectStage.projectId);
  const nextStage = data.projectStages
    .filter((item) => item.projectId === projectStage.projectId && item.order > projectStage.order)
    .sort((a, b) => a.order - b.order)[0];
  const title = nextStage
    ? `Validar ${projectStage.name} para habilitar ${nextStage.name}`
    : `Validar ${projectStage.name} y cerrar el proyecto`;
  const approverUserId = project?.responsibleUserId || null;

  const approval = {
    id: nextNumericId(data, 'approvalRequests'),
    projectId: projectStage.projectId,
    projectStageId: projectStage.id,
    transitionId: transition.id,
    title,
    status: 'Pendiente',
    requestedBy: byUser.id,
    approverUserId,
    approverRoleId: transition.approverRoleId || 'role_jefe',
    comment,
    createdAt: now(),
    resolvedAt: null,
    resolvedBy: null
  };
  data.approvalRequests.push(approval);
  projectStage.status = 'Pendiente validación';
  projectStage.updatedAt = now();

  appendTimeline(data, {
    type: 'approval',
    title: 'Tarea enviada a validación',
    detail: `${title}: ${comment || 'sin comentario adicional'}`,
    by: byUser.name,
    projectId: projectStage.projectId,
    projectStageId: projectStage.id
  });
  notify(data, {
    title: 'Tarea pendiente de validación',
    message: `${projectStage.name} requiere tu revisión.`,
    userId: approverUserId,
    roleId: approverUserId ? null : approval.approverRoleId,
    projectId: approval.projectId,
    projectStageId: approval.projectStageId,
    type: 'approval'
  });
  updateProjectStatus(data, projectStage.projectId);
  return approval;
}

export function completeStage(data, projectStage, byUser) {
  projectStage.status = 'Completa';
  projectStage.completedAt = now();
  projectStage.updatedAt = now();
  appendTimeline(data, {
    type: 'workflow',
    title: 'Tarea validada y completada',
    detail: `${projectStage.name} fue aprobada por el jefe del proyecto.`,
    by: byUser.name,
    projectId: projectStage.projectId,
    projectStageId: projectStage.id
  });

  const next = data.projectStages
    .filter((item) => item.projectId === projectStage.projectId && item.order > projectStage.order)
    .sort((a, b) => a.order - b.order)[0];
  if (next && next.status === 'Bloqueada') {
    next.status = 'En curso';
    next.assignedUserId = next.assignedUserId || defaultUserForRole(data, next.responsibleRoleId);
    next.updatedAt = now();
    appendTimeline(data, {
      type: 'workflow',
      title: 'Nueva tarea habilitada',
      detail: `${next.name} quedó asignada a ${data.users.find((user) => user.id === next.assignedUserId)?.name || 'responsable'}.`,
      by: 'Sistema',
      projectId: next.projectId,
      projectStageId: next.id
    });
    const project = data.projects.find((p) => p.id === next.projectId);
    notifyStageAssignment(data, next, project, false);
  }
  updateProjectStatus(data, projectStage.projectId);
}
