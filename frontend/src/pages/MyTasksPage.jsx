import { AlertTriangle, CheckSquare, Clock3, FileCheck2, Megaphone } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { formatDate, slaInfo } from '../utils/dates.js';

export function buildTaskInbox(data) {
  const user = data.user;
  const assigned = [];
  const validations = [];
  const briefReviews = [];

  for (const project of data.projects || []) {
    for (const stage of project.stages || []) {
      if (stage.assignedUserId === user.id && stage.status !== 'Completa') assigned.push({ kind: 'stage', task: stage, project });
    }
    for (const task of project.marketingTasks || []) {
      if (task.ownerUserId === user.id && task.status !== 'Completo') assigned.push({ kind: 'marketing', task, project });
    }
    if (project.brief?.status === 'Pendiente validación' && (project.brief.marketingReviewerUserId === user.id || user.roleId === 'role_marketing' || user.role?.code === 'ADMIN')) {
      briefReviews.push(project);
    }
  }

  for (const approval of data.approvalRequests || []) {
    if (approval.status !== 'Pendiente') continue;
    if (approval.approverUserId !== user.id && user.role?.code !== 'ADMIN') continue;
    const project = data.projects.find((item) => item.id === approval.projectId);
    if (!project) continue;
    const task = approval.projectStageId
      ? project.stages.find((stage) => stage.id === approval.projectStageId)
      : project.marketingTasks.find((entry) => entry.id === approval.marketingTaskId);
    if (task) validations.push({ kind: approval.projectStageId ? 'stage' : 'marketing', task, project, approval });
  }

  assigned.sort((a, b) => new Date(a.task.dueDate || '2999-01-01') - new Date(b.task.dueDate || '2999-01-01'));
  return { assigned, validations, briefReviews, total: assigned.length + validations.length + briefReviews.length };
}

export default function MyTasksPage({ data, openTask, openBriefReview }) {
  const inbox = buildTaskInbox(data);
  const dueToday = inbox.assigned.filter((item) => item.task.dueDate === new Date().toISOString().slice(0, 10));
  const overdue = inbox.assigned.filter((item) => slaInfo(item.task.dueDate).hours < 0);

  return <div className="page-stack">
    <section className="metrics-grid compact">
      <TaskMetric icon={<CheckSquare />} label="Asignadas" value={inbox.assigned.length} />
      <TaskMetric icon={<Clock3 />} label="Vencen hoy" value={dueToday.length} />
      <TaskMetric icon={<AlertTriangle />} label="Vencidas" value={overdue.length} tone="bad" />
      <TaskMetric icon={<FileCheck2 />} label="Para validar" value={inbox.validations.length + inbox.briefReviews.length} />
    </section>

    {inbox.validations.length > 0 && <TaskSection title="Validaciones del jefe del proyecto" subtitle="Aprobar u observar también es una tarea." icon={<FileCheck2 size={20} />}>
      {inbox.validations.map((item) => <TaskRow key={`validation-${item.approval.id}`} item={item} action="Revisar y validar" onOpen={() => openTask(item, 'validate')} />)}
    </TaskSection>}

    {inbox.briefReviews.length > 0 && <TaskSection title="Briefs para revisar" subtitle="Solicitudes enviadas a Marketing." icon={<Megaphone size={20} />}>
      {inbox.briefReviews.map((project) => <button className="task-row" key={`brief-${project.id}`} onClick={() => openBriefReview(project)}>
        <span className="task-type marketing"><Megaphone size={18} /></span>
        <span className="task-info"><b>Validar brief de producto</b><small>{project.code} · {project.name}</small></span>
        <StatusBadge status={project.brief.status} />
        <span className="row-action">Abrir brief</span>
      </button>)}
    </TaskSection>}

    <TaskSection title="Mis tareas asignadas" subtitle="Abrí la tarea, guardá avances y enviála a validación cuando esté terminada." icon={<CheckSquare size={20} />}>
      {inbox.assigned.length === 0 ? <div className="empty-state">No tenés tareas pendientes asignadas.</div> : inbox.assigned.map((item) => <TaskRow key={`${item.kind}-${item.task.id}`} item={item} action="Abrir tarea" onOpen={() => openTask(item)} />)}
    </TaskSection>
  </div>;
}

function TaskSection({ title, subtitle, icon, children }) {
  return <section className="card-panel task-section">
    <div className="panel-header"><div className="heading-with-icon">{icon}<div><h2>{title}</h2><p>{subtitle}</p></div></div></div>
    <div className="task-list">{children}</div>
  </section>;
}

function TaskRow({ item, onOpen, action }) {
  const sla = slaInfo(item.task.dueDate);
  return <button className="task-row" onClick={onOpen}>
    <span className={`task-type ${item.kind}`}>{item.kind === 'marketing' ? <Megaphone size={18} /> : <CheckSquare size={18} />}</span>
    <span className="task-info"><b>{item.task.name || item.task.title}</b><small>{item.project.code} · {item.project.name}</small></span>
    <span className={`sla-inline ${sla.tone}`}><Clock3 size={14} />{sla.label}<small>{formatDate(item.task.dueDate)}</small></span>
    <span className="task-progress"><ProgressBar value={item.task.progressPercent || 0} /></span>
    <StatusBadge status={item.task.status} />
    <span className="row-action">{action}</span>
  </button>;
}

function TaskMetric({ icon, label, value, tone = '' }) {
  return <article className={`metric-card ${tone}`}><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}
