import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Layers3, Megaphone, Plus, Save, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import ProgressBar from '../../components/ProgressBar.jsx';
import { api } from '../../api/client.js';
import { addDays, formatDate, isoToday } from '../../utils/dates.js';

export default function MarketingPlan({ project, data, reload, openTask }) {
  const [plan, setPlan] = useState(project.launchPlan || {});
  const [adding, setAdding] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setPlan(project.launchPlan || {}), [project.id, project.launchPlan?.updatedAt]);

  async function savePlan() {
    setMessage('');
    try {
      await api.put(`/projects/${project.id}/launch-plan`, plan);
      await reload();
      setMessage('Plan de Marketing guardado.');
    } catch (error) { setMessage(error.message); }
  }

  async function removeTask(id) {
    if (!window.confirm('¿Eliminar esta tarea del Plan de Marketing?')) return;
    await api.delete(`/marketing-tasks/${id}`);
    await reload();
  }

  return <div className="project-submodule">
    <div className="submodule-header">
      <div><h3>Plan de Marketing</h3><p>Planificá las tareas del lanzamiento. Cada asignación genera una alerta interna y un correo al responsable.</p></div>
      <div className="button-row">
        <button className="button secondary" onClick={() => setLoadingTemplate(true)}><Layers3 size={17} />Cargar plan modelo</button>
        <button className="button primary" onClick={() => setAdding(true)}><Plus size={17} />Asignar tarea</button>
      </div>
    </div>
    <div className="form-grid three">
      <label>Primera producción estimada<input type="date" value={plan.firstProductionDate || ''} onChange={(e) => setPlan({ ...plan, firstProductionDate: e.target.value })} /></label>
      <label>Disponibilidad para fotos<input type="date" value={plan.photoAvailabilityDate || ''} onChange={(e) => setPlan({ ...plan, photoAvailabilityDate: e.target.value })} /></label>
      <label>Lanzamiento objetivo<input type="date" value={plan.targetLaunchDate || project.targetDate || ''} onChange={(e) => setPlan({ ...plan, targetLaunchDate: e.target.value })} /></label>
      <label className="span-2">Mensaje principal<textarea rows="3" value={plan.mainMessage || ''} onChange={(e) => setPlan({ ...plan, mainMessage: e.target.value })} /></label>
      <label>Responsable general<select value={plan.marketingOwnerUserId || ''} onChange={(e) => setPlan({ ...plan, marketingOwnerUserId: Number(e.target.value) })}><option value="">Seleccionar...</option>{data.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name} · {data.roles.find((role) => role.id === user.roleId)?.name}</option>)}</select></label>
      <label className="span-3">Observaciones del plan<textarea rows="3" value={plan.notes || ''} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} /></label>
    </div>
    <div className="button-row end"><button className="button secondary" onClick={savePlan}><Save size={17} />Guardar plan</button></div>
    {message && <div className={message.includes('guardado') ? 'form-success' : 'form-error'}>{message}</div>}

    <div className="marketing-plan-summary">
      <span><CalendarRange size={17} /><b>{project.marketingTasks.length}</b> tareas planificadas</span>
      <span><b>{project.marketingTasks.filter((task) => task.status === 'Completo').length}</b> completas</span>
      <span><b>{project.marketingTasks.filter((task) => task.status === 'Pendiente validación').length}</b> para validar</span>
    </div>

    <div className="marketing-task-grid">
      {project.marketingTasks.length === 0 ? <div className="empty-state">Todavía no se asignaron tareas. Podés cargar el plan modelo con las 13 tareas definidas o crear una tarea individual.</div> : project.marketingTasks.map((task) => <article key={task.id}>
        <div className="marketing-task-head"><span className="task-type marketing"><Megaphone size={18} /></span><div><b>{task.title}</b><small>{task.area || task.channel} · {task.owner?.name || 'Sin responsable'}</small></div><StatusBadge status={task.status} /></div>
        <p>{task.notes || 'Sin observaciones.'}</p>
        <div className="date-range-label">{formatDate(task.startDate)} → {formatDate(task.dueDate)} · {task.durationDays || 1} día(s)</div>
        <ProgressBar value={task.progressPercent} label="Avance" />
        <div className="button-row"><button className="button secondary small" onClick={() => openTask({ kind: 'marketing', task, project })}>Abrir tarea</button><button className="icon-button danger-text" onClick={() => removeTask(task.id)}><Trash2 size={17} /></button></div>
      </article>)}
    </div>
    <MarketingTaskModal open={adding} project={project} data={data} onClose={() => setAdding(false)} reload={reload} />
    <MarketingPlanTemplateModal open={loadingTemplate} project={project} data={data} onClose={() => setLoadingTemplate(false)} reload={reload} />
  </div>;
}

function MarketingTaskModal({ open, project, data, onClose, reload }) {
  const templates = data.marketingTaskTemplates || [];
  const activeUsers = data.users.filter((user) => user.active);
  const firstTemplate = templates[0];
  const defaultOwner = suggestOwner(firstTemplate, data, project);
  const [form, setForm] = useState(() => initialTaskForm(firstTemplate, defaultOwner));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const template = templates[0];
    setForm(initialTaskForm(template, suggestOwner(template, data, project)));
    setError('');
  }, [open, project.id]);

  function chooseTemplate(value) {
    const template = templates.find((item) => item.id === Number(value));
    if (!template) return setForm({ ...form, templateId: '', title: '', area: 'Marketing', durationDays: 1, dueDate: form.startDate });
    const durationDays = Number(template.durationDays || 1);
    setForm({
      ...form,
      templateId: template.id,
      title: template.title,
      area: template.area,
      channel: template.area,
      durationDays,
      dueDate: addDays(form.startDate, durationDays - 1),
      ownerUserId: suggestOwner(template, data, project) || form.ownerUserId
    });
  }

  function updateStart(startDate) {
    setForm({ ...form, startDate, dueDate: addDays(startDate, Number(form.durationDays || 1) - 1) });
  }

  async function submit() {
    setError('');
    if (!form.title || !form.ownerUserId || !form.startDate || !form.dueDate) return setError('Completá tarea, responsable y fechas.');
    try {
      await api.post(`/projects/${project.id}/marketing-tasks`, { ...form, ownerUserId: Number(form.ownerUserId), templateId: form.templateId ? Number(form.templateId) : null });
      await reload();
      onClose();
    } catch (error) { setError(error.message); }
  }

  return <Modal open={open} title="Asignar tarea del Plan de Marketing" subtitle={project.name} onClose={onClose}>
    <div className="form-grid">
      <label className="span-2">Plantilla<select value={form.templateId || ''} onChange={(e) => chooseTemplate(e.target.value)}><option value="">Tarea personalizada</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.code} · {template.title}</option>)}</select></label>
      <label className="span-2">Tarea<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>Área<input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value, channel: e.target.value })} /></label>
      <label>Responsable<select value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}><option value="">Seleccionar...</option>{activeUsers.map((user) => <option key={user.id} value={user.id}>{user.name} · {data.roles.find((role) => role.id === user.roleId)?.name}</option>)}</select></label>
      <label>Inicio<input type="date" value={form.startDate} onChange={(e) => updateStart(e.target.value)} /></label>
      <label>Duración (días)<input type="number" min="1" value={form.durationDays} onChange={(e) => { const durationDays = Math.max(1, Number(e.target.value)); setForm({ ...form, durationDays, dueDate: addDays(form.startDate, durationDays - 1) }); }} /></label>
      <label>Fin<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
      <label>Prioridad<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>Alta</option><option>Media</option><option>Baja</option></select></label>
      <label className="span-2">Instrucciones y entregable esperado<textarea rows="4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
    </div>
    <div className="mail-notice">Al crearla, el responsable recibirá una alerta dentro del sistema y un correo electrónico si SMTP está configurado.</div>
    {error && <div className="form-error">{error}</div>}
    <div className="button-row end"><button className="button primary" onClick={submit}><Plus size={17} />Crear y notificar</button></div>
  </Modal>;
}

function MarketingPlanTemplateModal({ open, project, data, onClose, reload }) {
  const templates = data.marketingTaskTemplates || [];
  const activeUsers = data.users.filter((user) => user.active);
  const defaultStart = project.launchPlan?.photoAvailabilityDate || project.startDate || isoToday();
  const [baseDate, setBaseDate] = useState(defaultStart);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const existingTemplateIds = useMemo(() => new Set(project.marketingTasks.map((task) => Number(task.templateId)).filter(Boolean)), [project.marketingTasks]);

  useEffect(() => {
    if (!open) return;
    const start = project.launchPlan?.photoAvailabilityDate || project.startDate || isoToday();
    setBaseDate(start);
    setRows(buildTemplateRows(templates, data, project, start, existingTemplateIds));
    setError('');
  }, [open, project.id, project.marketingTasks.length]);

  function recalculate(start) {
    setBaseDate(start);
    const owners = Object.fromEntries(rows.map((row) => [row.templateId, row.ownerUserId]));
    setRows(buildTemplateRows(templates, data, project, start, existingTemplateIds).map((row) => ({ ...row, ownerUserId: owners[row.templateId] || row.ownerUserId })));
  }

  function updateRow(templateId, changes) {
    setRows((current) => current.map((row) => row.templateId === templateId ? { ...row, ...changes } : row));
  }

  async function submit() {
    setError('');
    const pending = rows.filter((row) => !row.exists);
    if (!pending.length) return setError('Las 13 tareas del plan modelo ya están cargadas.');
    if (pending.some((row) => !row.ownerUserId)) return setError('Asigná un responsable a todas las tareas nuevas.');
    try {
      const result = await api.post(`/projects/${project.id}/marketing-tasks/bulk`, { tasks: pending.map((row) => ({ ...row, ownerUserId: Number(row.ownerUserId) })) });
      await reload();
      onClose();
      window.alert(`Plan cargado: ${result.created} tareas creadas${result.skipped ? ` y ${result.skipped} omitidas porque ya existían` : ''}.`);
    } catch (error) { setError(error.message); }
  }

  return <Modal open={open} title="Cargar plan modelo de Marketing" subtitle="13 tareas definidas para el lanzamiento" onClose={onClose} wide>
    <div className="template-plan-toolbar">
      <label>Inicio del plan<input type="date" value={baseDate} onChange={(e) => recalculate(e.target.value)} /></label>
      <p>Las fechas se calculan de forma consecutiva según la duración definida. Después pueden reprogramarse desde cada tarea.</p>
    </div>
    <div className="marketing-template-table">
      <div className="marketing-template-head"><span>Tarea</span><span>Área</span><span>Duración</span><span>Inicio</span><span>Fin</span><span>Responsable</span></div>
      {rows.map((row) => <div key={row.templateId} className={row.exists ? 'template-existing' : ''}>
        <span><b>{row.title}</b>{row.exists && <small>Ya cargada</small>}</span>
        <span>{row.area}</span>
        <span>{row.durationDays} día(s)</span>
        <span><input type="date" disabled={row.exists} value={row.startDate} onChange={(e) => updateRow(row.templateId, { startDate: e.target.value, dueDate: addDays(e.target.value, row.durationDays - 1) })} /></span>
        <span><input type="date" disabled={row.exists} value={row.dueDate} onChange={(e) => updateRow(row.templateId, { dueDate: e.target.value })} /></span>
        <span><select disabled={row.exists} value={row.ownerUserId || ''} onChange={(e) => updateRow(row.templateId, { ownerUserId: e.target.value })}><option value="">Seleccionar...</option>{activeUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></span>
      </div>)}
    </div>
    <div className="mail-notice">Cada tarea nueva enviará una alerta interna y un correo al usuario asignado.</div>
    {error && <div className="form-error">{error}</div>}
    <div className="button-row end"><button className="button primary" onClick={submit}><Layers3 size={17} />Crear tareas y notificar</button></div>
  </Modal>;
}

function initialTaskForm(template, ownerUserId) {
  const startDate = isoToday();
  const durationDays = Number(template?.durationDays || 1);
  return {
    templateId: template?.id || '',
    title: template?.title || '',
    area: template?.area || 'Marketing',
    channel: template?.area || 'Marketing',
    priority: 'Media',
    startDate,
    dueDate: addDays(startDate, durationDays - 1),
    durationDays,
    ownerUserId: ownerUserId || '',
    notes: ''
  };
}

function buildTemplateRows(templates, data, project, startDate, existingTemplateIds) {
  let cursor = startDate;
  return templates.map((template) => {
    const durationDays = Number(template.durationDays || 1);
    const row = {
      templateId: template.id,
      title: template.title,
      area: template.area,
      channel: template.area,
      durationDays,
      priority: 'Media',
      startDate: cursor,
      dueDate: addDays(cursor, durationDays - 1),
      ownerUserId: suggestOwner(template, data, project) || '',
      notes: '',
      exists: existingTemplateIds.has(Number(template.id))
    };
    cursor = addDays(row.dueDate, 1);
    return row;
  });
}

function suggestOwner(template, data, project) {
  if (!template) return data.users.find((user) => user.roleId === 'role_marketing' && user.active)?.id || '';
  const area = template.area || '';
  const roleOrder = area.includes('RRHH') ? ['role_rrhh', 'role_marketing']
    : area.includes('Audiovisual') ? ['role_audiovisual', 'role_marketing']
      : area.includes('Diseño') ? ['role_diseno', 'role_marketing']
        : area.includes('Comercial') ? ['role_comercial', 'role_marketing']
          : area.includes('Producto') ? [data.users.find((user) => user.id === project.responsibleUserId)?.roleId, 'role_marketing']
            : ['role_marketing'];
  for (const roleId of roleOrder) {
    const user = data.users.find((item) => item.roleId === roleId && item.active);
    if (user) return user.id;
  }
  return data.users.find((user) => user.active)?.id || '';
}
