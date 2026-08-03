import { AlertTriangle, CheckCircle2, Clock3, FolderKanban, Target } from 'lucide-react';
import ProgressBar from '../components/ProgressBar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate } from '../utils/dates.js';

export default function DashboardPage({ data, selectedProjectId, setSelectedProjectId, openTask }) {
  const projects = data.projects || [];
  const selected = projects.find((project) => project.id === Number(selectedProjectId)) || null;
  const allStages = projects.flatMap((project) => project.stages || []);
  const active = projects.filter((project) => !['Cerrado', 'Eliminado'].includes(project.status)).length;
  const delayed = allStages.filter((stage) => !['Completa', 'Bloqueada'].includes(stage.status) && stage.dueDate && new Date(`${stage.dueDate}T23:59:59`) < new Date()).length;
  const pendingValidation = data.approvalRequests.filter((approval) => approval.status === 'Pendiente').length;
  const completed = projects.filter((project) => project.status === 'Cerrado').length;

  return <div className="page-stack">
    <section className="filter-bar">
      <label>Vista general del proyecto<select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value)}>
        <option value="">Todos los proyectos</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
      </select></label>
    </section>

    <section className="metrics-grid">
      <Metric icon={<FolderKanban />} label="Total proyectos" value={projects.length} detail={`${active} activos`} />
      <Metric icon={<Clock3 />} label="Tareas en curso" value={allStages.filter((stage) => ['En curso', 'Requiere ajustes'].includes(stage.status)).length} detail="Workflow activo" />
      <Metric icon={<AlertTriangle />} label="Tareas vencidas" value={delayed} detail="Requieren seguimiento" tone={delayed ? 'bad' : ''} />
      <Metric icon={<Target />} label="Pendientes de validar" value={pendingValidation} detail="Responsables de proyecto" />
      <Metric icon={<CheckCircle2 />} label="Proyectos cerrados" value={completed} detail="Ciclo completo" />
    </section>

    {selected ? <section className="dashboard-project card-panel">
      <div className="panel-header">
        <div><span className="eyebrow">{selected.code}</span><h2>{selected.name}</h2><p>{selected.businessUnit?.name} · {selected.segment?.name} · {selected.category?.name}</p></div>
        <StatusBadge status={selected.status} />
      </div>
      <div className="project-overview-grid">
        <div><span>Jefe del proyecto</span><b>{selected.responsible?.name || '-'}</b></div>
        <div><span>Inicio</span><b>{formatDate(selected.startDate)}</b></div>
        <div><span>Lanzamiento objetivo</span><b>{formatDate(selected.targetDate)}</b></div>
        <div><span>Tareas</span><b>{selected.stages.length + selected.marketingTasks.length}</b></div>
      </div>
      <ProgressBar value={selected.progress} label="Avance validado del workflow" />
      <div className="stage-preview-list">
        {selected.stages.slice(0, 8).map((stage) => <button key={stage.id} onClick={() => openTask({ kind: 'stage', task: stage, project: selected })}>
          <span className={`stage-dot ${stage.status.toLowerCase().replaceAll(' ', '-')}`} />
          <span><b>{stage.name}</b><small>{stage.assignedUser?.name || 'Sin asignar'} · vence {formatDate(stage.dueDate)}</small></span>
          <StatusBadge status={stage.status} />
        </button>)}
      </div>
    </section> : <section className="card-panel">
      <div className="panel-header"><div><h2>Portafolio general</h2><p>Resumen de todos los proyectos cargados.</p></div></div>
      <div className="portfolio-table">
        {projects.map((project) => <button key={project.id} onClick={() => setSelectedProjectId(project.id)}>
          <span><b>{project.code} · {project.name}</b><small>{project.businessUnit?.name} · {project.category?.name}</small></span>
          <ProgressBar value={project.progress} />
          <StatusBadge status={project.status} />
        </button>)}
      </div>
    </section>}
  </div>;
}

function Metric({ icon, label, value, detail, tone = '' }) {
  return <article className={`metric-card ${tone}`}><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}
