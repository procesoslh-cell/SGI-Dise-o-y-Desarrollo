import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileUp, Save, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import Modal from './Modal.jsx';
import StatusBadge from './StatusBadge.jsx';
import ProgressBar from './ProgressBar.jsx';
import { api } from '../api/client.js';
import { formatDate, formatDateTime, slaInfo } from '../utils/dates.js';

function Field({ field, value, disabled, onChange }) {
  const common = { value: value ?? '', disabled, onChange: (event) => onChange(field.key, event.target.value) };
  if (field.type === 'textarea') return <textarea rows="4" {...common} />;
  if (field.type === 'select') return <select {...common}><option value="">Seleccionar...</option>{(field.options || []).map((option) => <option key={option}>{option}</option>)}</select>;
  return <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} {...common} />;
}

export default function TaskModal({ item, data, onClose, reload, defaultMode = 'execute' }) {
  const [formData, setFormData] = useState({});
  const [progressPercent, setProgressPercent] = useState(0);
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [schedule, setSchedule] = useState({});

  const task = item?.task;
  const project = item?.project;
  const kind = item?.kind;
  const approval = item?.approval || task?.pendingApproval;
  const validating = defaultMode === 'validate' || Boolean(item?.approval);
  const isLead = data?.user?.role?.code === 'ADMIN' || project?.responsibleUserId === data?.user?.id;
  const isAssignee = kind === 'stage' ? task?.assignedUserId === data?.user?.id : task?.ownerUserId === data?.user?.id;
  const canExecute = isLead || isAssignee || data?.user?.role?.code === 'ADMIN';
  const form = task?.form || { fields: [] };
  const currentData = kind === 'stage' ? task?.formData : task?.templateData;

  useEffect(() => {
    setFormData(currentData || {});
    setProgressPercent(Number(task?.progressPercent || 0));
    setSchedule({
      assignedUserId: kind === 'stage' ? task?.assignedUserId : task?.ownerUserId,
      startDate: task?.startDate || '',
      dueDate: task?.dueDate || '',
      slaDays: task?.slaDays || ''
    });
    setMessage('');
  }, [item]);

  const sla = slaInfo(task?.dueDate);
  const progressHistory = task?.progressUpdates || [];
  const documents = task?.documents || [];
  const missingRequired = useMemo(() => (form.fields || []).filter((field) => field.required && !String(formData?.[field.key] || '').trim()), [form, formData]);

  if (!item || !task) return null;

  async function run(action) {
    setSaving(true);
    setMessage('');
    try {
      await action();
      await reload();
      onClose();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function saveProgress() {
    return run(() => kind === 'stage'
      ? api.post(`/project-stages/${task.id}/progress`, { formData, progressPercent, note })
      : api.post(`/marketing-tasks/${task.id}/progress`, { templateData: formData, progressPercent, note }));
  }

  function submitValidation() {
    if (missingRequired.length) {
      setMessage(`Falta completar: ${missingRequired.map((field) => field.label).join(', ')}.`);
      return;
    }
    return run(async () => {
      if (kind === 'stage') {
        await api.put(`/project-stages/${task.id}`, { formData, progressPercent: Math.max(progressPercent, 95), status: 'En curso' });
        await api.post(`/project-stages/${task.id}/approval/request`, { comment });
      } else {
        await api.put(`/marketing-tasks/${task.id}`, { templateData: formData, progressPercent: Math.max(progressPercent, 95), status: 'En curso' });
        await api.post(`/marketing-tasks/${task.id}/approval/request`, { comment });
      }
    });
  }

  function resolve(decision) {
    if (!approval) return;
    return run(() => api.post(`/approvals/${approval.id}/${decision}`, { comment }));
  }

  function saveSchedule() {
    return run(() => kind === 'stage'
      ? api.put(`/project-stages/${task.id}`, schedule)
      : api.put(`/marketing-tasks/${task.id}`, {
          ownerUserId: schedule.assignedUserId,
          startDate: schedule.startDate,
          dueDate: schedule.dueDate
        }));
  }

  function upload() {
    if (!file) return setMessage('Seleccioná un archivo.');
    return run(() => api.upload(kind === 'stage' ? 'stage' : 'marketing', task.id, file, kind === 'stage' && task.documentTemplate ? { templateId: task.documentTemplate.id } : {}));
  }

  return <Modal open title={task.name || task.title} subtitle={`${project.code} · ${project.name}`} onClose={onClose} wide>
    <div className="task-modal-grid">
      <section className="task-main">
        <div className="task-summary-row">
          <StatusBadge status={task.status} />
          <span className={`sla-pill ${sla.tone}`}><Clock3 size={15} />{sla.label}</span>
          <span>{formatDate(task.startDate)} → {formatDate(task.dueDate)}</span>
        </div>
        <ProgressBar value={progressPercent} label="Avance informado" />

        {isLead && !validating && <details className="details-card">
          <summary>Responsable y planificación</summary>
          <div className="form-grid three">
            <label>Responsable<select value={schedule.assignedUserId || ''} onChange={(e) => setSchedule({ ...schedule, assignedUserId: e.target.value })}>
              <option value="">Seleccionar...</option>{data.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select></label>
            <label>Inicio<input type="date" value={schedule.startDate || ''} onChange={(e) => setSchedule({ ...schedule, startDate: e.target.value })} /></label>
            <label>Vencimiento<input type="date" value={schedule.dueDate || ''} onChange={(e) => setSchedule({ ...schedule, dueDate: e.target.value })} /></label>
          </div>
          <button className="button secondary" disabled={saving} onClick={saveSchedule}><Save size={16} />Guardar planificación</button>
        </details>}

        <div className="section-heading">
          <div><h4>Plantilla de la tarea</h4><p>{form.description}</p></div>
        </div>
        <div className="form-grid">
          {(form.fields || []).map((field) => <label key={field.key} className={field.type === 'textarea' ? 'span-2' : ''}>
            {field.label}{field.required && <em>*</em>}
            <Field field={field} value={formData[field.key]} disabled={validating || !canExecute || task.status === 'Completa'} onChange={(key, value) => setFormData((current) => ({ ...current, [key]: value }))} />
          </label>)}
        </div>

        {!validating && canExecute && task.status !== 'Completa' && <div className="progress-entry">
          <label>Porcentaje de avance<input type="range" min="0" max="99" value={progressPercent} onChange={(e) => setProgressPercent(e.target.value)} /><b>{progressPercent}%</b></label>
          <label>Comentario del avance<textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: se relevaron 3 competidores; falta validar precios." /></label>
          <button className="button secondary" disabled={saving} onClick={saveProgress}><Save size={17} />Guardar avance</button>
        </div>}

        {kind === 'stage' && task.checklist?.length > 0 && <div className="checklist-block">
          <h4>Checklist</h4>
          {task.checklist.map((check) => <label className="check-row" key={check.id}>
            <input type="checkbox" checked={Boolean(check.done)} disabled={validating || !canExecute || task.status === 'Completa'} onChange={() => run(() => api.put(`/checklist-items/${check.id}/toggle`, { done: !check.done }))} />
            <span>{check.label}{check.required && <em> obligatorio</em>}</span>
          </label>)}
        </div>}

        <div className="attachment-block">
          <h4>Entregables adjuntos</h4>
          {documents.length === 0 ? <p className="empty-text">Todavía no se adjuntaron archivos.</p> : <div className="document-list">{documents.map((document) => <a key={document.id} href={document.url || '#'} target="_blank" rel="noreferrer">{document.name}<span>v{document.versionNumber} · {document.status}</span></a>)}</div>}
          {!validating && canExecute && task.status !== 'Completa' && <div className="file-row"><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /><button className="button secondary" onClick={upload}><FileUp size={17} />Adjuntar</button></div>}
        </div>

        {(validating || task.status === 'Pendiente validación') && <div className="validation-panel">
          <h4>Validación del jefe del proyecto</h4>
          <label>Comentario<textarea rows="3" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Detalle de aprobación u observaciones." /></label>
          {validating && approval ? <div className="button-row">
            <button className="button danger" disabled={saving} onClick={() => resolve('reject')}><ThumbsDown size={17} />Observar y devolver</button>
            <button className="button success" disabled={saving} onClick={() => resolve('approve')}><ThumbsUp size={17} />Aprobar tarea</button>
          </div> : !validating && canExecute && <button className="button primary" disabled={saving} onClick={submitValidation}><Send size={17} />Enviar a validación</button>}
        </div>}
        {!validating && canExecute && task.status !== 'Completa' && task.status !== 'Pendiente validación' && <div className="submit-row">
          <label>Mensaje para el jefe del proyecto<input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Resumen final para validar" /></label>
          <button className="button primary" disabled={saving} onClick={submitValidation}><Send size={17} />Enviar a validación</button>
        </div>}
        {message && <div className="form-error">{message}</div>}
      </section>

      <aside className="task-history">
        <h4>Historial de avances</h4>
        {progressHistory.length === 0 ? <p className="empty-text">Sin avances guardados todavía.</p> : progressHistory.map((progress) => <article key={progress.id}>
          <div><CheckCircle2 size={16} /><b>{progress.progressPercent}%</b><span>{formatDateTime(progress.createdAt)}</span></div>
          <p>{progress.note}</p><small>{progress.byUser}</small>
        </article>)}
        {task.approvals?.filter((entry) => entry.status !== 'Pendiente').map((entry) => <article key={`approval-${entry.id}`}>
          <div><b>{entry.status}</b><span>{formatDateTime(entry.resolvedAt)}</span></div>
          <p>{entry.resolutionComment || 'Sin comentario.'}</p>
        </article>)}
      </aside>
    </div>
  </Modal>;
}
