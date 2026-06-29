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

export function createProjectStages(projectId, workflowId, data, stageAssignments = {}) {
  const workflow = data.workflows.find((w) => w.id === workflowId);
  const stages = data.stages.filter((s) => workflow.stageIds.includes(s.id)).sort((a, b) => a.order - b.order);
  const currentMax = nextNumericId(data, 'projectStages');
  let offset = 0;
  return stages.map((stage, index) => {
    const override = stageAssignments[String(stage.id)] || stageAssignments[stage.id];
    const item = {
      id: currentMax + index,
      projectId,
      workflowId,
      stageId: stage.id,
      order: stage.order,
      phase: stage.phase,
      name: stage.name,
      responsibleRoleId: stage.responsibleRoleId,
      assignedUserId: defaultUserForRole(data, stage.responsibleRoleId, override),
      slaDays: stage.slaDays,
      startDate: datePlus(offset),
      dueDate: datePlus(offset + stage.slaDays),
      status: stage.order === 1 ? 'En curso' : 'Bloqueada',
      formData: {},
      createdAt: now(),
      updatedAt: now()
    };
    offset += stage.slaDays;
    return item;
  });
}

export function createChecklistForStages(data, projectId, projectStages) {
  const startId = nextNumericId(data, 'checklistItems');
  let id = startId;
  return projectStages.flatMap((projectStage) => {
    const template = data.checklistTemplates.find((tpl) => tpl.stageId === projectStage.stageId);
    return (template?.items || []).map((label, index) => ({
      id: id++,
      projectId,
      projectStageId: projectStage.id,
      stageId: projectStage.stageId,
      label,
      required: index < 3,
      done: false,
      doneBy: null,
      doneAt: null,
      createdAt: now()
    }));
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
    title: planned ? 'Tarea programada' : 'Nueva tarea asignada',
    message: `${projectStage.name} · ${projectLabel}.`,
    userId,
    roleId: projectStage.responsibleRoleId,
    projectId: projectStage.projectId,
    projectStageId: projectStage.id,
    type: planned ? 'task-planned' : 'task'
  });
}

export function updateProjectStatus(data, projectId) {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return;
  const stages = data.projectStages.filter((s) => s.projectId === projectId);
  const open = stages.find((s) => !['Completa', 'Bloqueada'].includes(s.status));
  const allDone = stages.length > 0 && stages.every((s) => s.status === 'Completa');
  const launched = stages.find((s) => ['Lanzamiento', 'Lanzamiento de producto'].includes(s.name))?.status === 'Completa';
  const marketingDone = stages.filter((s) => s.phase === 'Marketing').every((s) => s.status === 'Completa');
  if (allDone) project.status = 'Cerrado';
  else if (launched && !marketingDone) project.status = 'Marketing';
  else if (open?.phase) project.status = open.phase;
  project.updatedAt = now();
}

export function getTransitionForStage(data, projectStage) {
  return data.transitions.find((transition) => transition.workflowId === projectStage.workflowId && transition.fromStageId === projectStage.stageId);
}

export function hasOpenApproval(data, projectStage) {
  return data.approvalRequests.find((approval) => approval.projectStageId === projectStage.id && approval.status === 'Pendiente');
}

export function createApprovalRequest(data, projectStage, byUser, comment = '') {
  const transition = getTransitionForStage(data, projectStage);
  if (!transition) throw new Error('No hay transición configurada para esta etapa.');
  const existing = hasOpenApproval(data, projectStage);
  if (existing) return existing;
  const approval = {
    id: nextNumericId(data, 'approvalRequests'),
    projectId: projectStage.projectId,
    projectStageId: projectStage.id,
    transitionId: transition.id,
    title: transition.action,
    status: 'Pendiente',
    requestedBy: byUser.id,
    approverRoleId: transition.approverRoleId || 'role_jefe',
    comment,
    createdAt: now(),
    resolvedAt: null,
    resolvedBy: null
  };
  data.approvalRequests.push(approval);
  projectStage.status = 'Pendiente aprobación';
  projectStage.updatedAt = now();
  appendTimeline(data, {
    type: 'approval',
    title: 'Aprobación solicitada',
    detail: `${transition.action}: ${comment || 'sin comentario'}`,
    by: byUser.name,
    projectId: projectStage.projectId,
    projectStageId: projectStage.id
  });
  notify(data, {
    title: 'Aprobación pendiente',
    message: `${transition.action} requiere revisión.`,
    roleId: approval.approverRoleId,
    userId: null,
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
    title: 'Etapa completada',
    detail: `${projectStage.name} marcada como completa.`,
    by: byUser.name,
    projectId: projectStage.projectId,
    projectStageId: projectStage.id
  });
  const next = data.projectStages.find((x) => x.projectId === projectStage.projectId && x.order === projectStage.order + 1);
  if (next && next.status === 'Bloqueada') {
    next.status = 'En curso';
    next.assignedUserId = next.assignedUserId || defaultUserForRole(data, next.responsibleRoleId);
    next.updatedAt = now();
    appendTimeline(data, {
      type: 'workflow',
      title: 'Nueva etapa habilitada',
      detail: `${next.name} quedó asignada a ${data.users.find((user) => user.id === next.assignedUserId)?.name || data.roles.find((role) => role.id === next.responsibleRoleId)?.name || 'responsable'}.`,
      by: 'Sistema',
      projectId: next.projectId,
      projectStageId: next.id
    });
    const project = data.projects.find((p) => p.id === next.projectId);
    notifyStageAssignment(data, next, project, false);
  }
  updateProjectStatus(data, projectStage.projectId);
}
