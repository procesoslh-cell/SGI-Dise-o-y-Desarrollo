import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ProjectWorkflow from '../features/projects/ProjectWorkflow.jsx';
import ProjectBrief from '../features/projects/ProjectBrief.jsx';
import MarketingPlan from '../features/projects/MarketingPlan.jsx';
import CreateProjectModal from '../features/projects/CreateProjectModal.jsx';
import { api } from '../api/client.js';
import { formatDate } from '../utils/dates.js';

export default function ProjectsPage({ data, selectedProjectId, setSelectedProjectId, reload, openTask }) {
  const [tab, setTab] = useState('workflow');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const projects = data.projects.filter((project) => `${project.code} ${project.name} ${project.businessUnit?.name} ${project.category?.name}`.toLowerCase().includes(query.toLowerCase()));
  const selected = data.projects.find((project) => project.id === Number(selectedProjectId)) || projects[0];
  const canCreate = data.user.permissions?.includes('projects:create') || data.user.role?.code === 'ADMIN';
  const canDelete = selected && (data.user.role?.code === 'ADMIN' || selected.responsibleUserId === data.user.id || selected.createdBy === data.user.id);

  async function removeProject() {
    if (!window.confirm(`¿Eliminar ${selected.name}? La trazabilidad quedará conservada.`)) return;
    await api.delete(`/projects/${selected.id}`);
    setSelectedProjectId(null);
    await reload();
  }

  return <div className="projects-layout">
    <aside className="project-sidebar card-panel">
      <div className="project-sidebar-head">
        <label className="search-input"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar proyecto" /></label>
        {canCreate && <button className="button primary full" onClick={() => setCreating(true)}><Plus size={17} />Crear proyecto</button>}
      </div>
      <div className="project-list">
        {projects.map((project) => <button key={project.id} className={selected?.id === project.id ? 'active' : ''} onClick={() => setSelectedProjectId(project.id)}>
          <span><b>{project.name}</b><small>{project.code} · {project.category?.name}</small></span>
          <ProgressBar value={project.progress} />
          <StatusBadge status={project.status} />
        </button>)}
      </div>
    </aside>

    <section className="project-detail card-panel">
      {!selected ? <div className="empty-state">Seleccioná o creá un proyecto.</div> : <>
        <div className="project-detail-header">
          <div><span className="eyebrow">{selected.code}</span><h2>{selected.name}</h2><p>{selected.businessUnit?.name} · {selected.segment?.name} · {selected.category?.name} · {selected.subcategory?.name}</p></div>
          <div className="project-header-actions"><StatusBadge status={selected.status} />{canDelete && <button className="icon-button danger-text" onClick={removeProject} title="Eliminar proyecto"><Trash2 size={19} /></button>}</div>
        </div>
        <div className="project-facts">
          <div><span>Jefe del proyecto</span><b>{selected.responsible?.name}</b></div>
          <div><span>Inicio</span><b>{formatDate(selected.startDate)}</b></div>
          <div><span>Fecha objetivo</span><b>{formatDate(selected.targetDate)}</b></div>
          <div><span>Prioridad</span><b>{selected.priority}</b></div>
        </div>
        <div className="tabs">
          <button className={tab === 'workflow' ? 'active' : ''} onClick={() => setTab('workflow')}>Workflow</button>
          <button className={tab === 'brief' ? 'active' : ''} onClick={() => setTab('brief')}>Brief</button>
          <button className={tab === 'marketing' ? 'active' : ''} onClick={() => setTab('marketing')}>Plan de Marketing</button>
        </div>
        {tab === 'workflow' && <ProjectWorkflow project={selected} openTask={openTask} />}
        {tab === 'brief' && <ProjectBrief project={selected} data={data} reload={reload} />}
        {tab === 'marketing' && <MarketingPlan project={selected} data={data} reload={reload} openTask={openTask} />}
      </>}
    </section>
    <CreateProjectModal open={creating} data={data} onClose={() => setCreating(false)} reload={reload} />
  </div>;
}
