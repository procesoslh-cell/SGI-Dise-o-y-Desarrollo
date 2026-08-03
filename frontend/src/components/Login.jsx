import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { api, session } from '../api/client.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('jefe');
  const [password, setPassword] = useState('1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/auth/login', { username, password });
      session.save(result);
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return <div className="login-page">
    <form className="login-card" onSubmit={submit}>
      <div className="login-logo">SGI</div>
      <h1>Diseño y Desarrollo</h1>
      <p>Proyectos, tareas, calendario y Gantt en un mismo circuito.</p>
      <label>Usuario<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label>
      <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="button primary full" disabled={loading}><LogIn size={18} />{loading ? 'Ingresando...' : 'Ingresar'}</button>
      <small>Prueba: jefe / 1234 · marketing / 1234 · analista / 1234</small>
    </form>
  </div>;
}
