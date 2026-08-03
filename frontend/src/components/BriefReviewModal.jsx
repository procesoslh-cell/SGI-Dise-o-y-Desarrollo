import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import Modal from './Modal.jsx';
import StatusBadge from './StatusBadge.jsx';
import { api } from '../api/client.js';

const fields = [
  ['descripcionCorta', 'Descripción corta'],
  ['publicoObjetivo', '¿Para quién está diseñada o pensada?'],
  ['competencia', 'Bicicletas o productos con los que compite'],
  ['diferenciaCompetencia', 'Diferencial y posicionamiento frente a la competencia'],
  ['diferenciaTopmega', 'Diferencias frente a otros modelos TOPMEGA'],
  ['atributoUnico', '¿Qué hace único al producto?'],
  ['restylingMejoras', 'Mejoras del restyling'],
  ['nuevoModeloMotivo', 'Motivo y necesidad que resuelve el nuevo modelo'],
  ['atributosPrincipales', 'Tres atributos principales'],
  ['otrosDetalles', 'Otros detalles']
];

export default function BriefReviewModal({ project, onClose, reload }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function review(decision) {
    setSaving(true); setError('');
    try {
      await api.post(`/projects/${project.id}/brief/review`, { decision, comment });
      await reload();
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return <Modal open title={`Validar brief · ${project.name}`} subtitle={project.code} onClose={onClose} wide>
    <div className="brief-review-header"><StatusBadge status={project.brief?.status || 'Borrador'} /></div>
    <div className="brief-review-grid">
      {fields.map(([key, label]) => <article key={key}><b>{label}</b><p>{project.brief?.[key] || 'Sin completar'}</p></article>)}
    </div>
    <label>Comentario de Marketing<textarea rows="4" value={comment} onChange={(e) => setComment(e.target.value)} /></label>
    {error && <div className="form-error">{error}</div>}
    <div className="button-row end">
      <button className="button danger" disabled={saving} onClick={() => review('Observado')}><ThumbsDown size={17} />Observar</button>
      <button className="button success" disabled={saving} onClick={() => review('Aprobado')}><ThumbsUp size={17} />Aprobar brief</button>
    </div>
  </Modal>;
}
