import { useEffect, useState } from 'react';
import { Save, Send } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import { api } from '../../api/client.js';

const questions = [
  ['descripcionCorta', '¿Cómo describirías a esta bicicleta o producto en un párrafo corto?'],
  ['publicoObjetivo', '¿Para quién está diseñada o pensada?'],
  ['competencia', '¿Con qué otras bicicletas o productos compite? Detallar modelos.'],
  ['diferenciaCompetencia', '¿Qué la diferencia de su competencia y cuál es el objetivo de posicionamiento?'],
  ['diferenciaTopmega', '¿Qué la diferencia de otros modelos similares de TOPMEGA?'],
  ['atributoUnico', '¿Hay algo que haga que este producto sea único?'],
  ['restylingMejoras', 'Si es un restyling, ¿qué se mejoró o modificó y por qué?'],
  ['nuevoModeloMotivo', 'Si es un nuevo modelo, ¿por qué se decidió crearlo y qué necesidad resuelve?'],
  ['atributosPrincipales', '¿Cuáles son los tres atributos principales? Ordenarlos del más importante al menos importante.'],
  ['otrosDetalles', '¿Qué otros detalles quieren sumar?']
];

export default function ProjectBrief({ project, data, reload }) {
  const [form, setForm] = useState(project.brief || {});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const marketingUsers = data.users.filter((user) => user.roleId === 'role_marketing' && user.active);

  useEffect(() => setForm(project.brief || {}), [project.id, project.brief?.updatedAt, project.brief?.status]);

  async function act(submit) {
    setSaving(true); setMessage('');
    try {
      const payload = { ...form, marketingReviewerUserId: form.marketingReviewerUserId ? Number(form.marketingReviewerUserId) : null };
      if (submit) await api.post(`/projects/${project.id}/brief/submit`, payload);
      else await api.put(`/projects/${project.id}/brief`, { ...payload, status: 'Borrador' });
      await reload();
      setMessage(submit ? 'Brief enviado a validación de Marketing.' : 'Avance del brief guardado.');
    } catch (error) { setMessage(error.message); } finally { setSaving(false); }
  }

  return <div className="project-submodule">
    <div className="submodule-header">
      <div><h3>Brief de producto</h3><p>Se puede guardar tantas veces como sea necesario antes de enviarlo a Marketing.</p></div>
      <StatusBadge status={project.brief?.status || 'Borrador'} />
    </div>
    <div className="form-grid">
      <label>Responsable de validación en Marketing<select value={form.marketingReviewerUserId || ''} onChange={(e) => setForm({ ...form, marketingReviewerUserId: e.target.value })}><option value="">Seleccionar...</option>{marketingUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label>Tipo de desarrollo<select value={form.tipoDesarrollo || ''} onChange={(e) => setForm({ ...form, tipoDesarrollo: e.target.value })}><option value="">Seleccionar...</option><option>Nuevo modelo</option><option>Restyling</option><option>Extensión de línea</option></select></label>
      {questions.map(([key, label]) => <label key={key} className="span-2">{label}<textarea rows="4" value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
    </div>
    {project.brief?.reviewComment && <div className="review-note"><b>Comentario de Marketing:</b> {project.brief.reviewComment}</div>}
    {message && <div className={message.includes('guardado') || message.includes('enviado') ? 'form-success' : 'form-error'}>{message}</div>}
    <div className="button-row end">
      <button className="button secondary" disabled={saving} onClick={() => act(false)}><Save size={17} />Guardar avance</button>
      <button className="button primary" disabled={saving || !form.marketingReviewerUserId} onClick={() => act(true)}><Send size={17} />Enviar a validación</button>
    </div>
  </div>;
}
