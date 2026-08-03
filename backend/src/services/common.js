import { now, uid } from '../db/initialData.js';
import { appendTimeline, nextNumericId } from '../features/workflow.js';

export function upsertByProject(data, collection, projectId, payload, extra = {}) {
  data[collection] ||= [];
  let row = data[collection].find((item) => item.projectId === projectId);
  if (!row) {
    row = { id: nextNumericId(data, collection), projectId, createdAt: now(), ...extra };
    data[collection].push(row);
  }
  Object.assign(row, payload, { updatedAt: now() });
  return row;
}

export function latestDocumentVersion(data, payload) {
  const related = (data.documents || []).filter((doc) => {
    if (payload.templateId) {
      return doc.projectId === payload.projectId && doc.projectStageId === payload.projectStageId && doc.templateId === payload.templateId;
    }
    if (payload.marketingTaskId) {
      return doc.projectId === payload.projectId && doc.marketingTaskId === payload.marketingTaskId && doc.name === payload.name;
    }
    return doc.projectId === payload.projectId && doc.projectStageId === payload.projectStageId && doc.name === payload.name;
  }).sort((a, b) => (b.versionNumber || 1) - (a.versionNumber || 1));
  return related[0] || null;
}

export function documentStatus(status) {
  return ['Pendiente', 'Cargado', 'Observado', 'Aprobado'].includes(status) ? status : 'Cargado';
}

export function registerDecision(data, payload, user) {
  data.decisions ||= [];
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
    id: uid('tl'),
    type: 'decision',
    title: `Decisión registrada: ${decision.title}`,
    detail: `${decision.decision}. ${decision.rationale}`,
    by: user.name,
    projectId: decision.projectId,
    projectStageId: decision.projectStageId
  });
  return decision;
}
