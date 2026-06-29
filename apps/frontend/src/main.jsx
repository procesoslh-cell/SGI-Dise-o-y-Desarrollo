import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  FolderKanban,
  GitBranch,
  History,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Paperclip,
  Plus,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Target,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Users,
  Workflow,
  X
} from 'lucide-react';
import './styles.css';

const api = {
  token: () => localStorage.getItem('sgiDydToken'),
  async request(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(api.token() ? { Authorization: `Bearer ${api.token()}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error de API');
    return data;
  },
  get: (path) => api.request(path),
  post: (path, body) => api.request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  put: (path, body) => api.request(path, { method: 'PUT', body: JSON.stringify(body || {}) }),
  delete: (path) => api.request(path, { method: 'DELETE' }),
  upload: (scope, id, file, extra = {}) => {
    const body = new FormData();
    body.append('file', file);
    Object.entries(extra || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') body.append(key, value);
    });
    return api.request(`/upload/${scope}/${id}`, { method: 'POST', body });
  }
};

const fmt = (date) => date ? new Intl.DateTimeFormat('es-AR').format(new Date(`${date}T00:00:00`)) : '-';
const daysLeft = (date) => Math.ceil((new Date(`${date}T23:59:59`) - new Date()) / 86400000);
const statusClass = (stage) => {
  if (!stage) return 'muted';
  if (stage.status === 'Completa' || stage.status === 'Aprobado') return 'ok';
  if (stage.status === 'Pendiente aprobación') return 'warn';
  if (stage.status === 'Requiere ajustes' || stage.status === 'Rechazado') return 'bad';
  if (stage.status === 'Bloqueada') return 'muted';
  if (daysLeft(stage.dueDate) < 0) return 'bad';
  if (daysLeft(stage.dueDate) <= 2) return 'warn';
  return 'info';
};
const has = (user, permission) => user?.permissions?.includes(permission) || user?.role?.code === 'ADMIN';
const blank = (value) => value ?? '';

const isStageForUser = (stage, user) => {
  if (!stage || !user) return false;
  return stage.assignedUserId === user.id || (!stage.assignedUserId && stage.responsibleRoleId === user.roleId) || stage.responsibleRoleId === user.roleId;
};

function buildMyTasks(data) {
  const user = data.user;
  const stages = (data.projects || []).flatMap((project) => (project.stages || []).map((stage) => ({ ...stage, project }))).filter((stage) => isStageForUser(stage, user));
  const activeStages = stages.filter((stage) => ['En curso', 'Requiere ajustes', 'Pendiente aprobación'].includes(stage.status));
  const plannedStages = stages.filter((stage) => stage.status === 'Bloqueada');
  const approvals = (data.approvalRequests || []).filter((approval) => approval.status === 'Pendiente' && (user.role?.code === 'ADMIN' || approval.approverRoleId === user.roleId));
  const observedDocuments = (data.documents || []).filter((doc) => doc.status === 'Observado' && doc.uploadedBy === user.id);
  const marketingTasks = (data.marketingTasks || []).filter((task) => task.ownerUserId === user.id && task.status !== 'Completo');
  return { activeStages, plannedStages, approvals, observedDocuments, marketingTasks, total: activeStages.length + approvals.length + observedDocuments.length + marketingTasks.length };
}

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('sgiDydToken');
    const user = localStorage.getItem('sgiDydUser');
    return token && user ? { token, user: JSON.parse(user) } : null;
  });
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const boot = await api.get('/bootstrap');
      setData(boot);
      setSelectedProjectId((current) => current || boot.projects[0]?.id || null);
      setError('');
    } catch (err) {
      setError(err.message);
      if (err.message.includes('Sesión')) logout();
    }
  }

  useEffect(() => { if (auth) load(); }, [auth]);

  function logout() {
    localStorage.removeItem('sgiDydToken');
    localStorage.removeItem('sgiDydUser');
    setAuth(null);
    setData(null);
  }

  if (!auth) return <Login onLogin={(session) => {
    localStorage.setItem('sgiDydToken', session.token);
    localStorage.setItem('sgiDydUser', JSON.stringify(session.user));
    setAuth(session);
  }} />;

  if (!data) return <div className="loading">Cargando SGI Diseño y Desarrollo...</div>;

  const projects = data.projects.filter((project) => `${project.code} ${project.name} ${project.businessUnit?.name} ${project.category?.name}`.toLowerCase().includes(query.toLowerCase()));
  const selectedProject = data.projects.find((project) => project.id === selectedProjectId) || projects[0];
  const myTasks = buildMyTasks(data);

  return <div className="shell">
    <aside>
      <div>
        <div className="brand">
          <div className="logo">SGI</div>
          <div>
            <h1>SGI<br />Diseño y Desarrollo</h1>
            <p></p>
          </div>
        </div>
        <nav>
          <NavButton view={view} setView={setView} id="dashboard" icon={<LayoutDashboard size={19} />} label="Dashboard gerencial" />
          <NavButton view={view} setView={setView} id="myTasks" icon={<ClipboardCheck size={19} />} label="Mis tareas" badge={myTasks.total} />
          <NavButton view={view} setView={setView} id="projects" icon={<FolderKanban size={19} />} label="Proyectos" />
          <NavButton view={view} setView={setView} id="productFlow" icon={<ClipboardList size={19} />} label="Brief y Producto" />
          <NavButton view={view} setView={setView} id="launch" icon={<CalendarDays size={19} />} label="Calendario" badge={data.launchMilestones?.filter((m) => m.status !== 'Completo' && daysLeft(m.date) <= 15).length} />
          <NavButton view={view} setView={setView} id="documents" icon={<Paperclip size={19} />} label="Documentos" badge={data.documents?.filter((d) => d.status === 'Observado').length} />
          <NavButton view={view} setView={setView} id="workflow" icon={<Workflow size={19} />} label="Workflow" />
          <NavButton view={view} setView={setView} id="approvals" icon={<FileCheck2 size={19} />} label="Aprobaciones" badge={data.approvalRequests.filter((a) => a.status === 'Pendiente').length} />
          <NavButton view={view} setView={setView} id="notifications" icon={<Bell size={19} />} label="Notificaciones" badge={data.notifications.length} />
          {has(data.user, 'admin:users') && <NavButton view={view} setView={setView} id="admin" icon={<ShieldCheck size={19} />} label="Administración" />}
          <NavButton view={view} setView={setView} id="architecture" icon={<Database size={19} />} label="Configuración técnica" />
        </nav>
      </div>
      <div className="profile">
        <b>{data.user.name}</b>
        <span>{data.user.role?.name}</span>
        <button onClick={logout}><LogOut size={16} />Salir</button>
      </div>
    </aside>

    <main>
      <header>
        <div>
          <span className="eyebrow">SGI Diseño y Desarrollo v{data.meta.version}</span>
          <h2>{titleFor(view)}</h2>
          <p>Seguimiento operativo del proceso de diseño, desarrollo, lanzamiento, marketing y cierre.</p>
        </div>
        <div className="actions">
          <label className="search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar proyecto..." /></label>
          <button className="ghost" onClick={load}><Settings2 size={18} />Actualizar</button>
        </div>
      </header>

      {error && <div className="banner bad"><AlertTriangle size={18} />{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
      {data.notifications.length > 0 && view !== 'notifications' && <NotificationStrip notifications={data.notifications} projects={data.projects} onOpen={(n) => { setSelectedProjectId(n.projectId); setView('notifications'); }} />}

      {view === 'dashboard' && <Dashboard data={data} projects={projects} setView={setView} setSelectedProjectId={setSelectedProjectId} />}
      {view === 'myTasks' && <MyTasks data={data} myTasks={myTasks} setView={setView} setSelectedProjectId={setSelectedProjectId} reload={load} />}
      {view === 'projects' && <Projects data={data} projects={projects} selectedProject={selectedProject} setSelectedProjectId={setSelectedProjectId} reload={load} initialTab="Resumen" />}
      {view === 'productFlow' && <Projects data={data} projects={projects} selectedProject={selectedProject} setSelectedProjectId={setSelectedProjectId} reload={load} initialTab="Brief" />}
      {view === 'launch' && <LaunchCenter data={data} selectedProject={selectedProject} setSelectedProjectId={setSelectedProjectId} reload={load} />}
      {view === 'documents' && <DocumentsCenter data={data} selectedProject={selectedProject} setSelectedProjectId={setSelectedProjectId} reload={load} />}
      {view === 'workflow' && <WorkflowCenter data={data} selectedProject={selectedProject} setSelectedProjectId={setSelectedProjectId} reload={load} />}
      {view === 'approvals' && <ApprovalCenter data={data} reload={load} setSelectedProjectId={setSelectedProjectId} setView={setView} />}
      {view === 'notifications' && <Notifications data={data} reload={load} setSelectedProjectId={setSelectedProjectId} setView={setView} />}
      {view === 'admin' && <Admin data={data} reload={load} />}
      {view === 'architecture' && <Architecture data={data} />}
    </main>
  </div>;
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: 'admin', password: '1234' });
  const [recoveryUser, setRecoveryUser] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function login(e) {
    e.preventDefault();
    try {
      const session = await api.post('/auth/login', form);
      onLogin(session);
    } catch (err) { setError(err.message); }
  }

  async function recover() {
    try {
      const res = await api.post('/auth/password/recovery/start', { username: recoveryUser || form.username });
      setMessage(res.message);
      setError('');
    } catch (err) { setError(err.message); }
  }

  return <div className="login">
    <section className="login-card">
      <div className="logo big">SGI</div>
      <span className="eyebrow">Sistema de gestión</span>
      <h1>SGI Diseño y Desarrollo</h1>
      <p>Gestión del proceso de diseño y desarrollo de productos.</p>
      {error && <div className="mini-error">{error}</div>}
      {message && <div className="mini-success">{message}</div>}
      <form onSubmit={login}>
        <label>Usuario<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>Contraseña<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <button className="primary full"><LockKeyhole size={18} />Ingresar</button>
      </form>
      <div className="recovery">
        <input placeholder="usuario o email para recuperación" value={recoveryUser} onChange={(e) => setRecoveryUser(e.target.value)} />
        <button className="ghost" onClick={recover}>Recuperar</button>
      </div>
    </section>
  </div>;
}

function NavButton({ id, view, setView, icon, label, badge }) {
  return <button className={view === id ? 'active' : ''} onClick={() => setView(id)}>{icon}{label}{badge ? <em>{badge}</em> : null}</button>;
}

function titleFor(view) {
  return ({ dashboard: 'Dashboard gerencial', myTasks: 'Mis tareas', projects: 'Proyectos', productFlow: 'Brief y Producto', launch: 'Calendario', documents: 'Documentos y archivos', workflow: 'Workflow', approvals: 'Aprobaciones y decisiones', notifications: 'Centro de notificaciones', admin: 'Administración', architecture: 'Configuración técnica' }[view] || 'SGI Diseño y Desarrollo');
}

function Dashboard({ data, projects, setView, setSelectedProjectId }) {
  const exec = data.executive || {};
  const stages = projects.flatMap((p) => p.stages || []);
  const active = exec.activeProjects ?? projects.filter((p) => !['Cerrado', 'Rechazado'].includes(p.status)).length;
  const overdueProjects = exec.overdueProjects ?? projects.filter((p) => p.targetDate && daysLeft(p.targetDate) < 0 && p.status !== 'Cerrado').length;
  const delayedStages = exec.delayedStages ?? stages.filter((s) => !['Completa', 'Bloqueada'].includes(s.status) && daysLeft(s.dueDate) < 0).length;
  const upcomingLaunches = exec.upcomingLaunches ?? (data.launchMilestones || []).filter((m) => m.status !== 'Completo' && daysLeft(m.date) <= 30).length;
  const pendingMarketing = exec.pendingMarketing ?? (data.marketingTasks || []).filter((t) => t.status !== 'Completo').length;
  const blockedTasks = exec.blockedTasks ?? (data.marketingTasks || []).filter((t) => t.status === 'Bloqueado').length;
  const slaCompliance = exec.sla?.compliance ?? 100;
  const statusRows = Object.entries(exec.byStatus || projects.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] || 0) + 1 }), {}));
  const unitRows = Object.entries(exec.byBusinessUnit || {});
  const workload = exec.workload || [];
  const upcoming = (data.launchMilestones || []).filter((m) => m.status !== 'Completo').slice(0, 6);

  return <div className="stack">
    <div className="kpis">
      <Kpi label="Proyectos activos" value={active} icon={<FolderKanban />} />
      <Kpi label="Proyectos vencidos" value={overdueProjects} danger={overdueProjects > 0} icon={<AlertTriangle />} />
      <Kpi label="Etapas demoradas" value={delayedStages} danger={delayedStages > 0} icon={<Clock3 />} />
      <Kpi label="SLA cumplimiento" value={`${slaCompliance}%`} danger={slaCompliance < 80} icon={<Target />} />
      <Kpi label="Lanzamientos próximos" value={upcomingLaunches} danger={upcomingLaunches > 0} icon={<CalendarDays />} />
      <Kpi label="Marketing pendiente" value={pendingMarketing} danger={pendingMarketing > 0} icon={<ClipboardCheck />} />
      <Kpi label="Tareas bloqueadas" value={blockedTasks} danger={blockedTasks > 0} icon={<AlertTriangle />} />
      <Kpi label="Docs observados" value={(data.documents || []).filter((d) => d.status === 'Observado').length} danger={(data.documents || []).some((d) => d.status === 'Observado')} icon={<Paperclip />} />
    </div>

    <section className="card">
      <CardTitle title="Tablero gerencial" text="Vista para jefes/dueños: estado general, carga por responsable, SLA, lanzamientos y bloqueos." />
      <div className="grid3">
        <div className="subcard"><h3>Proyectos por estado</h3><div className="mini-bars">{statusRows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b><em style={{ width: `${Math.min(100, Number(value) * 25)}%` }} /></div>)}</div></div>
        <div className="subcard"><h3>Por unidad de negocio</h3><div className="mini-bars">{unitRows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b><em style={{ width: `${Math.min(100, Number(value) * 25)}%` }} /></div>)}{!unitRows.length && <small>Sin datos.</small>}</div></div>
        <div className="subcard"><h3>Responsables con más carga</h3><div className="workload-list">{workload.slice(0, 5).map((row) => <button key={row.userId} onClick={() => setView('projects')}><b>{row.name}</b><small>{row.stages} etapas · {row.marketingTasks} marketing</small><span className="pill info">{row.total}</span></button>)}</div></div>
      </div>
    </section>

    <section className="card">
      <div className="section-head"><CardTitle title="Lanzamientos y alertas" text="Próximos hitos, tareas bloqueadas y proyectos que requieren atención." /><button className="ghost" onClick={() => setView('launch')}><CalendarDays size={18} />Abrir calendario</button></div>
      <div className="calendar-list">{upcoming.map((item) => { const project = data.projects.find((p) => p.id === item.projectId); return <div className="calendar-item" key={item.id}><div><b>{fmt(item.date)}</b><span>{item.type}</span></div><p><strong>{item.title}</strong><small>{project?.code} · faltan {daysLeft(item.date)} días</small></p><span className={`pill ${daysLeft(item.date) < 0 ? 'bad' : daysLeft(item.date) <= 7 ? 'warn' : 'info'}`}>{item.status}</span><button className="ghost" onClick={() => { setSelectedProjectId(item.projectId); setView('projects'); }}>Abrir</button></div>; })}</div>
    </section>

    <section className="card">
      <CardTitle title="Proyectos principales" text="Acceso rápido al workspace con workflow, documentos, marketing y timeline." />
      <div className="project-cards">
        {projects.map((project) => <button className="project-card" key={project.id} onClick={() => { setSelectedProjectId(project.id); setView('projects'); }}>
          <div className="project-top"><span className={`pill ${project.priority === 'Alta' ? 'bad' : 'info'}`}>{project.priority}</span><span>{project.status}</span></div>
          <h3>{project.code}</h3>
          <b>{project.name}</b>
          <small>{project.businessUnit?.name} · Responsable: {project.responsible?.name}</small>
          <div className="progress"><span style={{ width: `${project.progress}%` }} /></div>
          <small>Workflow {project.progress}% · Docs aprobados {project.documentSummary?.approved || 0}/{project.documentSummary?.required || 0} · Objetivo {fmt(project.targetDate)}</small>
        </button>)}
      </div>
    </section>
  </div>;
}


function MyTasks({ data, myTasks, setView, setSelectedProjectId, reload }) {
  async function openProject(projectId, tab = 'Workflow') {
    setSelectedProjectId(projectId);
    setView(tab === 'Documentos' ? 'documents' : 'projects');
  }
  async function markRead(notification) {
    await api.put(`/notifications/${notification.id}/read`, {});
    await reload();
  }
  const active = myTasks.activeStages || [];
  const planned = myTasks.plannedStages || [];
  const approvals = myTasks.approvals || [];
  const observed = myTasks.observedDocuments || [];
  const marketing = myTasks.marketingTasks || [];
  return <div className="stack">
    <section className="card">
      <div className="section-head"><CardTitle title="Mis tareas" text="Bandeja personal del usuario. Muestra qué debe resolver ahora y qué tareas le quedan programadas dentro del proceso." /><button className="ghost" onClick={reload}><Settings2 size={18} />Actualizar</button></div>
      <div className="kpis">
        <Kpi label="Activas" value={active.length} danger={active.some((stage) => daysLeft(stage.dueDate) < 0)} icon={<ClipboardCheck />} />
        <Kpi label="Aprobaciones" value={approvals.length} danger={approvals.length > 0} icon={<FileCheck2 />} />
        <Kpi label="Docs observados" value={observed.length} danger={observed.length > 0} icon={<Paperclip />} />
        <Kpi label="Programadas" value={planned.length} icon={<Clock3 />} />
      </div>
    </section>

    <section className="card">
      <CardTitle title="Qué tengo que hacer ahora" text="Estas tareas están habilitadas para trabajar. Al completar una etapa se habilita automáticamente la siguiente tarea del proceso." />
      <div className="task-list">
        {active.map((stage) => <div className="task-card" key={stage.id}>
          <div><b>{stage.name}</b><small>{stage.project.code} · {stage.project.name}</small><small>Responsable: {stage.assignedUser?.name || data.roles.find((role) => role.id === stage.responsibleRoleId)?.name} · vence {fmt(stage.dueDate)}</small></div>
          <span className={`pill ${statusClass(stage)}`}>{stage.status}</span>
          <button className="primary" onClick={() => openProject(stage.projectId)}><ChevronRight size={17} />Abrir tarea</button>
        </div>)}
        {!active.length && <Empty title="Sin tareas activas" text="No tenés etapas habilitadas en este momento." />}
      </div>
    </section>

    {!!approvals.length && <section className="card">
      <CardTitle title="Aprobaciones pendientes" text="Instancias que requieren tu decisión para que el flujo pueda continuar." />
      <div className="task-list">{approvals.map((approval) => { const project = data.projects.find((p) => p.id === approval.projectId); return <div className="task-card" key={approval.id}><div><b>{approval.title}</b><small>{project?.code} · {project?.name}</small><small>{approval.comment || 'Sin comentario'}</small></div><span className="pill warn">Pendiente</span><button className="primary" onClick={() => { setSelectedProjectId(approval.projectId); setView('approvals'); }}>Resolver</button></div>; })}</div>
    </section>}

    {!!observed.length && <section className="card">
      <CardTitle title="Documentos observados" text="Archivos cargados por vos que requieren corrección o una nueva versión." />
      <div className="task-list">{observed.map((doc) => { const project = data.projects.find((p) => p.id === doc.projectId); return <div className="task-card" key={doc.id}><div><b>{doc.name}</b><small>{project?.code} · {project?.name}</small><small>{doc.comments?.[0]?.comment || 'Revisar observación del documento.'}</small></div><span className="pill bad">Observado</span><button className="ghost" onClick={() => openProject(doc.projectId, 'Documentos')}>Abrir documentos</button></div>; })}</div>
    </section>}

    {!!marketing.length && <section className="card">
      <CardTitle title="Marketing asignado" text="Tareas de lanzamiento o comunicación a tu nombre." />
      <div className="task-list">{marketing.map((task) => { const project = data.projects.find((p) => p.id === task.projectId); return <div className="task-card" key={task.id}><div><b>{task.title}</b><small>{project?.code} · {task.channel} · vence {fmt(task.dueDate)}</small><small>{task.notes}</small></div><span className={`pill ${task.status === 'Bloqueado' ? 'bad' : task.status === 'En progreso' ? 'warn' : 'info'}`}>{task.status}</span><button className="ghost" onClick={() => { setSelectedProjectId(task.projectId); setView('launch'); }}>Abrir calendario</button></div>; })}</div>
    </section>}

    <section className="card">
      <CardTitle title="Tareas programadas" text="Ya quedaron asignadas cuando se creó el proyecto. Se activan automáticamente cuando se completa la etapa anterior." />
      <div className="task-list compact">{planned.slice(0, 20).map((stage) => <div className="task-card" key={stage.id}><div><b>{stage.order}. {stage.name}</b><small>{stage.project.code} · {stage.project.name}</small><small>{stage.phase} · vence estimado {fmt(stage.dueDate)}</small></div><span className="pill muted">En espera</span></div>)}{!planned.length && <small>No hay tareas futuras asignadas.</small>}</div>
    </section>

    <section className="card">
      <CardTitle title="Notificaciones recientes" text="Alertas pendientes relacionadas con tus tareas, aprobaciones, documentos o vencimientos." />
      <div className="task-list compact">{(data.notificationCenter || []).filter((n) => !n.read).slice(0, 8).map((n) => <div className="task-card" key={n.id}><div><b>{n.title}</b><small>{data.projects.find((p) => p.id === n.projectId)?.code || 'General'} · {n.message}</small></div><button className="ghost" onClick={() => markRead(n)}>Marcar leída</button></div>)}{!(data.notificationCenter || []).some((n) => !n.read) && <small>No tenés notificaciones pendientes.</small>}</div>
    </section>
  </div>;
}

function Projects({ data, projects, selectedProject, setSelectedProjectId, reload, initialTab }) {
  const [showForm, setShowForm] = useState(false);
  if (!selectedProject) return <Empty title="Sin proyectos" text="Creá el primer proyecto Diseño y Desarrollo." />;
  return <div className="workspace-layout">
    <section className="card project-list">
      <div className="section-head"><CardTitle title="Proyectos" text="Código, unidad, categoría, responsable, fecha objetivo, estado y prioridad." />{has(data.user, 'projects:create') && <button className="primary" onClick={() => setShowForm(true)}><Plus size={18} />Nuevo</button>}</div>
      {projects.map((project) => <button key={project.id} onClick={() => setSelectedProjectId(project.id)} className={project.id === selectedProject.id ? 'selected row-card' : 'row-card'}>
        <b>{project.code}</b>
        <span>{project.name}</span>
        <small>{project.status} · {project.priority} · WF {project.progress}% · CK {project.checklistProgress}%</small>
      </button>)}
    </section>
    <ProjectWorkspace data={data} project={selectedProject} reload={reload} initialTab={initialTab} />
    {showForm && <ProjectModal data={data} close={() => setShowForm(false)} created={(project) => { setShowForm(false); setSelectedProjectId(project.id); reload(); }} />}
  </div>;
}

function ProjectWorkspace({ data, project, reload, initialTab = 'Resumen' }) {
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState({});
  const [brief, setBrief] = useState(project.brief || {});
  const [analysis, setAnalysis] = useState(project.productAnalysis || {});
  const [launchPlan, setLaunchPlan] = useState(project.launchPlan || {});
  const [decision, setDecision] = useState({ title: '', decision: 'Aprobado', rationale: '' });
  const [selectedStageId, setSelectedStageId] = useState(project.stages.find((s) => ['En curso', 'Requiere ajustes', 'Pendiente aprobación'].includes(s.status))?.id || project.stages[0]?.id);
  const [stageAssignee, setStageAssignee] = useState('');
  const stage = project.stages.find((s) => s.id === selectedStageId) || project.stages[0];

  useEffect(() => {
    const nextStage = project.stages.find((s) => ['En curso', 'Requiere ajustes', 'Pendiente aprobación'].includes(s.status)) || project.stages[0];
    setSelectedStageId(nextStage?.id);
    setEditing(nextStage?.formData || {});
    setStageAssignee(nextStage?.assignedUserId || '');
    setBrief(project.brief || {});
    setAnalysis(project.productAnalysis || {});
    setLaunchPlan(project.launchPlan || {});
    setTab(initialTab || 'Resumen');
  }, [project.id, initialTab]);

  async function saveStage() {
    await api.put(`/project-stages/${stage.id}`, { formData: editing, assignedUserId: stageAssignee || stage.assignedUserId, status: stage.status === 'Requiere ajustes' ? 'En curso' : stage.status });
    await reload();
  }
  async function complete() {
    await api.post(`/project-stages/${stage.id}/complete`, { comment: 'Solicitud de avance desde workspace.' });
    await reload();
  }
  async function requestApproval() {
    await api.post(`/project-stages/${stage.id}/approval/request`, { comment: 'Revisión solicitada desde workspace.' });
    await reload();
  }
  async function saveBrief() {
    await api.put(`/projects/${project.id}/brief`, brief);
    await reload();
  }
  async function saveAnalysis() {
    await api.put(`/projects/${project.id}/product-analysis`, analysis);
    await reload();
  }
  async function saveLaunchPlan() {
    await api.put(`/projects/${project.id}/launch-plan`, launchPlan);
    await reload();
  }
  async function toggleChecklist(item) {
    await api.put(`/checklist-items/${item.id}/toggle`, { done: !item.done });
    await reload();
  }
  async function upload(scopeId, file, scope = 'project') {
    if (!file) return;
    await api.upload(scope, scopeId, file);
    await reload();
  }
  async function createDecision() {
    if (!decision.title) return;
    await api.post('/decisions', { ...decision, code: 'MANUAL', projectId: project.id, projectStageId: stage?.id });
    setDecision({ title: '', decision: 'Aprobado', rationale: '' });
    await reload();
  }
  async function approve(approval) {
    await api.post(`/approvals/${approval.id}/approve`, { comment: 'Aprobado desde workspace.' });
    await reload();
  }
  async function reject(approval) {
    await api.post(`/approvals/${approval.id}/reject`, { comment: 'Requiere ajustes desde workspace.' });
    await reload();
  }

  return <section className="card workspace">
    <div className="workspace-head">
      <div>
        <span className="eyebrow">{project.code}</span>
        <h2>{project.name}</h2>
        <p>{project.businessUnit?.name} · {project.category?.name} · {project.subcategory?.name}</p>
      </div>
      <span className="pill info">{project.status}</span>
    </div>
    <div className="tabs">{['Resumen', 'Brief', 'Producto', 'Marketing', 'Workflow', 'Checklist', 'Documentación', 'Aprobaciones', 'Decisiones', 'Timeline'].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'active' : ''}>{item}</button>)}</div>

    {tab === 'Resumen' && <SummaryTab data={data} project={project} />}
    {tab === 'Brief' && <BriefTab brief={brief} setBrief={setBrief} saveBrief={saveBrief} canEdit={has(data.user, 'brief:update')} />}
    {tab === 'Producto' && <ProductTab analysis={analysis} setAnalysis={setAnalysis} saveAnalysis={saveAnalysis} launchPlan={launchPlan} setLaunchPlan={setLaunchPlan} saveLaunchPlan={saveLaunchPlan} canEditAnalysis={has(data.user, 'analysis:update')} canEditMarketing={has(data.user, 'marketing:manage')} />}
    {tab === 'Marketing' && <ProjectMarketingTab data={data} project={project} reload={reload} canEdit={has(data.user, 'marketing:manage')} canEditLaunch={has(data.user, 'launch:manage')} />}
    {tab === 'Workflow' && <WorkflowTab data={data} project={project} stage={stage} selectedStageId={selectedStageId} setSelectedStageId={setSelectedStageId} setEditing={setEditing} editing={editing} setEditingState={setEditing} stageAssignee={stageAssignee} setStageAssignee={setStageAssignee} saveStage={saveStage} complete={complete} requestApproval={requestApproval} upload={upload} />}
    {tab === 'Checklist' && <ChecklistTab project={project} toggleChecklist={toggleChecklist} canEdit={has(data.user, 'checklist:update')} />}
    {tab === 'Documentación' && <DocumentationTab data={data} project={project} upload={upload} reload={reload} canReview={has(data.user, 'documents:review')} />}
    {tab === 'Aprobaciones' && <ApprovalsTab project={project} data={data} approve={approve} reject={reject} canApprove={has(data.user, 'approvals:manage')} />}
    {tab === 'Decisiones' && <DecisionsTab project={project} data={data} decision={decision} setDecision={setDecision} createDecision={createDecision} canCreate={has(data.user, 'decisions:manage')} />}
    {tab === 'Timeline' && <Timeline items={project.timeline} />}
  </section>;
}

function SummaryTab({ data, project }) {
  const pending = project.approvals.filter((a) => a.status === 'Pendiente').length;
  return <div className="summary-grid">
    <Meta label="Responsable" value={project.responsible?.name} />
    <Meta label="Fecha objetivo" value={fmt(project.targetDate)} />
    <Meta label="Prioridad" value={project.priority} />
    <Meta label="Workflow" value={data.workflows.find((w) => w.id === project.workflowId)?.name} />
    <Meta label="Avance workflow" value={`${project.progress}%`} />
    <Meta label="Checklist" value={`${project.checklistProgress}%`} />
    <Meta label="Aprobaciones pendientes" value={pending} />
    <Meta label="Decisiones" value={project.decisions.length} />
    <div className="wide progress big"><span style={{ width: `${project.progress}%` }} /></div>
    <div className="banner info wide"><CheckCircle2 size={18} />El proyecto no termina en lanzamiento: continúa con Marketing, entregables y cierre.</div>
  </div>;
}

function BriefTab({ brief, setBrief, saveBrief, canEdit }) {
  return <div className="stack">
    <section className="subcard">
      <CardTitle title="Brief del proyecto" text="Primer bloque formal. Define necesidad, segmento y oportunidad antes del análisis." />
      <div className="formgrid">
        <label>Origen de la solicitud<select value={blank(brief.origenSolicitud)} onChange={(e) => setBrief({ ...brief, origenSolicitud: e.target.value })}><option value="">Seleccionar</option><option>Brand Manager</option><option>Comercial</option><option>Gerencia</option><option>Proveedor</option><option>Odoo / histórico</option></select></label>
        <label>Fecha objetivo comercial<input type="date" value={blank(brief.fechaObjetivo)} onChange={(e) => setBrief({ ...brief, fechaObjetivo: e.target.value })} /></label>
        <label className="wide">Necesidad de mercado<textarea value={blank(brief.necesidad)} onChange={(e) => setBrief({ ...brief, necesidad: e.target.value })} /></label>
        <label>Cliente / segmento objetivo<input value={blank(brief.clienteObjetivo)} onChange={(e) => setBrief({ ...brief, clienteObjetivo: e.target.value })} /></label>
        <label>Oportunidad detectada<input value={blank(brief.oportunidad)} onChange={(e) => setBrief({ ...brief, oportunidad: e.target.value })} /></label>
      </div>
      {canEdit && <button className="primary" onClick={saveBrief}><Save size={18} />Guardar brief</button>}
    </section>
  </div>;
}

function ProductTab({ analysis, setAnalysis, saveAnalysis, launchPlan, setLaunchPlan, saveLaunchPlan, canEditAnalysis, canEditMarketing }) {
  return <div className="stack">
    <section className="subcard">
      <CardTitle title="Analista de Producto" text="Formulario específico para mercado, competencia, volumen, precio y recomendación." />
      <div className="formgrid">
        <label>Segmento objetivo<input value={blank(analysis.segmento)} onChange={(e) => setAnalysis({ ...analysis, segmento: e.target.value })} /></label>
        <label>Recomendación<select value={blank(analysis.recomendacion)} onChange={(e) => setAnalysis({ ...analysis, recomendacion: e.target.value })}><option value="">Seleccionar</option><option>Avanzar</option><option>Pedir más información</option><option>No avanzar</option></select></label>
        <label>Precio referencia<input type="number" value={blank(analysis.precioReferencia)} onChange={(e) => setAnalysis({ ...analysis, precioReferencia: e.target.value })} /></label>
        <label>Volumen estimado<input type="number" value={blank(analysis.volumenEstimado)} onChange={(e) => setAnalysis({ ...analysis, volumenEstimado: e.target.value })} /></label>
        <label className="wide">Competidores<textarea value={blank(analysis.competidores)} onChange={(e) => setAnalysis({ ...analysis, competidores: e.target.value })} /></label>
        <label className="wide">Riesgos detectados<textarea value={blank(analysis.riesgos)} onChange={(e) => setAnalysis({ ...analysis, riesgos: e.target.value })} /></label>
      </div>
      {canEditAnalysis && <button className="primary" onClick={saveAnalysis}><Save size={18} />Guardar análisis</button>}
    </section>
    <section className="subcard">
      <CardTitle title="Marketing y calendario de lanzamiento" text="Conecta fechas, campaña, canales y presupuesto estimado para la preparación del lanzamiento." />
      <div className="formgrid">
        <label>Campaña<input value={blank(launchPlan.campaignName)} onChange={(e) => setLaunchPlan({ ...launchPlan, campaignName: e.target.value })} /></label>
        <label>Fecha objetivo de lanzamiento<input type="date" value={blank(launchPlan.targetLaunchDate)} onChange={(e) => setLaunchPlan({ ...launchPlan, targetLaunchDate: e.target.value })} /></label>
        <label>Pre lanzamiento<input type="date" value={blank(launchPlan.preLaunchDate)} onChange={(e) => setLaunchPlan({ ...launchPlan, preLaunchDate: e.target.value })} /></label>
        <label>Lanzamiento<input type="date" value={blank(launchPlan.launchDate)} onChange={(e) => setLaunchPlan({ ...launchPlan, launchDate: e.target.value })} /></label>
        <label>Post lanzamiento<input type="date" value={blank(launchPlan.postLaunchDate)} onChange={(e) => setLaunchPlan({ ...launchPlan, postLaunchDate: e.target.value })} /></label>
        <label>Presupuesto estimado<input type="number" value={blank(launchPlan.budgetEstimate)} onChange={(e) => setLaunchPlan({ ...launchPlan, budgetEstimate: e.target.value })} /></label>
        <label>Estado<select value={blank(launchPlan.status)} onChange={(e) => setLaunchPlan({ ...launchPlan, status: e.target.value })}><option value="">Seleccionar</option><option>Pendiente</option><option>En progreso</option><option>Completo</option></select></label>
        <label className="wide">Mensaje principal<textarea value={blank(launchPlan.mainMessage)} onChange={(e) => setLaunchPlan({ ...launchPlan, mainMessage: e.target.value })} /></label>
      </div>
      {canEditMarketing && <button className="ghost" onClick={saveLaunchPlan}><CalendarDays size={18} />Guardar plan marketing</button>}
    </section>
  </div>;
}

function WorkflowTab({ data, project, stage, selectedStageId, setSelectedStageId, setEditing, editing, setEditingState, stageAssignee, setStageAssignee, saveStage, complete, requestApproval, upload }) {
  if (!stage) return <Empty title="Sin etapas" text="Este proyecto no tiene workflow asignado." />;
  return <div className="workflow-workspace">
    <div className="stage-list">
      {project.stages.map((item) => <button key={item.id} onClick={() => { setSelectedStageId(item.id); setEditing(item.formData || {}); setStageAssignee(item.assignedUserId || ''); }} className={item.id === selectedStageId ? 'selected stage-card' : 'stage-card'}>
        <span className={`dot ${statusClass(item)}`} />
        <div><b>{item.order}. {item.name}</b><small>{item.phase} · {item.responsibleRole?.name} · SLA {item.slaDays}d · CK {item.checklistProgress}%</small></div>
      </button>)}
    </div>
    <div className="stage-detail">
      <div className="stage-title"><div><h3>{stage.name}</h3><p>{stage.phase} · Estado: {stage.status} · vence {fmt(stage.dueDate)}</p></div><span className={`pill ${statusClass(stage)}`}>{stage.status}</span></div>
      <div className="mini-panel"><b>Próxima acción</b><small>Responsable: {stage.assignedUser?.name || data.roles.find((role) => role.id === stage.responsibleRoleId)?.name || '-'} · Rol: {stage.responsibleRole?.name || '-'}</small></div>
      <div className="formgrid">
        <label>Responsable de la tarea<select value={stageAssignee || ''} onChange={(e) => setStageAssignee(Number(e.target.value))}>{data.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name} · {data.roles.find((role) => role.id === user.roleId)?.name}</option>)}</select></label>
      </div>
      <div className="mini-panel"><b>{stage.form?.name}</b><small>{stage.form?.description}</small></div>
      <div className="formgrid">
        {(stage.form?.fields || []).map((field) => <Field key={field.key} field={field} value={editing[field.key] ?? stage.formData?.[field.key] ?? ''} onChange={(value) => setEditingState({ ...editing, [field.key]: value })} />)}
      </div>
      <div className="docs"><b><Paperclip size={18} />Documentos de la etapa</b><small>Plantilla esperada: {stage.documentTemplate?.name || 'Sin plantilla definida'}</small><label className="upload"><Upload size={18} />Subir archivo<input type="file" onChange={(e) => upload(stage.id, e.target.files[0], 'stage')} /></label>{stage.documents?.map((doc) => <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer">{doc.name}</a>)}</div>
      <div className="buttons">
        <button className="primary" onClick={saveStage}><Save size={18} />Guardar etapa</button>
        {stage.transition?.requiresApproval && !stage.pendingApproval && !['Completa', 'Bloqueada'].includes(stage.status) && <button className="ghost" onClick={requestApproval}><Send size={18} />Solicitar aprobación</button>}
        {stage.status !== 'Completa' && stage.status !== 'Bloqueada' && <button className="ghost" onClick={complete}><CheckCircle2 size={18} />Completar / avanzar</button>}
      </div>
      {stage.pendingApproval && <div className="banner warn"><FileCheck2 size={18} />Esta etapa está pendiente de aprobación: {stage.pendingApproval.title}</div>}
    </div>
  </div>;
}

function Field({ field, value, onChange }) {
  const common = { value: blank(value), onChange: (e) => onChange(e.target.value) };
  return <label className={field.type === 'textarea' ? 'wide' : ''}>{field.label}{field.type === 'textarea' ? <textarea {...common} /> : field.type === 'select' ? <select {...common}><option value="">Seleccionar</option>{field.options?.map((opt) => <option key={opt}>{opt}</option>)}</select> : <input type={field.type || 'text'} {...common} />}</label>;
}

function ChecklistTab({ project, toggleChecklist, canEdit }) {
  return <div className="stack">
    <div className="banner info"><ListChecks size={18} />Avance total de checklist: {project.checklistProgress}%</div>
    {project.stages.map((stage) => <section className="subcard" key={stage.id}>
      <div className="section-head"><CardTitle title={`${stage.order}. ${stage.name}`} text={`${stage.phase} · ${stage.checklistProgress}% completo`} /><span className={`pill ${statusClass(stage)}`}>{stage.status}</span></div>
      <div className="checklist-lines">
        {stage.checklist.map((item) => <button disabled={!canEdit} key={item.id} onClick={() => toggleChecklist(item)} className={item.done ? 'checked' : ''}>
          <CheckCircle2 size={18} />
          <span>{item.label}</span>
          <small>{item.required ? 'Obligatorio' : 'Opcional'}</small>
        </button>)}
      </div>
    </section>)}
  </div>;
}

function DocumentationTab({ data, project, upload, reload, canReview }) {
  const [commentByDoc, setCommentByDoc] = useState({});
  async function setStatus(doc, status) {
    await api.put(`/documents/${doc.id}/status`, { status, comment: commentByDoc[doc.id] || '' });
    setCommentByDoc({ ...commentByDoc, [doc.id]: '' });
    await reload();
  }
  async function addComment(doc) {
    const comment = commentByDoc[doc.id];
    if (!comment) return;
    await api.post(`/documents/${doc.id}/comments`, { comment });
    setCommentByDoc({ ...commentByDoc, [doc.id]: '' });
    await reload();
  }
  const summary = project.documentSummary || {};
  return <div className="stack">
    <div className="kpis">
      <Kpi label="Obligatorios" value={summary.required || 0} icon={<FileText />} />
      <Kpi label="Pendientes" value={summary.pending || 0} danger={(summary.pending || 0) > 0} icon={<Clock3 />} />
      <Kpi label="Observados" value={summary.observed || 0} danger={(summary.observed || 0) > 0} icon={<AlertTriangle />} />
      <Kpi label="Aprobados" value={summary.approved || 0} icon={<FileCheck2 />} />
    </div>
    <section className="subcard">
      <CardTitle title="Documentos generales del proyecto" text="Material transversal: presupuestos, referencias, fotos, catálogos o anexos que no pertenecen a una etapa puntual." />
      <div className="docs"><b><Paperclip size={18} />Archivos generales</b><label className="upload"><Upload size={18} />Subir archivo<input type="file" onChange={(e) => upload(project.id, e.target.files[0], 'project')} /></label>{project.documents?.map((doc) => <DocumentCard key={doc.id} doc={doc} canReview={canReview} comment={commentByDoc[doc.id] || ''} setComment={(value) => setCommentByDoc({ ...commentByDoc, [doc.id]: value })} setStatus={setStatus} addComment={addComment} />)}{!project.documents?.length && <small>No hay documentos generales todavía.</small>}</div>
    </section>
    {project.stages.map((stage) => <section className="subcard" key={stage.id}>
      <div className="section-head"><CardTitle title={`${stage.order}. ${stage.name}`} text={`${stage.phase} · vencimiento ${fmt(stage.dueDate)}`} /><span className={`pill ${statusClass(stage)}`}>{stage.status}</span></div>
      <div className="doc-template-grid">
        {(stage.documentRequirements || []).map((req) => <div className="doc-requirement" key={req.template.id}>
          <div className="section-head"><div><b>{req.template.name}</b><small>{req.template.type} · {req.required ? 'Obligatorio' : 'Opcional'}</small></div><span className={`pill ${req.status === 'Aprobado' ? 'ok' : req.status === 'Observado' ? 'bad' : req.status === 'Cargado' ? 'warn' : 'muted'}`}>{req.status}</span></div>
          <label className="upload"><Upload size={18} />Subir nueva versión<input type="file" onChange={(e) => upload(stage.id, e.target.files[0], 'stage', { templateId: req.template.id })} /></label>
          {req.latest ? <DocumentCard doc={req.latest} canReview={canReview} comment={commentByDoc[req.latest.id] || ''} setComment={(value) => setCommentByDoc({ ...commentByDoc, [req.latest.id]: value })} setStatus={setStatus} addComment={addComment} /> : <div className="banner warn"><Clock3 size={18} />Documento pendiente de carga.</div>}
          {req.versions?.length > 1 && <details><summary>Historial de versiones</summary><div className="version-list">{req.versions.map((doc) => <span key={doc.id}>v{doc.versionNumber} · {doc.status} · {new Date(doc.createdAt).toLocaleString('es-AR')}</span>)}</div></details>}
        </div>)}
      </div>
    </section>)}
  </div>;
}

function DocumentsCenter({ data, selectedProject, setSelectedProjectId, reload }) {
  const [projectId, setProjectId] = useState(selectedProject?.id || data.projects[0]?.id);
  const project = data.projects.find((p) => p.id === Number(projectId)) || selectedProject || data.projects[0];
  if (!project) return <Empty title="Sin proyectos" text="No hay documentación para mostrar." />;
  async function uploadDoc(scopeId, file, scope = 'project', extra = {}) { if (!file) return; await api.upload(scope, scopeId, file, extra); await reload(); }
  return <div className="stack">
    <section className="card"><div className="section-head"><CardTitle title="Centro documental" text="Vista transversal de archivos, obligatorios, versiones, comentarios y estados." /><select value={project.id} onChange={(e) => { setProjectId(Number(e.target.value)); setSelectedProjectId(Number(e.target.value)); }}>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></div></section>
    <section className="card"><DocumentationTab data={data} project={project} upload={uploadDoc} reload={reload} canReview={has(data.user, 'documents:review')} /></section>
  </div>;
}

function DocumentCard({ doc, canReview, comment, setComment, setStatus, addComment }) {
  const status = doc.status || 'Cargado';
  const previewable = !!doc.url;
  return <div className="doc-card">
    <div className="doc-main">
      <div><b>{doc.name}</b><small>v{doc.versionNumber || 1} · {doc.mimeType || 'archivo'} · subido por {doc.uploader?.name || 'Sistema'} · {doc.createdAt ? new Date(doc.createdAt).toLocaleString('es-AR') : '-'}</small>{doc.reviewer && <small>Revisado por {doc.reviewer.name} · {doc.reviewedAt ? new Date(doc.reviewedAt).toLocaleString('es-AR') : '-'}</small>}</div>
      <span className={`pill ${status === 'Aprobado' ? 'ok' : status === 'Observado' ? 'bad' : 'warn'}`}>{status}</span>
    </div>
    <div className="buttons">{previewable ? <a className="ghost" href={doc.url} target="_blank" rel="noreferrer"><FileText size={17} />Vista previa</a> : <span className="ghost"><FileText size={17} />Demo sin archivo físico</span>}{canReview && <><button className="ghost" onClick={() => setStatus(doc, 'Observado')}>Observar</button><button className="primary" onClick={() => setStatus(doc, 'Aprobado')}>Aprobar</button></>}</div>
    <div className="comment-box"><input placeholder="Comentario sobre el documento" value={comment} onChange={(e) => setComment(e.target.value)} /><button className="ghost" onClick={() => addComment(doc)}>Comentar</button></div>
    {!!doc.comments?.length && <div className="doc-comments">{doc.comments.map((c) => <small key={c.id}><b>{c.user}</b>: {c.comment}</small>)}</div>}
  </div>;
}

function ApprovalsTab({ project, data, approve, reject, canApprove }) {
  return <div className="stack">
    <CardTitle title="Aprobaciones del proyecto" text="Las etapas con aprobación no avanzan hasta que Jefe/Admin apruebe o rechace." />
    <table><tbody>{project.approvals.map((approval) => {
      const stage = project.stages.find((s) => s.id === approval.projectStageId);
      const requester = data.users.find((u) => u.id === approval.requestedBy);
      return <tr key={approval.id}><td><b>{approval.title}</b><small>{stage?.name} · solicitado por {requester?.name || '-'}</small></td><td><span className={`pill ${approval.status === 'Pendiente' ? 'warn' : approval.status === 'Aprobado' ? 'ok' : 'bad'}`}>{approval.status}</span></td><td>{approval.comment}</td><td>{approval.status === 'Pendiente' && canApprove ? <div className="buttons"><button className="primary" onClick={() => approve(approval)}><ThumbsUp size={17} />Aprobar</button><button className="danger" onClick={() => reject(approval)}><ThumbsDown size={17} />Rechazar</button></div> : '-'}</td></tr>;
    })}{!project.approvals.length && <tr><td>No hay aprobaciones para este proyecto.</td></tr>}</tbody></table>
  </div>;
}

function DecisionsTab({ project, data, decision, setDecision, createDecision, canCreate }) {
  return <div className="stack">
    <section className="subcard">
      <CardTitle title="Decisiones del flujograma" text="Mapa de decisiones detectadas en el procedimiento. Las decisiones reales quedan registradas abajo." />
      <div className="decision-grid">{data.flowchartDecisions.map((item) => <div className="architecture-item" key={item.code}><b>{item.code} · {item.name}</b><span>{item.question}</span><small>Si: {item.positive} · No: {item.negative}</small></div>)}</div>
    </section>
    <section className="subcard">
      <CardTitle title="Registrar decisión manual" text="Útil para dejar trazabilidad de validaciones fuera del botón de aprobación." />
      <div className="formgrid">
        <label>Título<input value={decision.title} onChange={(e) => setDecision({ ...decision, title: e.target.value })} /></label>
        <label>Decisión<select value={decision.decision} onChange={(e) => setDecision({ ...decision, decision: e.target.value })}><option>Aprobado</option><option>Requiere ajustes</option><option>Rechazado</option><option>Informativo</option></select></label>
        <label className="wide">Fundamento<textarea value={decision.rationale} onChange={(e) => setDecision({ ...decision, rationale: e.target.value })} /></label>
      </div>
      {canCreate && <button className="primary" onClick={createDecision}><Save size={18} />Registrar decisión</button>}
    </section>
    <section className="subcard">
      <CardTitle title="Historial de decisiones" />
      <DecisionList decisions={project.decisions.slice().reverse()} data={data} />
    </section>
  </div>;
}

function LaunchCenter({ data, selectedProject, setSelectedProjectId, reload }) {
  const [projectId, setProjectId] = useState('all');
  const [unitId, setUnitId] = useState('all');
  const [ownerId, setOwnerId] = useState('all');
  const [mode, setMode] = useState('Mes');
  const [task, setTask] = useState({ title: '', channel: 'Marketing', status: 'Pendiente', priority: 'Media', dueDate: '', ownerUserId: data.user.id, notes: '' });
  const [milestone, setMilestone] = useState({ title: '', type: 'Lanzamiento', date: '', status: 'Pendiente', ownerRoleId: 'role_marketing' });
  const filteredProjects = data.projects.filter((project) => (projectId === 'all' || project.id === Number(projectId)) && (unitId === 'all' || project.businessUnitId === Number(unitId)));
  const allowedProjectIds = new Set(filteredProjects.map((p) => p.id));
  const filteredMilestones = (data.launchMilestones || []).filter((m) => allowedProjectIds.has(m.projectId) && (ownerId === 'all' || m.ownerRoleId === ownerId));
  const filteredTasks = (data.marketingTasks || []).filter((t) => allowedProjectIds.has(t.projectId) && (ownerId === 'all' || t.ownerUserId === Number(ownerId)));
  const project = data.projects.find((p) => p.id === Number(projectId)) || selectedProject || data.projects[0];
  const overdueMilestones = filteredMilestones.filter((m) => m.status !== 'Completo' && daysLeft(m.date) < 0).length;
  const upcomingMilestones = filteredMilestones.filter((m) => m.status !== 'Completo' && daysLeft(m.date) <= 15).length;
  const blockedTasks = filteredTasks.filter((t) => t.status === 'Bloqueado').length;
  const weekItems = filteredMilestones.filter((m) => Math.abs(daysLeft(m.date)) <= 7);
  const monthCells = buildMonthCells(filteredMilestones);
  async function createTask() { if (!project || !task.title) return; await api.post(`/projects/${project.id}/marketing-tasks`, task); setTask({ title: '', channel: 'Marketing', status: 'Pendiente', priority: 'Media', dueDate: '', ownerUserId: data.user.id, notes: '' }); await reload(); }
  async function updateTask(item, status) { await api.put(`/marketing-tasks/${item.id}`, { status }); await reload(); }
  async function createMilestone() { if (!project || !milestone.title || !milestone.date) return; await api.post(`/projects/${project.id}/launch-milestones`, milestone); setMilestone({ title: '', type: 'Lanzamiento', date: '', status: 'Pendiente', ownerRoleId: 'role_marketing' }); await reload(); }
  async function updateMilestone(item, status) { await api.put(`/launch-milestones/${item.id}`, { status }); await reload(); }
  return <div className="stack">
    <div className="kpis"><Kpi label="Hitos próximos" value={upcomingMilestones} danger={upcomingMilestones > 0} icon={<CalendarDays />} /><Kpi label="Hitos vencidos" value={overdueMilestones} danger={overdueMilestones > 0} icon={<AlertTriangle />} /><Kpi label="Tareas bloqueadas" value={blockedTasks} danger={blockedTasks > 0} icon={<Clock3 />} /><Kpi label="Tareas pendientes" value={filteredTasks.filter((t) => t.status !== 'Completo').length} danger={filteredTasks.some((t) => t.status !== 'Completo')} icon={<ClipboardCheck />} /></div>
    <section className="card"><CardTitle title="Calendario de lanzamientos" text="Vista mensual/semanal con filtros por proyecto, unidad de negocio y responsable." /><div className="filterbar"><select value={mode} onChange={(e) => setMode(e.target.value)}><option>Mes</option><option>Semana</option><option>Proyecto</option><option>Unidad</option></select><select value={projectId} onChange={(e) => { setProjectId(e.target.value); if (e.target.value !== 'all') setSelectedProjectId(Number(e.target.value)); }}><option value="all">Todos los proyectos</option>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select><select value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="all">Todas las unidades</option>{data.businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}><option value="all">Todos los responsables</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}{data.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      {mode === 'Mes' && <div className="month-grid">{monthCells.map((cell) => <div key={cell.key} className={cell.isToday ? 'today' : ''}><b>{cell.day}</b>{cell.items.map((item) => { const p = data.projects.find((x) => x.id === item.projectId); return <button key={item.id} onClick={() => { setSelectedProjectId(item.projectId); setProjectId(String(item.projectId)); }}><small>{item.type}</small><span>{item.title}</span><em>{p?.code}</em></button>; })}</div>)}</div>}
      {mode === 'Semana' && <div className="calendar-list">{weekItems.map((item) => { const p = data.projects.find((x) => x.id === item.projectId); return <div className="calendar-item" key={item.id}><div><b>{fmt(item.date)}</b><span>{item.type}</span></div><p><strong>{item.title}</strong><small>{p?.code} · {p?.name}</small></p><span className={`pill ${daysLeft(item.date) < 0 ? 'bad' : daysLeft(item.date) <= 3 ? 'warn' : 'info'}`}>{item.status}</span><button className="ghost" onClick={() => updateMilestone(item, 'Completo')}>Completar</button></div>; })}</div>}
      {['Proyecto', 'Unidad'].includes(mode) && <div className="gantt">{filteredProjects.map((p) => <div className="gantt-row" key={p.id}><div><b>{p.code} · {p.name}</b><small>{p.businessUnit?.name} · {p.status}</small></div><span className="bar info">{(data.launchMilestones || []).filter((m) => m.projectId === p.id).map((m) => `${fmt(m.date)} ${m.type}`).join(' · ') || 'Sin hitos'}</span></div>)}</div>}
    </section>
    <section className="card"><CardTitle title="Tablero de Marketing" text="Tareas por estado, canal, responsable y vencimiento. Incluye bloqueos para alertar al equipo." /><div className="kanban">{['Pendiente', 'En progreso', 'Bloqueado', 'Completo'].map((status) => <div className="kanban-col" key={status}><h4>{status}</h4>{filteredTasks.filter((t) => t.status === status).map((item) => { const p = data.projects.find((x) => x.id === item.projectId); const owner = data.users.find((u) => u.id === item.ownerUserId); return <div className="task-card" key={item.id}><b>{item.title}</b><small>{p?.code} · {item.channel} · {owner?.name || '-'} · vence {fmt(item.dueDate)}</small><span className={`pill ${item.priority === 'Alta' ? 'bad' : 'info'}`}>{item.priority}</span>{item.notes && <p>{item.notes}</p>}{has(data.user, 'marketing:manage') && status !== 'Completo' && <div className="buttons"><button className="ghost" onClick={() => updateTask(item, 'En progreso')}>En progreso</button><button className="danger" onClick={() => updateTask(item, 'Bloqueado')}>Bloquear</button><button className="primary" onClick={() => updateTask(item, 'Completo')}>Completo</button></div>}</div>; })}</div>)}</div></section>
    {(has(data.user, 'marketing:manage') || has(data.user, 'launch:manage')) && <section className="card"><CardTitle title={`Nuevos elementos · ${project?.code || ''}`} text="Alta rápida de tareas de marketing e hitos de calendario para el proyecto seleccionado." /><div className="grid2"><div className="formgrid one"><h3>Nueva tarea</h3><label>Título<input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} /></label><label>Canal<input value={task.channel} onChange={(e) => setTask({ ...task, channel: e.target.value })} /></label><label>Vencimiento<input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} /></label><label>Prioridad<select value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })}><option>Alta</option><option>Media</option><option>Baja</option></select></label><label>Responsable<select value={task.ownerUserId} onChange={(e) => setTask({ ...task, ownerUserId: Number(e.target.value) })}>{data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Notas<textarea value={task.notes} onChange={(e) => setTask({ ...task, notes: e.target.value })} /></label><button className="primary" onClick={createTask}><Plus size={18} />Crear tarea</button></div><div className="formgrid one"><h3>Nuevo hito</h3><label>Título<input value={milestone.title} onChange={(e) => setMilestone({ ...milestone, title: e.target.value })} /></label><label>Tipo<select value={milestone.type} onChange={(e) => setMilestone({ ...milestone, type: e.target.value })}><option>Pre lanzamiento</option><option>Lanzamiento</option><option>Post lanzamiento</option><option>Cierre</option></select></label><label>Fecha<input type="date" value={milestone.date} onChange={(e) => setMilestone({ ...milestone, date: e.target.value })} /></label><label>Responsable rol<select value={milestone.ownerRoleId} onChange={(e) => setMilestone({ ...milestone, ownerRoleId: e.target.value })}>{data.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button className="primary" onClick={createMilestone}><CalendarDays size={18} />Crear hito</button></div></div></section>}
  </div>;
}

function buildMonthCells(items) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay() || 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startDay + 1);
  return Array.from({ length: 35 }).map((_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    const key = d.toISOString().slice(0, 10);
    return { key, day: d.getDate(), isToday: key === today.toISOString().slice(0, 10), items: items.filter((item) => item.date === key) };
  });
}

function ProjectMarketingTab({ data, project, reload, canEdit, canEditLaunch }) {
  const [task, setTask] = useState({ title: '', channel: 'Marketing', status: 'Pendiente', priority: 'Media', dueDate: '', ownerUserId: data.user.id, notes: '' });
  const [milestone, setMilestone] = useState({ title: '', type: 'Lanzamiento', date: '', status: 'Pendiente', ownerRoleId: 'role_marketing' });
  async function createTask() { if (!task.title) return; await api.post(`/projects/${project.id}/marketing-tasks`, task); setTask({ title: '', channel: 'Marketing', status: 'Pendiente', priority: 'Media', dueDate: '', ownerUserId: data.user.id, notes: '' }); await reload(); }
  async function updateTask(item, status) { await api.put(`/marketing-tasks/${item.id}`, { status }); await reload(); }
  async function createMilestone() { if (!milestone.title || !milestone.date) return; await api.post(`/projects/${project.id}/launch-milestones`, milestone); setMilestone({ title: '', type: 'Lanzamiento', date: '', status: 'Pendiente', ownerRoleId: 'role_marketing' }); await reload(); }
  return <div className="stack">
    <section className="subcard"><CardTitle title="Plan de lanzamiento" text="El proyecto sigue vivo después del lanzamiento hasta que Marketing complete sus entregables." /><div className="summary-grid"><Meta label="Campaña" value={project.launchPlan?.campaignName || '-'} /><Meta label="Pre lanzamiento" value={fmt(project.launchPlan?.preLaunchDate)} /><Meta label="Lanzamiento" value={fmt(project.launchPlan?.launchDate || project.launchPlan?.targetLaunchDate)} /><Meta label="Post lanzamiento" value={fmt(project.launchPlan?.postLaunchDate)} /><Meta label="Estado" value={project.launchPlan?.status || '-'} /><Meta label="Presupuesto estimado" value={project.launchPlan?.budgetEstimate ? `$ ${Number(project.launchPlan.budgetEstimate).toLocaleString('es-AR')}` : '-'} /></div></section>
    <section className="subcard"><CardTitle title="Hitos del calendario" /><div className="calendar-list">{(project.launchMilestones || []).map((item) => <div className="calendar-item" key={item.id}><div><b>{fmt(item.date)}</b><span>{item.type}</span></div><p><strong>{item.title}</strong><small>{item.status}</small></p><span className={`pill ${item.status === 'Completo' ? 'ok' : 'info'}`}>{item.status}</span></div>)}</div></section>
    <section className="subcard"><CardTitle title="Entregables de marketing" /><div className="task-list">{(project.marketingTasks || []).map((item) => <div className="task-row" key={item.id}><div><b>{item.title}</b><small>{item.channel} · vence {fmt(item.dueDate)} · {item.notes}</small></div><span className={`pill ${item.status === 'Completo' ? 'ok' : item.status === 'Bloqueado' ? 'bad' : 'warn'}`}>{item.status}</span>{canEdit && item.status !== 'Completo' && <button className="ghost" onClick={() => updateTask(item, 'Completo')}>Marcar completo</button>}</div>)}</div></section>
    {(canEdit || canEditLaunch) && <section className="subcard"><CardTitle title="Agregar tarea o hito" /><div className="grid2"><div className="formgrid one"><label>Tarea<input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} /></label><label>Canal<input value={task.channel} onChange={(e) => setTask({ ...task, channel: e.target.value })} /></label><label>Vencimiento<input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} /></label>{canEdit && <button className="primary" onClick={createTask}>Crear tarea</button>}</div><div className="formgrid one"><label>Hito<input value={milestone.title} onChange={(e) => setMilestone({ ...milestone, title: e.target.value })} /></label><label>Tipo<select value={milestone.type} onChange={(e) => setMilestone({ ...milestone, type: e.target.value })}><option>Pre lanzamiento</option><option>Lanzamiento</option><option>Post lanzamiento</option><option>Cierre</option></select></label><label>Fecha<input type="date" value={milestone.date} onChange={(e) => setMilestone({ ...milestone, date: e.target.value })} /></label>{canEditLaunch && <button className="primary" onClick={createMilestone}>Crear hito</button>}</div></div></section>}
  </div>;
}


function WorkflowCenter({ data, selectedProject, setSelectedProjectId, reload }) {
  const [workflowId, setWorkflowId] = useState(data.workflows[0]?.id || '');
  const workflow = data.workflows.find((item) => item.id === Number(workflowId)) || data.workflows[0];
  const stages = data.stages.filter((stage) => stage.workflowId === workflow?.id).sort((a, b) => a.order - b.order);
  const transitions = data.transitions.filter((transition) => transition.workflowId === workflow?.id);
  const [wfForm, setWfForm] = useState({ code: workflow?.code || '', name: workflow?.name || '', version: workflow?.version || '', description: workflow?.description || '', active: workflow?.active !== false });
  const [newWorkflow, setNewWorkflow] = useState({ code: '', name: '', version: '1.0.0', description: '' });
  const [stageForm, setStageForm] = useState({ name: '', phase: 'Producto', responsibleRoleId: 'role_jefe', slaDays: 2, checklistItems: 'Validación inicial, Documentación cargada, Responsable confirmado', documentName: 'Documento requerido', fieldsJson: '[{"key":"observaciones","label":"Observaciones","type":"textarea"}]' });
  const [transitionForm, setTransitionForm] = useState({ fromStageId: stages[0]?.id || '', toStageId: stages[1]?.id || '', action: '', requiresApproval: false, approverRoleId: 'role_jefe', decisionCode: 'MANUAL' });
  const [selectedFormId, setSelectedFormId] = useState(stages[0]?.formId || data.forms[0]?.id || '');
  const selectedForm = data.forms.find((form) => form.id === Number(selectedFormId));
  const [formEditor, setFormEditor] = useState({ name: selectedForm?.name || '', description: selectedForm?.description || '', fieldsJson: JSON.stringify(selectedForm?.fields || [], null, 2) });
  const [decisionForm, setDecisionForm] = useState({ code: '', name: '', question: '', positive: '', negative: '' });

  useEffect(() => {
    const next = data.workflows.find((item) => item.id === Number(workflowId)) || data.workflows[0];
    setWfForm({ code: next?.code || '', name: next?.name || '', version: next?.version || '', description: next?.description || '', active: next?.active !== false });
  }, [workflowId, data.workflows.length]);

  useEffect(() => {
    const form = data.forms.find((item) => item.id === Number(selectedFormId));
    setFormEditor({ name: form?.name || '', description: form?.description || '', fieldsJson: JSON.stringify(form?.fields || [], null, 2) });
  }, [selectedFormId, data.forms.length]);

  async function saveWorkflow() {
    await api.put(`/workflows/${workflow.id}`, wfForm);
    await reload();
  }
  async function createWorkflow() {
    if (!newWorkflow.name) return;
    const created = await api.post('/workflows', newWorkflow);
    setNewWorkflow({ code: '', name: '', version: '1.0.0', description: '' });
    setWorkflowId(created.id);
    await reload();
  }
  async function deleteWorkflow() {
    if (!confirm('¿Eliminar workflow? Solo se permite si no tiene proyectos asociados.')) return;
    await api.delete(`/workflows/${workflow.id}`);
    setWorkflowId(data.workflows[0]?.id || '');
    await reload();
  }
  async function createStage() {
    if (!stageForm.name) return;
    await api.post(`/workflows/${workflow.id}/stages`, stageForm);
    setStageForm({ ...stageForm, name: '' });
    await reload();
  }
  async function saveStage(stage, patch) {
    await api.put(`/stages/${stage.id}`, { ...stage, ...patch });
    await reload();
  }
  async function deleteStage(stage) {
    if (!confirm('¿Eliminar etapa? No se permite si ya fue usada en proyectos.')) return;
    await api.delete(`/stages/${stage.id}`);
    await reload();
  }
  async function saveForm() {
    await api.put(`/forms/${selectedForm.id}`, formEditor);
    await reload();
  }
  async function saveChecklist(stage, value) {
    const tpl = data.checklistTemplates.find((item) => item.stageId === stage.id);
    if (!tpl) return;
    await api.put(`/checklist-templates/${tpl.id}`, { items: value });
    await reload();
  }
  async function saveDocument(stage, patch) {
    const doc = data.documentTemplates.find((item) => item.stageId === stage.id);
    if (!doc) return;
    await api.put(`/document-templates/${doc.id}`, patch);
    await reload();
  }
  async function createTransition() {
    if (!transitionForm.action || !transitionForm.fromStageId || !transitionForm.toStageId) return;
    await api.post('/transitions', { ...transitionForm, workflowId: workflow.id });
    setTransitionForm({ ...transitionForm, action: '' });
    await reload();
  }
  async function updateTransition(transition, patch) {
    await api.put(`/transitions/${transition.id}`, { ...transition, ...patch });
    await reload();
  }
  async function deleteTransition(transition) {
    await api.delete(`/transitions/${transition.id}`);
    await reload();
  }
  async function createDecisionConfig() {
    if (!decisionForm.code || !decisionForm.name || !decisionForm.question) return;
    await api.post('/flowchart-decisions', decisionForm);
    setDecisionForm({ code: '', name: '', question: '', positive: '', negative: '' });
    await reload();
  }
  async function updateDecisionConfig(item, patch) {
    await api.put(`/flowchart-decisions/${item.code}`, { ...item, ...patch });
    await reload();
  }
  async function deleteDecisionConfig(item) {
    await api.delete(`/flowchart-decisions/${item.code}`);
    await reload();
  }

  if (!workflow) return <Empty title="Sin workflow" text="Creá un workflow para comenzar." />;

  return <div className="stack">
    <section className="card">
      <CardTitle title="Workflow Builder" text="Configurable desde pantalla: workflows, etapas, responsables, SLA, formularios, checklist, documentación, transiciones y decisiones." />
      <div className="filterbar"><b>Workflow</b><select value={workflow.id} onChange={(e) => setWorkflowId(Number(e.target.value))}>{data.workflows.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></div>
      <div className="formgrid">
        <label>Código<input value={wfForm.code} onChange={(e) => setWfForm({ ...wfForm, code: e.target.value })} /></label>
        <label>Nombre<input value={wfForm.name} onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })} /></label>
        <label>Versión<input value={wfForm.version} onChange={(e) => setWfForm({ ...wfForm, version: e.target.value })} /></label>
        <label>Activo<select value={wfForm.active ? 'true' : 'false'} onChange={(e) => setWfForm({ ...wfForm, active: e.target.value === 'true' })}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
        <label className="wide">Descripción<textarea value={wfForm.description} onChange={(e) => setWfForm({ ...wfForm, description: e.target.value })} /></label>
      </div>
      <div className="buttons"><button className="primary" onClick={saveWorkflow}><Save size={18} />Guardar workflow</button><button className="danger" onClick={deleteWorkflow}>Eliminar</button></div>
    </section>

    <section className="card">
      <CardTitle title="Crear nuevo workflow" text="Para cambios grandes conviene crear un workflow nuevo y asignarlo a proyectos nuevos, preservando el histórico." />
      <div className="formgrid">
        <label>Código<input value={newWorkflow.code} onChange={(e) => setNewWorkflow({ ...newWorkflow, code: e.target.value })} placeholder="WF-NUEVO" /></label>
        <label>Nombre<input value={newWorkflow.name} onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })} /></label>
        <label>Versión<input value={newWorkflow.version} onChange={(e) => setNewWorkflow({ ...newWorkflow, version: e.target.value })} /></label>
        <label className="wide">Descripción<textarea value={newWorkflow.description} onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })} /></label>
      </div>
      <button className="primary" onClick={createWorkflow}><Plus size={18} />Crear workflow</button>
    </section>

    <section className="card">
      <CardTitle title="Etapas configurables" text="Orden, fase, rol responsable, SLA, formulario, checklist y documento requerido." />
      <table><tbody>{stages.map((stage) => {
        const checklist = data.checklistTemplates.find((item) => item.stageId === stage.id);
        const doc = data.documentTemplates.find((item) => item.stageId === stage.id);
        return <tr key={stage.id}><td><b>{stage.order}. {stage.name}</b><small>{stage.phase} · SLA {stage.slaDays} días</small></td><td><select value={stage.phase} onChange={(e) => saveStage(stage, { phase: e.target.value })}>{['Brief','Producto','Lanzamiento','Marketing','Cierre','Auditoría'].map((x) => <option key={x}>{x}</option>)}</select></td><td><select value={stage.responsibleRoleId} onChange={(e) => saveStage(stage, { responsibleRoleId: e.target.value })}>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></td><td><input className="small-input" type="number" value={stage.slaDays} onChange={(e) => saveStage(stage, { slaDays: e.target.value })} /></td><td><select value={stage.formId} onChange={(e) => saveStage(stage, { formId: e.target.value })}>{data.forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select></td><td><button className="ghost" onClick={() => setSelectedFormId(stage.formId)}>Editar formulario</button></td><td><button className="danger" onClick={() => deleteStage(stage)}>Eliminar</button></td></tr>;
      })}{!stages.length && <tr><td>No hay etapas todavía.</td></tr>}</tbody></table>
      <div className="grid2"><div className="formgrid one"><h3>Nueva etapa</h3><label>Nombre<input value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} /></label><label>Fase<select value={stageForm.phase} onChange={(e) => setStageForm({ ...stageForm, phase: e.target.value })}>{['Brief','Producto','Lanzamiento','Marketing','Cierre','Auditoría'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Rol responsable<select value={stageForm.responsibleRoleId} onChange={(e) => setStageForm({ ...stageForm, responsibleRoleId: e.target.value })}>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label>SLA días<input type="number" value={stageForm.slaDays} onChange={(e) => setStageForm({ ...stageForm, slaDays: e.target.value })} /></label><label>Documento requerido<input value={stageForm.documentName} onChange={(e) => setStageForm({ ...stageForm, documentName: e.target.value })} /></label></div><div className="formgrid one"><h3>Checklist y formulario</h3><label>Checklist<textarea value={stageForm.checklistItems} onChange={(e) => setStageForm({ ...stageForm, checklistItems: e.target.value })} /></label><label>Campos JSON<textarea value={stageForm.fieldsJson} onChange={(e) => setStageForm({ ...stageForm, fieldsJson: e.target.value })} /></label><button className="primary" onClick={createStage}><Plus size={18} />Crear etapa</button></div></div>
    </section>

    <section className="card">
      <CardTitle title="Editor de formularios, checklist y documentos" text="Los formularios son JSON simple para que Desarrollo pueda ver la estructura exacta." />
      <div className="filterbar"><b>Formulario</b><select value={selectedFormId} onChange={(e) => setSelectedFormId(Number(e.target.value))}>{data.forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select></div>
      {selectedForm && <div className="grid2"><div className="formgrid one"><label>Nombre<input value={formEditor.name} onChange={(e) => setFormEditor({ ...formEditor, name: e.target.value })} /></label><label>Descripción<textarea value={formEditor.description} onChange={(e) => setFormEditor({ ...formEditor, description: e.target.value })} /></label><label>Campos JSON<textarea value={formEditor.fieldsJson} onChange={(e) => setFormEditor({ ...formEditor, fieldsJson: e.target.value })} /></label><button className="primary" onClick={saveForm}><Save size={18} />Guardar formulario</button></div><div className="stack">{stages.map((stage) => { const checklist = data.checklistTemplates.find((item) => item.stageId === stage.id); const doc = data.documentTemplates.find((item) => item.stageId === stage.id); return <div className="subcard" key={stage.id}><b>{stage.name}</b><label>Checklist<textarea defaultValue={(checklist?.items || []).join('\n')} onBlur={(e) => saveChecklist(stage, e.target.value)} /></label>{doc && <div className="formgrid one"><label>Documento<input defaultValue={doc.name} onBlur={(e) => saveDocument(stage, { name: e.target.value })} /></label><label>Tipo<input defaultValue={doc.type} onBlur={(e) => saveDocument(stage, { type: e.target.value })} /></label></div>}</div>; })}</div></div>}
    </section>

    <section className="card">
      <CardTitle title="Transiciones" text="Definí qué etapa habilita a cuál, si requiere aprobación, rol aprobador y código de decisión." />
      <table><tbody>{transitions.map((transition) => {
        const from = data.stages.find((stage) => stage.id === transition.fromStageId);
        const to = data.stages.find((stage) => stage.id === transition.toStageId);
        return <tr key={transition.id}><td><b>{from?.name}</b><small>{transition.action}</small></td><td><ChevronRight size={18} /></td><td>{to?.name}</td><td><input className="small-input" value={transition.decisionCode || ''} onChange={(e) => updateTransition(transition, { decisionCode: e.target.value })} /></td><td><select value={transition.requiresApproval ? 'true' : 'false'} onChange={(e) => updateTransition(transition, { requiresApproval: e.target.value === 'true' })}><option value="false">Automática</option><option value="true">Requiere aprobación</option></select></td><td><button className="danger" onClick={() => deleteTransition(transition)}>Eliminar</button></td></tr>;
      })}{!transitions.length && <tr><td>No hay transiciones configuradas.</td></tr>}</tbody></table>
      <div className="formgrid"><label>Desde<select value={transitionForm.fromStageId} onChange={(e) => setTransitionForm({ ...transitionForm, fromStageId: e.target.value })}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.order}. {stage.name}</option>)}</select></label><label>Hacia<select value={transitionForm.toStageId} onChange={(e) => setTransitionForm({ ...transitionForm, toStageId: e.target.value })}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.order}. {stage.name}</option>)}</select></label><label>Acción<input value={transitionForm.action} onChange={(e) => setTransitionForm({ ...transitionForm, action: e.target.value })} /></label><label>Código decisión<input value={transitionForm.decisionCode} onChange={(e) => setTransitionForm({ ...transitionForm, decisionCode: e.target.value })} /></label><label>Aprobación<select value={transitionForm.requiresApproval ? 'true' : 'false'} onChange={(e) => setTransitionForm({ ...transitionForm, requiresApproval: e.target.value === 'true' })}><option value="false">Automática</option><option value="true">Requiere aprobación</option></select></label><label>Rol aprobador<select value={transitionForm.approverRoleId} onChange={(e) => setTransitionForm({ ...transitionForm, approverRoleId: e.target.value })}>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div>
      <button className="primary" onClick={createTransition}><GitBranch size={18} />Crear transición</button>
    </section>

    <section className="card">
      <CardTitle title="Decisiones del flujograma" text="Se configuran las preguntas y salidas positivas/negativas que luego quedan trazadas en timeline." />
      <table><tbody>{data.flowchartDecisions.map((item) => <tr key={item.code}><td><b>{item.code} · {item.name}</b><small>{item.question}</small></td><td><input value={item.positive || ''} onChange={(e) => updateDecisionConfig(item, { positive: e.target.value })} /></td><td><input value={item.negative || ''} onChange={(e) => updateDecisionConfig(item, { negative: e.target.value })} /></td><td><button className="danger" onClick={() => deleteDecisionConfig(item)}>Eliminar</button></td></tr>)}</tbody></table>
      <div className="formgrid"><label>Código<input value={decisionForm.code} onChange={(e) => setDecisionForm({ ...decisionForm, code: e.target.value })} /></label><label>Nombre<input value={decisionForm.name} onChange={(e) => setDecisionForm({ ...decisionForm, name: e.target.value })} /></label><label className="wide">Pregunta<textarea value={decisionForm.question} onChange={(e) => setDecisionForm({ ...decisionForm, question: e.target.value })} /></label><label>Salida positiva<input value={decisionForm.positive} onChange={(e) => setDecisionForm({ ...decisionForm, positive: e.target.value })} /></label><label>Salida negativa<input value={decisionForm.negative} onChange={(e) => setDecisionForm({ ...decisionForm, negative: e.target.value })} /></label></div>
      <button className="primary" onClick={createDecisionConfig}><Plus size={18} />Crear decisión</button>
    </section>

    {selectedProject && <section className="card">
      <CardTitle title={`Vista de prueba · ${selectedProject.code}`} text="Cómo se ve este flujo aplicado a un proyecto real." />
      <div className="gantt">{selectedProject.stages.map((stage) => <div className="gantt-row" key={stage.id}><div><b>{stage.order}. {stage.name}</b><small>{stage.phase} · {stage.responsibleRole?.name} · CK {stage.checklistProgress}%</small></div><span className={`bar ${statusClass(stage)}`}>{stage.status} · vence {fmt(stage.dueDate)}</span></div>)}</div>
    </section>}
  </div>;
}

function ApprovalCenter({ data, reload, setSelectedProjectId, setView }) {
  async function approve(approval) { await api.post(`/approvals/${approval.id}/approve`, { comment: 'Aprobado desde centro de aprobaciones.' }); await reload(); }
  async function reject(approval) { await api.post(`/approvals/${approval.id}/reject`, { comment: 'Requiere ajustes desde centro de aprobaciones.' }); await reload(); }
  return <section className="card">
    <CardTitle title="Centro de aprobaciones" text="Vista transversal para Jefe/Admin. Desde acá se aprueba o rechaza y queda decisión registrada en timeline." />
    <table><tbody>{data.approvalRequests.map((approval) => {
      const project = data.projects.find((p) => p.id === approval.projectId);
      const stage = project?.stages.find((s) => s.id === approval.projectStageId);
      return <tr key={approval.id}><td onClick={() => { setSelectedProjectId(approval.projectId); setView('projects'); }}><b>{approval.title}</b><small>{project?.code} · {stage?.name}</small></td><td><span className={`pill ${approval.status === 'Pendiente' ? 'warn' : approval.status === 'Aprobado' ? 'ok' : 'bad'}`}>{approval.status}</span></td><td>{approval.comment}</td><td>{approval.status === 'Pendiente' && has(data.user, 'approvals:manage') ? <div className="buttons"><button className="primary" onClick={() => approve(approval)}><ThumbsUp size={17} />Aprobar</button><button className="danger" onClick={() => reject(approval)}><ThumbsDown size={17} />Rechazar</button></div> : '-'}</td></tr>;
    })}{!data.approvalRequests.length && <tr><td>No hay aprobaciones.</td></tr>}</tbody></table>
  </section>;
}

function Notifications({ data, reload, setSelectedProjectId, setView }) {
  const items = data.notificationCenter || data.notifications || [];
  async function openNotification(notification) {
    if (!notification.read) await api.put(`/notifications/${notification.id}/read`, {});
    if (notification.projectId) setSelectedProjectId(notification.projectId);
    if (notification.type === 'approval') setView('approvals');
    else if (['launch', 'marketing-due', 'blocker'].includes(notification.type)) setView('launch');
    else if (notification.type === 'document') setView('documents');
    else setView('projects');
    await reload();
  }
  async function toggle(notification) {
    await api.put(`/notifications/${notification.id}/${notification.read ? 'unread' : 'read'}`, {});
    await reload();
  }
  async function readAll() { await api.put('/notifications/read-all', {}); await reload(); }
  const unread = items.filter((n) => !n.read).length;
  return <section className="card">
    <div className="section-head"><CardTitle title="Centro de notificaciones" text="Nuevas tareas, vencimientos, rechazos, aprobaciones, documentos y bloqueos. Permite marcar leído/no leído." /><button className="ghost" onClick={readAll}>Marcar todo leído</button></div>
    <div className="banner info"><Bell size={18} />{unread} notificaciones sin leer. En una etapa posterior se conectan email, push/PWA y reglas por usuario.</div>
    <table><tbody>{items.map((notification) => {
      const project = data.projects.find((p) => p.id === notification.projectId);
      return <tr key={notification.id} className={notification.read ? 'read-row' : ''}><td onClick={() => openNotification(notification)}><b>{notification.title}</b><small>{notification.message}</small><small>{notification.createdAt ? new Date(notification.createdAt).toLocaleString('es-AR') : ''}</small></td><td>{project?.code || '-'}</td><td><span className={`pill ${['sla','marketing-due','launch'].includes(notification.type) ? 'warn' : ['rejection','blocker'].includes(notification.type) ? 'bad' : notification.type === 'document' ? 'info' : 'info'}`}>{notification.type}</span></td><td><button className="ghost" onClick={() => toggle(notification)}>{notification.read ? 'No leído' : 'Leído'}</button></td><td><button className="primary" onClick={() => openNotification(notification)}>Abrir</button></td></tr>;
    })}{!items.length && <tr><td>No hay notificaciones.</td></tr>}</tbody></table>
  </section>;
}


function Admin({ data, reload }) {
  const [tab, setTab] = useState('Usuarios');
  return <div className="stack">
    <section className="card">
      <CardTitle title="Administración Diseño y Desarrollo" text="CRUD completo para que Desarrollo pruebe usuarios, roles/permisos, catálogos y configuración base." />
      <div className="tabs">{['Usuarios', 'Roles', 'Catálogos', 'Resumen técnico'].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'active' : ''}>{item}</button>)}</div>
      {tab === 'Usuarios' && <AdminUsers data={data} reload={reload} />}
      {tab === 'Roles' && <AdminRoles data={data} reload={reload} />}
      {tab === 'Catálogos' && <AdminCatalogs data={data} reload={reload} />}
      {tab === 'Resumen técnico' && <AdminTechnicalSummary data={data} />}
    </section>
  </div>;
}

function AdminUsers({ data, reload }) {
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '1234', roleId: data.roles[0]?.id, active: true });
  async function create() {
    if (!form.name || !form.email || !form.username) return;
    await api.post('/users', form);
    setForm({ name: '', email: '', username: '', password: '1234', roleId: data.roles[0]?.id, active: true });
    await reload();
  }
  async function update(user, patch) {
    await api.put(`/users/${user.id}`, { ...user, ...patch });
    await reload();
  }
  async function deactivate(user) {
    if (!confirm(`¿Desactivar usuario ${user.name}?`)) return;
    await api.delete(`/users/${user.id}`);
    await reload();
  }
  return <div className="grid2">
    <div className="formgrid one"><CardTitle title="Nuevo usuario" text="Alta con rol, estado y contraseña inicial." /><label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Usuario<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label>Contraseña<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><label>Rol<select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><button className="primary" onClick={create}><Plus size={18} />Crear usuario</button></div>
    <div className="stack"><CardTitle title="Usuarios existentes" text="Edición inline: rol, estado y contraseña." /><table><tbody>{data.users.map((user) => <tr key={user.id}><td><b>{user.name}</b><small>{user.email} · @{user.username}</small></td><td><select value={user.roleId} onChange={(e) => update(user, { roleId: e.target.value })}>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></td><td><select value={user.active ? 'true' : 'false'} onChange={(e) => update(user, { active: e.target.value === 'true' })}><option value="true">Activo</option><option value="false">Inactivo</option></select></td><td><button className="ghost" onClick={() => { const password = prompt('Nueva contraseña', '1234'); if (password) update(user, { password }); }}>Reset clave</button></td><td><button className="danger" onClick={() => deactivate(user)}>Desactivar</button></td></tr>)}</tbody></table></div>
  </div>;
}

function AdminRoles({ data, reload }) {
  const [form, setForm] = useState({ code: '', name: '', description: '', permissionIds: [] });
  const grouped = data.permissionCatalog.reduce((acc, permission) => { acc[permission.area] ||= []; acc[permission.area].push(permission); return acc; }, {});
  function togglePermission(id, checked) {
    setForm((current) => ({ ...current, permissionIds: checked ? [...new Set([...current.permissionIds, id])] : current.permissionIds.filter((item) => item !== id) }));
  }
  async function create() {
    if (!form.name || !form.code) return;
    await api.post('/roles', form);
    setForm({ code: '', name: '', description: '', permissionIds: [] });
    await reload();
  }
  async function update(role, patch) {
    await api.put(`/roles/${role.id}`, { ...role, ...patch });
    await reload();
  }
  async function remove(role) {
    if (!confirm(`¿Eliminar rol ${role.name}?`)) return;
    await api.delete(`/roles/${role.id}`);
    await reload();
  }
  return <div className="stack">
    <section className="subcard"><CardTitle title="Crear rol" text="Permisos agrupados por área para probar perfiles reales." /><div className="formgrid"><label>Código<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label><label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="wide">Descripción<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label></div><div className="permission-groups">{Object.entries(grouped).map(([area, permissions]) => <div className="subcard" key={area}><b>{area}</b>{permissions.map((permission) => <label className="checkline" key={permission.id}><input type="checkbox" checked={form.permissionIds.includes(permission.id)} onChange={(e) => togglePermission(permission.id, e.target.checked)} />{permission.name}</label>)}</div>)}</div><button className="primary" onClick={create}><Plus size={18} />Crear rol</button></section>
    <section className="subcard"><CardTitle title="Roles existentes" text="Podés editar nombre, descripción y permisos." /><div className="role-grid">{data.roles.map((role) => <RoleEditor key={role.id} role={role} data={data} update={update} remove={remove} />)}</div></section>
  </div>;
}

function RoleEditor({ role, data, update, remove }) {
  const [draft, setDraft] = useState({ name: role.name, description: role.description, permissionIds: role.permissionIds || [] });
  function toggle(id, checked) { setDraft((current) => ({ ...current, permissionIds: checked ? [...new Set([...current.permissionIds, id])] : current.permissionIds.filter((item) => item !== id) })); }
  return <div className="role-card"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><textarea value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /><div className="permission-list">{data.permissionCatalog.map((permission) => <label className="checkline" key={permission.id}><input type="checkbox" checked={draft.permissionIds.includes(permission.id)} onChange={(e) => toggle(permission.id, e.target.checked)} />{permission.id}</label>)}</div><div className="buttons"><button className="primary" onClick={() => update(role, draft)}>Guardar</button>{role.code !== 'ADMIN' && <button className="danger" onClick={() => remove(role)}>Eliminar</button>}</div></div>;
}

function AdminCatalogs({ data, reload }) {
  const [unit, setUnit] = useState({ name: '', code: '' });
  const [category, setCategory] = useState({ name: '', businessUnitId: data.businessUnits[0]?.id || '' });
  const [subcategory, setSubcategory] = useState({ name: '', categoryId: data.categories[0]?.id || '' });
  async function createUnit() { if (!unit.name) return; await api.post('/catalog/businessUnits', { ...unit, code: unit.code || unit.name.slice(0, 3).toUpperCase() }); setUnit({ name: '', code: '' }); await reload(); }
  async function createCategory() { if (!category.name) return; await api.post('/catalog/categories', { ...category, businessUnitId: Number(category.businessUnitId), active: true }); setCategory({ name: '', businessUnitId: data.businessUnits[0]?.id || '' }); await reload(); }
  async function createSubcategory() { if (!subcategory.name) return; await api.post('/catalog/subcategories', { ...subcategory, categoryId: Number(subcategory.categoryId), active: true }); setSubcategory({ name: '', categoryId: data.categories[0]?.id || '' }); await reload(); }
  async function update(collection, item, patch) { await api.put(`/catalog/${collection}/${item.id}`, { ...item, ...patch }); await reload(); }
  async function remove(collection, item) { if (!confirm(`¿Eliminar/desactivar ${item.name}?`)) return; await api.delete(`/catalog/${collection}/${item.id}`); await reload(); }
  return <div className="grid3">
    <div><h3>Unidades</h3>{data.businessUnits.map((x) => <div className="catalog" key={x.id}><input value={x.code || ''} onChange={(e) => update('businessUnits', x, { code: e.target.value })} /><input value={x.name || ''} onChange={(e) => update('businessUnits', x, { name: e.target.value })} /><select value={x.active !== false ? 'true' : 'false'} onChange={(e) => update('businessUnits', x, { active: e.target.value === 'true' })}><option value="true">Activa</option><option value="false">Inactiva</option></select><button className="danger" onClick={() => remove('businessUnits', x)}>Eliminar</button></div>)}<div className="inline-form"><input value={unit.code} onChange={(e) => setUnit({ ...unit, code: e.target.value })} placeholder="Código" /><input value={unit.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} placeholder="Nueva unidad" /><button className="primary" onClick={createUnit}>Agregar</button></div></div>
    <div><h3>Categorías</h3>{data.categories.map((x) => <div className="catalog" key={x.id}><input value={x.name || ''} onChange={(e) => update('categories', x, { name: e.target.value })} /><select value={x.businessUnitId} onChange={(e) => update('categories', x, { businessUnitId: Number(e.target.value) })}>{data.businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button className="danger" onClick={() => remove('categories', x)}>Eliminar</button></div>)}<div className="inline-form"><input value={category.name} onChange={(e) => setCategory({ ...category, name: e.target.value })} placeholder="Nueva categoría" /><select value={category.businessUnitId} onChange={(e) => setCategory({ ...category, businessUnitId: e.target.value })}>{data.businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button className="primary" onClick={createCategory}>Agregar</button></div></div>
    <div><h3>Subcategorías</h3>{data.subcategories.map((x) => <div className="catalog" key={x.id}><input value={x.name || ''} onChange={(e) => update('subcategories', x, { name: e.target.value })} /><select value={x.categoryId} onChange={(e) => update('subcategories', x, { categoryId: Number(e.target.value) })}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="danger" onClick={() => remove('subcategories', x)}>Eliminar</button></div>)}<div className="inline-form"><input value={subcategory.name} onChange={(e) => setSubcategory({ ...subcategory, name: e.target.value })} placeholder="Nueva subcategoría" /><select value={subcategory.categoryId} onChange={(e) => setSubcategory({ ...subcategory, categoryId: e.target.value })}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="primary" onClick={createSubcategory}>Agregar</button></div></div>
  </div>;
}

function AdminTechnicalSummary({ data }) {
  const rows = [
    ['Usuarios', data.users.length],
    ['Roles', data.roles.length],
    ['Permisos', data.permissionCatalog.length],
    ['Unidades', data.businessUnits.length],
    ['Categorías', data.categories.length],
    ['Subcategorías', data.subcategories.length],
    ['Workflows', data.workflows.length],
    ['Etapas configurables', data.stages.length],
    ['Transiciones', data.transitions.length],
    ['Formularios', data.forms.length],
    ['Plantillas checklist', data.checklistTemplates.length],
    ['Plantillas documentos', data.documentTemplates.length]
  ];
  return <div className="architecture-grid">{rows.map(([label, value]) => <Meta key={label} label={label} value={value} />)}</div>;
}

function Architecture({ data }) {
  const items = [
    ['Aplicación', 'Frontend, backend, datos, uploads y documentación'],
    ['Brief', 'Registro inicial de solicitud, necesidad y oportunidad'],
    ['Analista de Producto', 'Análisis de mercado, costeo, riesgos y recomendación'],
    ['Checklist', 'Ítems por etapa, obligatorios/opcionales y trazabilidad en timeline'],
    ['Documentación', 'Plantillas esperadas por etapa, estados, comentarios, preview y versiones'],
    ['Aprobaciones', 'Solicitudes pendientes, aprobar/rechazar y bloqueo de avance'],
    ['Decisiones', 'Registro no editable de decisiones del proceso'],
    ['Calendario', 'Vista mensual, semanal, por proyecto, por unidad y Gantt simple'],
    ['Marketing operativo', 'Tablero de tareas por canal, vencimientos, responsables, bloqueos y estado'],
    ['Notificaciones reales', 'Centro leído/no leído con alertas de tareas, documentos, aprobaciones y vencimientos'],
    ['Dashboard gerencial', 'KPIs para jefes/dueños: SLA, proyectos vencidos, lanzamientos, carga y bloqueos']
  ];
  return <div className="stack">
    <section className="card"><CardTitle title="Configuración técnica" text="Resumen de componentes funcionales disponibles." /><div className="architecture-grid">{items.map(([title, text]) => <div key={title} className="architecture-item"><b>{title}</b><span>{text}</span></div>)}</div></section>
    <section className="card"><CardTitle title="Funcionalidades disponibles" text="Documentos, calendario, notificaciones y seguimiento gerencial disponibles para operación." /><div className="checklist">{['Documentos por proyecto', 'Documentos por etapa', 'Estados documentales', 'Vista previa', 'Historial de versiones', 'Comentarios por archivo', 'Calendario mensual', 'Vista semanal', 'Filtros por proyecto/unidad/responsable', 'Gantt simple', 'Notificaciones leído/no leído', 'Dashboard gerencial'].map((item) => <span key={item}><CheckCircle2 size={18} />{item}</span>)}</div></section>
  </div>;
}

function ProjectModal({ data, close, created }) {
  const workflow = data.workflows.find((item) => item.active) || data.workflows[0];
  const workflowStages = data.stages.filter((stage) => workflow?.stageIds?.includes(stage.id)).sort((a, b) => a.order - b.order);
  const defaultAssignee = (roleId) => data.users.find((user) => user.roleId === roleId && user.active)?.id || data.users[0]?.id;
  const [form, setForm] = useState({ name: '', businessUnitId: data.businessUnits[0]?.id, categoryId: data.categories[0]?.id, subcategoryId: data.subcategories[0]?.id, responsibleUserId: data.users.find((u) => u.roleId === 'role_jefe')?.id || data.users[0]?.id, targetDate: '', priority: 'Media', workflowId: workflow?.id || 1 });
  const [stageAssignments, setStageAssignments] = useState(() => Object.fromEntries(workflowStages.map((stage) => [stage.id, defaultAssignee(stage.responsibleRoleId)])));
  async function create() {
    const project = await api.post('/projects', { ...form, stageAssignments });
    created(project);
  }
  const categories = data.categories.filter((c) => c.businessUnitId === Number(form.businessUnitId));
  const subcategories = data.subcategories.filter((s) => s.categoryId === Number(form.categoryId));
  return <div className="modal-backdrop"><section className="modal wide-modal"><button className="modal-close" onClick={close}><X size={18} /></button>
    <CardTitle title="Nuevo proyecto" text="Al guardar, el sistema crea todas las etapas del proceso y asigna automáticamente cada tarea al responsable definido. Podés ajustar responsables antes de crear." />
    <div className="formgrid">
      <label className="wide">Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Unidad<select value={form.businessUnitId} onChange={(e) => { const unitId = Number(e.target.value); const catId = data.categories.find((c) => c.businessUnitId === unitId)?.id; const subId = data.subcategories.find((s) => s.categoryId === catId)?.id; setForm({ ...form, businessUnitId: unitId, categoryId: catId, subcategoryId: subId }); }}>{data.businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label>Categoría<select value={form.categoryId} onChange={(e) => { const catId = Number(e.target.value); setForm({ ...form, categoryId: catId, subcategoryId: data.subcategories.find((s) => s.categoryId === catId)?.id }); }}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Subcategoría<select value={form.subcategoryId} onChange={(e) => setForm({ ...form, subcategoryId: Number(e.target.value) })}>{subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Responsable general<select value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: Number(e.target.value) })}>{data.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label>Fecha objetivo<input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} /></label>
      <label>Prioridad<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>Alta</option><option>Media</option><option>Baja</option></select></label>
    </div>
    <details open className="assignment-editor"><summary>Responsables por etapa</summary>
      <div className="assignment-list">{workflowStages.map((stage) => <div className="assignment-row" key={stage.id}>
        <div><b>{stage.order}. {stage.name}</b><small>{stage.phase} · rol sugerido: {data.roles.find((role) => role.id === stage.responsibleRoleId)?.name} · SLA {stage.slaDays} días</small></div>
        <select value={stageAssignments[stage.id] || ''} onChange={(e) => setStageAssignments({ ...stageAssignments, [stage.id]: Number(e.target.value) })}>{data.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name} · {data.roles.find((role) => role.id === user.roleId)?.name}</option>)}</select>
      </div>)}</div>
    </details>
    <div className="buttons"><button className="primary" onClick={create}><Save size={18} />Crear proyecto y asignar tareas</button><button className="ghost" onClick={close}>Cancelar</button></div>
  </section></div>;
}

function NotificationStrip({ notifications, projects, onOpen }) {
  return <div className="alert-strip">{notifications.slice(0, 3).map((n) => <button key={n.id} onClick={() => onOpen(n)} className={n.type === 'sla' || n.type === 'approval' ? 'warn' : n.type === 'rejection' ? 'bad' : 'info'}><Bell size={18} /><div><b>{n.title}</b><small>{projects.find((p) => p.id === n.projectId)?.code || 'General'} · {n.message}</small></div></button>)}</div>;
}

function DecisionList({ decisions = [], data }) {
  return <table><tbody>{decisions.map((item) => {
    const project = data.projects.find((p) => p.id === item.projectId);
    const user = data.users.find((u) => u.id === item.byUserId);
    return <tr key={item.id}><td><b>{item.title}</b><small>{item.code} · {project?.code || '-'} · {user?.name || 'Sistema'}</small></td><td><span className={`pill ${item.decision === 'Aprobado' ? 'ok' : item.decision === 'Rechazado' ? 'bad' : 'warn'}`}>{item.decision}</span></td><td>{item.rationale}</td></tr>;
  })}{decisions.length === 0 && <tr><td>No hay decisiones registradas.</td></tr>}</tbody></table>;
}

function Timeline({ items = [] }) {
  return <div className="timeline">{items.map((item) => <div key={item.id}><span /><p><b>{item.title}</b><br /><small>{new Date(item.createdAt).toLocaleString('es-AR')} · {item.by || 'Sistema'} · {item.detail}</small></p></div>)}{items.length === 0 && <small>Sin eventos todavía.</small>}</div>;
}

function CardTitle({ title, text }) { return <div className="ct"><h3>{title}</h3>{text && <p>{text}</p>}</div>; }
function Kpi({ label, value, icon, danger }) { return <div className={danger ? 'kpi danger' : 'kpi'}><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>; }
function Meta({ label, value }) { return <div className="meta"><small>{label}</small><b>{value ?? '-'}</b></div>; }
function Empty({ title, text }) { return <section className="card empty"><h3>{title}</h3><p>{text}</p></section>; }

createRoot(document.getElementById('root')).render(<App />);
