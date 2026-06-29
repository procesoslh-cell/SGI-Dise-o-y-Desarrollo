export function enrichProject(project, data) {
  const businessUnit = data.businessUnits.find((x) => x.id === project.businessUnitId);
  const category = data.categories.find((x) => x.id === project.categoryId);
  const subcategory = data.subcategories.find((x) => x.id === project.subcategoryId);
  const responsible = data.users.find((x) => x.id === project.responsibleUserId);
  const stages = data.projectStages
    .filter((x) => x.projectId === project.id)
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const baseStage = data.stages.find((s) => s.id === stage.stageId);
      const transition = data.transitions.find((t) => t.fromStageId === stage.stageId && t.workflowId === stage.workflowId);
      const checklist = data.checklistItems.filter((item) => item.projectStageId === stage.id);
      const approvals = data.approvalRequests.filter((approval) => approval.projectStageId === stage.id);
      return {
        ...stage,
        responsibleRole: data.roles.find((r) => r.id === stage.responsibleRoleId),
        assignedUser: data.users.find((u) => u.id === stage.assignedUserId),
        form: data.forms.find((f) => f.id === baseStage?.formId),
        transition,
        checklist,
        checklistProgress: checklist.length ? Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100) : 100,
        approvals,
        pendingApproval: approvals.find((approval) => approval.status === 'Pendiente'),
        decisions: data.decisions.filter((decision) => decision.projectStageId === stage.id),
        documentTemplate: data.documentTemplates.find((tpl) => tpl.stageId === stage.stageId),
        documents: data.documents.filter((d) => d.projectStageId === stage.id).map((doc) => enrichDocument(doc, data)),
        documentRequirements: buildDocumentRequirements(stage, data)
      };
    });
  const completed = stages.filter((x) => x.status === 'Completa').length;
  const checklistItems = data.checklistItems.filter((item) => item.projectId === project.id);
  const checklistDone = checklistItems.filter((item) => item.done).length;
  return {
    ...project,
    businessUnit,
    category,
    subcategory,
    responsible,
    brief: data.projectBriefs.find((brief) => brief.projectId === project.id) || null,
    productAnalysis: data.productAnalyses.find((analysis) => analysis.projectId === project.id) || null,
    launchPlan: data.launchPlans.find((plan) => plan.projectId === project.id) || null,
    launchMilestones: (data.launchMilestones || []).filter((item) => item.projectId === project.id).sort((a, b) => new Date(a.date) - new Date(b.date)),
    marketingTasks: (data.marketingTasks || []).filter((item) => item.projectId === project.id).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    stages,
    approvals: data.approvalRequests.filter((approval) => approval.projectId === project.id),
    decisions: data.decisions.filter((decision) => decision.projectId === project.id),
    checklistItems,
    checklistProgress: checklistItems.length ? Math.round((checklistDone / checklistItems.length) * 100) : 100,
    documents: data.documents.filter((d) => d.projectId === project.id && !d.projectStageId).map((doc) => enrichDocument(doc, data)),
    allDocuments: data.documents.filter((d) => d.projectId === project.id).map((doc) => enrichDocument(doc, data)),
    documentSummary: summarizeProjectDocuments(project.id, data),
    timeline: data.timeline.filter((t) => t.projectId === project.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    progress: stages.length ? Math.round((completed / stages.length) * 100) : 0
  };
}

export function bootstrapFor(data, user) {
  const admin = user.role.code === 'ADMIN';
  const allowedProjects = data.projects.filter((project) => {
    if (admin) return true;
    if (project.responsibleUserId === user.id) return true;
    return data.projectStages.some((stage) => stage.projectId === project.id && (stage.assignedUserId === user.id || stage.responsibleRoleId === user.roleId));
  });
  const allowedProjectIds = new Set(allowedProjects.map((project) => project.id));
  return {
    meta: data.meta,
    user,
    permissionCatalog: data.permissionCatalog,
    roles: data.roles,
    users: data.users.map(({ passwordHash, ...u }) => u),
    businessUnits: data.businessUnits,
    categories: data.categories,
    subcategories: data.subcategories,
    workflows: data.workflows,
    stages: data.stages,
    transitions: data.transitions,
    slas: data.slas,
    forms: data.forms,
    checklistTemplates: data.checklistTemplates,
    documentTemplates: data.documentTemplates,
    flowchartDecisions: data.flowchartDecisions,
    launchMilestones: (data.launchMilestones || []).filter((item) => admin || allowedProjectIds.has(item.projectId)).sort((a, b) => new Date(a.date) - new Date(b.date)),
    marketingTasks: (data.marketingTasks || []).filter((item) => admin || allowedProjectIds.has(item.projectId)).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    approvalRequests: data.approvalRequests.filter((approval) => admin || allowedProjectIds.has(approval.projectId)),
    decisions: data.decisions.filter((decision) => admin || allowedProjectIds.has(decision.projectId)),
    projects: allowedProjects.map((p) => enrichProject(p, data)),
    notifications: data.notifications.filter((n) => !n.read && (admin || !n.userId || n.userId === user.id || n.roleId === user.roleId)),
    notificationCenter: data.notifications.filter((n) => admin || !n.userId || n.userId === user.id || n.roleId === user.roleId).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    documents: data.documents.filter((d) => admin || allowedProjectIds.has(d.projectId)).map((doc) => enrichDocument(doc, data)),
    documentComments: data.documentComments || [],
    executive: buildExecutiveDashboard(allowedProjects, data),
    timeline: data.timeline.slice(-100).reverse()
  };
}


function enrichDocument(doc, data) {
  const uploader = data.users.find((user) => user.id === doc.uploadedBy);
  const reviewer = data.users.find((user) => user.id === doc.reviewedBy);
  const template = data.documentTemplates.find((tpl) => tpl.id === doc.templateId);
  const stage = data.projectStages.find((item) => item.id === doc.projectStageId);
  const versions = data.documents
    .filter((item) => item.versionGroupId && item.versionGroupId === doc.versionGroupId)
    .sort((a, b) => (b.versionNumber || 1) - (a.versionNumber || 1));
  return {
    ...doc,
    uploader: uploader ? { id: uploader.id, name: uploader.name } : null,
    reviewer: reviewer ? { id: reviewer.id, name: reviewer.name } : null,
    template,
    stageName: stage?.name || null,
    comments: (data.documentComments || []).filter((comment) => comment.documentId === doc.id).map((comment) => ({
      ...comment,
      user: data.users.find((user) => user.id === comment.byUserId)?.name || 'Sistema'
    })),
    versions: versions.map((item) => ({ id: item.id, name: item.name, versionNumber: item.versionNumber, status: item.status, createdAt: item.createdAt, uploadedBy: item.uploadedBy }))
  };
}

function buildDocumentRequirements(projectStage, data) {
  const templates = data.documentTemplates.filter((tpl) => tpl.stageId === projectStage.stageId);
  return templates.map((template) => {
    const docs = data.documents
      .filter((doc) => doc.projectStageId === projectStage.id && doc.templateId === template.id)
      .sort((a, b) => (b.versionNumber || 1) - (a.versionNumber || 1));
    const latest = docs[0];
    return {
      template,
      status: latest?.status || 'Pendiente',
      latest: latest ? enrichDocument(latest, data) : null,
      versions: docs.map((doc) => enrichDocument(doc, data)),
      required: template.required !== false
    };
  });
}

function summarizeProjectDocuments(projectId, data) {
  const projectStages = data.projectStages.filter((stage) => stage.projectId === projectId);
  const requirements = projectStages.flatMap((stage) => buildDocumentRequirements(stage, data));
  return {
    required: requirements.filter((req) => req.required).length,
    pending: requirements.filter((req) => req.status === 'Pendiente').length,
    uploaded: requirements.filter((req) => ['Cargado', 'Observado', 'Aprobado'].includes(req.status)).length,
    observed: requirements.filter((req) => req.status === 'Observado').length,
    approved: requirements.filter((req) => req.status === 'Aprobado').length,
    general: data.documents.filter((doc) => doc.projectId === projectId && !doc.projectStageId).length
  };
}

function buildExecutiveDashboard(projects, data) {
  const projectIds = new Set(projects.map((project) => project.id));
  const projectStages = data.projectStages.filter((stage) => projectIds.has(stage.projectId));
  const activeProjects = projects.filter((project) => !['Cerrado', 'Rechazado'].includes(project.status)).length;
  const overdueProjects = projects.filter((project) => project.targetDate && new Date(`${project.targetDate}T23:59:59`) < new Date() && project.status !== 'Cerrado').length;
  const delayedStages = projectStages.filter((stage) => !['Completa', 'Bloqueada'].includes(stage.status) && stage.dueDate && new Date(`${stage.dueDate}T23:59:59`) < new Date()).length;
  const upcomingLaunches = (data.launchMilestones || []).filter((item) => projectIds.has(item.projectId) && item.status !== 'Completo' && daysUntil(item.date) <= 30 && daysUntil(item.date) >= -999).length;
  const blockedTasks = (data.marketingTasks || []).filter((task) => projectIds.has(task.projectId) && task.status === 'Bloqueado').length;
  const pendingMarketing = (data.marketingTasks || []).filter((task) => projectIds.has(task.projectId) && task.status !== 'Completo').length;
  const byStatus = groupCount(projects, 'status');
  const byBusinessUnit = projects.reduce((acc, project) => {
    const unit = data.businessUnits.find((item) => item.id === project.businessUnitId)?.name || 'Sin unidad';
    acc[unit] = (acc[unit] || 0) + 1;
    return acc;
  }, {});
  const workload = data.users.map((user) => ({
    userId: user.id,
    name: user.name,
    roleId: user.roleId,
    stages: projectStages.filter((stage) => stage.assignedUserId === user.id || (!stage.assignedUserId && data.roles.find((role) => role.id === user.roleId)?.id === stage.responsibleRoleId)).length,
    marketingTasks: (data.marketingTasks || []).filter((task) => projectIds.has(task.projectId) && task.ownerUserId === user.id && task.status !== 'Completo').length
  })).map((item) => ({ ...item, total: item.stages + item.marketingTasks })).sort((a, b) => b.total - a.total);
  const sla = {
    completed: projectStages.filter((stage) => stage.status === 'Completa').length,
    delayed: delayedStages,
    compliance: projectStages.length ? Math.max(0, Math.round(((projectStages.length - delayedStages) / projectStages.length) * 100)) : 100
  };
  return { activeProjects, overdueProjects, delayedStages, upcomingLaunches, blockedTasks, pendingMarketing, byStatus, byBusinessUnit, workload, sla };
}

function groupCount(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'Sin dato';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function daysUntil(date) {
  if (!date) return 9999;
  return Math.ceil((new Date(`${date}T23:59:59`) - new Date()) / 86400000);
}
