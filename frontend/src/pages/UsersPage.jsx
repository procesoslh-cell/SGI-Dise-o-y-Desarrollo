import { useEffect, useMemo, useState } from 'react';
import { Edit3, KeyRound, Plus, Search, UserCheck, UserX, Users } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { api } from '../api/client.js';

export default function UsersPage({ data, reload }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const users = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return data.users;
    return data.users.filter((user) => [user.name, user.username, user.email, data.roles.find((role) => role.id === user.roleId)?.name].some((value) => String(value || '').toLowerCase().includes(text)));
  }, [data.users, data.roles, query]);

  return <div className="page-stack">
    <section className="users-summary metrics-grid compact">
      <article className="metric-card"><span className="metric-icon"><Users size={20} /></span><div><small>Usuarios totales</small><strong>{data.users.length}</strong><p>Cuentas registradas</p></div></article>
      <article className="metric-card"><span className="metric-icon"><UserCheck size={20} /></span><div><small>Usuarios activos</small><strong>{data.users.filter((user) => user.active).length}</strong><p>Pueden ingresar al sistema</p></div></article>
      <article className="metric-card"><span className="metric-icon"><UserX size={20} /></span><div><small>Usuarios inactivos</small><strong>{data.users.filter((user) => !user.active).length}</strong><p>Acceso suspendido</p></div></article>
      <article className="metric-card"><span className="metric-icon"><KeyRound size={20} /></span><div><small>Roles disponibles</small><strong>{data.roles.length}</strong><p>Perfiles de acceso</p></div></article>
    </section>

    <section className="card-panel users-panel">
      <div className="panel-header">
        <div><h2>Usuarios y roles</h2><p>Creá usuarios, asignales un rol y administrá su acceso.</p></div>
        <button className="button primary" onClick={() => setCreating(true)}><Plus size={17} />Crear usuario</button>
      </div>
      <label className="users-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, usuario, email o rol" /></label>
      <div className="users-table">
        <div className="users-table-head"><span>Usuario</span><span>Rol</span><span>Estado</span><span>Acciones</span></div>
        {users.map((user) => <div key={user.id}>
          <span><b>{user.name}</b><small>{user.username} · {user.email}</small></span>
          <span>{data.roles.find((role) => role.id === user.roleId)?.name || 'Sin rol'}</span>
          <span><i className={user.active ? 'user-state active' : 'user-state inactive'} />{user.active ? 'Activo' : 'Inactivo'}</span>
          <span><button className="button secondary small" onClick={() => setEditing(user)}><Edit3 size={15} />Editar</button></span>
        </div>)}
      </div>
    </section>

    <UserModal open={creating} data={data} onClose={() => setCreating(false)} reload={reload} />
    <UserModal open={Boolean(editing)} user={editing} data={data} onClose={() => setEditing(null)} reload={reload} />
  </div>;
}

function UserModal({ open, user, data, onClose, reload }) {
  const isEdit = Boolean(user);
  const [form, setForm] = useState(() => initialForm(user, data));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initialForm(user, data));
      setError('');
    }
  }, [open, user?.id]);

  async function save() {
    setError('');
    try {
      if (!form.name || !form.username || !form.email || !form.roleId || (!isEdit && !form.password)) throw new Error('Completá todos los campos obligatorios.');
      if (isEdit) await api.put(`/users/${user.id}`, form);
      else await api.post('/users', form);
      await reload();
      onClose();
    } catch (error) { setError(error.message); }
  }

  return <Modal open={open} title={isEdit ? 'Editar usuario' : 'Crear usuario'} subtitle="Administración de accesos" onClose={onClose}>
    <div className="form-grid">
      <label className="span-2">Nombre y apellido<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Usuario<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
      <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Rol<select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}><option value="">Seleccionar...</option>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
      <label>{isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isEdit ? 'Dejar en blanco para mantenerla' : 'Mínimo 4 caracteres'} /></label>
      <label className="user-active-check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Usuario activo</label>
    </div>
    {error && <div className="form-error">{error}</div>}
    <div className="button-row end"><button className="button primary" onClick={save}>{isEdit ? 'Guardar cambios' : 'Crear usuario'}</button></div>
  </Modal>;
}

function initialForm(user, data) {
  return {
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    roleId: user?.roleId || data.roles.find((role) => role.code !== 'ADMIN')?.id || '',
    password: '',
    active: user?.active !== false
  };
}
