import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import { api } from '../../api/client.js';
import { addDays, isoToday } from '../../utils/dates.js';

const exclusiveStages = [
  'Armado de carpeta de diseño con LMAT inicial',
  'Llegada y armado de prototipo',
  'LMAT final con lista de sustitutos',
  'Producción inicial'
];

export default function CreateProjectModal({ open, data, onClose, reload }) {
  const [form, setForm] = useState({
    name: '', businessUnitId: '', segmentId: '', categoryId: '', subcategoryId: '',
    responsibleUserId: data.user.id, marketingReviewerUserId: '', startDate: isoToday(),
    targetDate: addDays(isoToday(), 120), priority: 'Media', designOrigin: 'Diseño propio'
  });
  const [stageRows, setStageRows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const segments = data.segments.filter((item) => item.businessUnitId === Number(form.businessUnitId));
  const categories = data.categories.filter((item) => item.businessUnitId === Number(form.businessUnitId) && item.segmentId === Number(form.segmentId));
  const subcategories = data.subcategories.filter((item) => item.categoryId === Number(form.categoryId));
  const marketingUsers = data.users.filter((user) => user.roleId === 'role_marketing' && user.active);

  useEffect(() => {
    if (!open) return;
    const usersByRole = Object.fromEntries(data.users.filter((user) => user.active).map((user) => [user.roleId, user.id]));
    setStageRows(data.stages.slice().sort((a, b) => a.order - b.order).map((stage) => ({
      ...stage,
      selected: true,
      assignedUserId: usersByRole[stage.responsibleRoleId] || data.user.id,
      days: stage.slaDays
    })));
  }, [open]);

  const selectedCategory = useMemo(() => data.categories.find((item) => item.id === Number(form.categoryId)), [form.categoryId, data.categories]);
  const selectedBusiness = useMemo(() => data.businessUnits.find((item) => item.id === Number(form.businessUnitId)), [form.businessUnitId, data.businessUnits]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyRecommendation() {
    const isBike = selectedCategory?.name?.toLowerCase().includes('bicicleta');
    const isMobility = selectedBusiness?.name?.toLowerCase().includes('movilidad');
    const isClothing = selectedCategory?.name?.toLowerCase().includes('indumentaria');
    setStageRows((rows) => rows.map((row) => {
      let selected = row.selected;
      if (!isBike && !isMobility && exclusiveStages.includes(row.name)) selected = false;
      if (isClothing && row.name === 'Producción inicial') selected = false;
      return { ...row, selected };
    }));
  }

  async function submit() {
    setError('');
    const selected = stageRows.filter((row) => row.selected);
    if (!form.name || !form.businessUnitId || !form.segmentId || !form.categoryId || !form.subcategoryId || !form.responsibleUserId) {
      return setError('Completá nombre, clasificación y jefe del proyecto.');
    }
    if (!selected.length) return setError('El proyecto debe conservar al menos una tarea.');
    setSaving(true);
    try {
      const stageAssignments = Object.fromEntries(selected.map((row) => [row.id, Number(row.assignedUserId)]));
      const stageSchedules = Object.fromEntries(selected.map((row) => [row.id, { slaDays: Number(row.days) }]));
      await api.post('/projects', {
        ...form,
        businessUnitId: Number(form.businessUnitId),
        segmentId: Number(form.segmentId),
        categoryId: Number(form.categoryId),
        subcategoryId: Number(form.subcategoryId),
        responsibleUserId: Number(form.responsibleUserId),
        marketingReviewerUserId: form.marketingReviewerUserId ? Number(form.marketingReviewerUserId) : null,
        selectedStageIds: selected.map((row) => row.id),
        stageAssignments,
        stageSchedules
      });
      await reload();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return <Modal open={open} title="Crear proyecto" subtitle="Definí la plantilla, quitá tareas innecesarias y asigná personas concretas." onClose={onClose} wide>
    <div className="form-grid three">
      <label className="span-2">Nombre del proyecto<input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ej.: Bicicleta urbana R29" /></label>
      <label>Prioridad<select value={form.priority} onChange={(e) => update('priority', e.target.value)}><option>Alta</option><option>Media</option><option>Baja</option></select></label>
      <label>Negocio<select value={form.businessUnitId} onChange={(e) => setForm((current) => ({ ...current, businessUnitId: e.target.value, segmentId: '', categoryId: '', subcategoryId: '' }))}><option value="">Seleccionar...</option>{data.businessUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Segmento<select value={form.segmentId} onChange={(e) => setForm((current) => ({ ...current, segmentId: e.target.value, categoryId: '', subcategoryId: '' }))}><option value="">Seleccionar...</option>{segments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Categoría<select value={form.categoryId} onChange={(e) => setForm((current) => ({ ...current, categoryId: e.target.value, subcategoryId: '' }))}><option value="">Seleccionar...</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Subcategoría<select value={form.subcategoryId} onChange={(e) => update('subcategoryId', e.target.value)}><option value="">Seleccionar...</option>{subcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Jefe del proyecto<select value={form.responsibleUserId} onChange={(e) => update('responsibleUserId', e.target.value)}>{data.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label>Responsable Marketing<select value={form.marketingReviewerUserId} onChange={(e) => update('marketingReviewerUserId', e.target.value)}><option value="">Asignar después</option>{marketingUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label>Origen del diseño<select value={form.designOrigin} onChange={(e) => update('designOrigin', e.target.value)}><option>Diseño propio</option><option>Diseño del proveedor</option></select></label>
      <label>Fecha de inicio<input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} /></label>
      <label>Fecha objetivo<input type="date" value={form.targetDate} onChange={(e) => update('targetDate', e.target.value)} /></label>
    </div>

    <div className="template-toolbar">
      <div><h4>Plantilla de tareas</h4><p>{stageRows.filter((row) => row.selected).length} de {stageRows.length} tareas incluidas.</p></div>
      <button className="button secondary" onClick={applyRecommendation}><Sparkles size={17} />Aplicar recomendación por categoría</button>
    </div>
    <div className="stage-template-table">
      <div className="stage-template-head"><span>Incluir</span><span>Etapa / tarea</span><span>Responsable</span><span>Días</span></div>
      {stageRows.map((row) => <div key={row.id} className={!row.selected ? 'disabled-row' : ''}>
        <label className="toggle-cell"><input type="checkbox" checked={row.selected} onChange={() => setStageRows((rows) => rows.map((item) => item.id === row.id ? { ...item, selected: !item.selected } : item))} /></label>
        <span><b>{row.name}</b><small>{row.phase}</small></span>
        <select disabled={!row.selected} value={row.assignedUserId || ''} onChange={(e) => setStageRows((rows) => rows.map((item) => item.id === row.id ? { ...item, assignedUserId: e.target.value } : item))}>
          {data.users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
        <input disabled={!row.selected} type="number" min="1" value={row.days} onChange={(e) => setStageRows((rows) => rows.map((item) => item.id === row.id ? { ...item, days: e.target.value } : item))} />
      </div>)}
    </div>
    {error && <div className="form-error">{error}</div>}
    <div className="button-row end"><button className="button primary" disabled={saving} onClick={submit}><Save size={17} />{saving ? 'Creando...' : 'Crear proyecto'}</button></div>
  </Modal>;
}
