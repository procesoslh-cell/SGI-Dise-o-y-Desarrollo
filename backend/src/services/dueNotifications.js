import { notify } from '../features/workflow.js';

const dayDiff = (date) => Math.ceil((new Date(`${date}T23:59:59`) - new Date()) / 86400000);

export function checkDueNotifications(data) {
  const today = new Date().toISOString().slice(0, 10);
  const exists = (type, refId) => (data.notifications || []).some((item) => item.type === type && item.refId === refId && String(item.createdAt || '').slice(0, 10) === today && !item.read);

  for (const stage of data.projectStages || []) {
    if (['Completa', 'Bloqueada'].includes(stage.status) || !stage.dueDate) continue;
    const diff = dayDiff(stage.dueDate);
    if (diff <= 1 && !exists('sla', `stage-${stage.id}`)) {
      notify(data, {
        title: diff < 0 ? 'Tarea vencida' : diff === 0 ? 'La tarea vence hoy' : 'Quedan 24 horas',
        message: `${stage.name} · vence ${stage.dueDate}.`,
        userId: stage.assignedUserId,
        roleId: stage.assignedUserId ? null : stage.responsibleRoleId,
        projectId: stage.projectId,
        projectStageId: stage.id,
        type: 'sla',
        refId: `stage-${stage.id}`
      });
    }
  }

  for (const task of data.marketingTasks || []) {
    if (task.status === 'Completo' || !task.dueDate) continue;
    const diff = dayDiff(task.dueDate);
    if (diff <= 1 && !exists('marketing-sla', `marketing-${task.id}`)) {
      notify(data, {
        title: diff < 0 ? 'Tarea de marketing vencida' : diff === 0 ? 'Tarea de marketing vence hoy' : 'Quedan 24 horas',
        message: `${task.title} · vence ${task.dueDate}.`,
        userId: task.ownerUserId,
        roleId: null,
        projectId: task.projectId,
        projectStageId: null,
        marketingTaskId: task.id,
        type: 'marketing-sla',
        refId: `marketing-${task.id}`
      });
    }
  }
}
