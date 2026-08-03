import { BarChart3, CalendarDays, ClipboardCheck, FolderKanban, GanttChart, LogOut, RefreshCw, Users } from 'lucide-react';

const baseItems = [
  ['dashboard', 'Dashboard', BarChart3],
  ['tasks', 'Mis tareas', ClipboardCheck],
  ['projects', 'Proyectos', FolderKanban],
  ['calendar', 'Calendario', CalendarDays],
  ['gantt', 'Gantt', GanttChart]
];

function navigationFor(user) {
  const items = [...baseItems];
  if (user?.role?.code === 'ADMIN' || user?.permissions?.includes('admin:users')) items.push(['users', 'Usuarios', Users]);
  return items;
}

export default function Layout({ user, view, setView, taskCount, onRefresh, onLogout, children }) {
  const items = navigationFor(user);
  return <div className="app-shell">
    <aside className="sidebar">
      <div>
        <div className="brand-block">
          <div className="brand-logo">SGI</div>
          <div><strong>Diseño y Desarrollo</strong><span>Gestión de proyectos</span></div>
        </div>
        <nav className="main-nav">
          {items.map(([id, label, Icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            <Icon size={19} /><span>{label}</span>{id === 'tasks' && taskCount > 0 && <b className="nav-count">{taskCount}</b>}
          </button>)}
        </nav>
      </div>
      <div className="sidebar-user">
        <div><strong>{user.name}</strong><span>{user.role?.name}</span></div>
        <button onClick={onLogout}><LogOut size={17} />Salir</button>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="eyebrow">SGI · Diseño y Desarrollo</span>
          <h1>{items.find(([id]) => id === view)?.[1] || 'SGI'}</h1>
        </div>
        <button className="button secondary" onClick={onRefresh}><RefreshCw size={17} />Actualizar</button>
      </header>
      {children}
    </main>
  </div>;
}
