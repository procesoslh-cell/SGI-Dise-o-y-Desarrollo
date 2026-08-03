import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { api, session } from './api/client.js';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import TaskModal from './components/TaskModal.jsx';
import NotificationPopup from './components/NotificationPopup.jsx';
import BriefReviewModal from './components/BriefReviewModal.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MyTasksPage, { buildTaskInbox } from './pages/MyTasksPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import GanttPage from './pages/GanttPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

export default function App() {
  const [auth, setAuth] = useState(() => session.token() && session.user() ? { token: session.token(), user: session.user() } : null);
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeTask, setActiveTask] = useState(null);
  const [briefReview, setBriefReview] = useState(null);
  const [popupOpen, setPopupOpen] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const boot = await api.get('/bootstrap');
      setData(boot);
      setSelectedProjectId((current) => current && boot.projects.some((project) => project.id === Number(current)) ? current : '');
      setError('');
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError(err.message);
    }
  }

  useEffect(() => { if (auth) load(); }, [auth]);

  function logout() {
    session.clear();
    setAuth(null);
    setData(null);
    setActiveTask(null);
    setView('dashboard');
  }

  function openTask(item, mode = 'execute') {
    setActiveTask({ ...item, mode });
  }

  async function openNotification(notification) {
    const project = data.projects.find((item) => item.id === notification.projectId);
    if (notification.projectStageId && project) {
      const task = project.stages.find((item) => item.id === notification.projectStageId);
      if (task) openTask({ kind: 'stage', task, project }, notification.type === 'approval' ? 'validate' : 'execute');
    } else if (notification.marketingTaskId && project) {
      const task = project.marketingTasks.find((item) => item.id === notification.marketingTaskId);
      if (task) openTask({ kind: 'marketing', task, project }, notification.type === 'approval' ? 'validate' : 'execute');
    } else if (notification.type === 'brief-approval' && project) {
      setBriefReview(project);
    }
    setView('tasks');
    setPopupOpen(false);
    await api.put(`/notifications/${notification.id}/read`, {});
    await load();
  }

  if (!auth) return <Login onLogin={(payload) => { setAuth(payload); setPopupOpen(true); setError(''); }} />;
  if (!data) return <div className="loading-screen">
    <strong>Cargando SGI Diseño y Desarrollo...</strong>
    {error && <>
      <span className="loading-error">{error}</span>
      <div className="loading-actions">
        <button className="button primary" type="button" onClick={load}>Reintentar</button>
        <button className="button secondary" type="button" onClick={logout}>Volver al ingreso</button>
      </div>
    </>}
  </div>;

  const inbox = buildTaskInbox(data);
  const canManageUsers = data.user?.role?.code === 'ADMIN' || data.user?.permissions?.includes('admin:users');

  return <Layout user={data.user} view={view} setView={setView} taskCount={inbox.total} onRefresh={load} onLogout={logout}>
    {error && <div className="global-error"><AlertTriangle size={18} />{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
    {view === 'dashboard' && <DashboardPage data={data} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} openTask={openTask} />}
    {view === 'tasks' && <MyTasksPage data={data} openTask={openTask} openBriefReview={setBriefReview} />}
    {view === 'projects' && <ProjectsPage data={data} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} reload={load} openTask={openTask} />}
    {view === 'calendar' && <CalendarPage data={data} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} openTask={openTask} />}
    {view === 'gantt' && <GanttPage data={data} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} openTask={openTask} />}
    {view === 'users' && canManageUsers && <UsersPage data={data} reload={load} />}
    {view === 'users' && !canManageUsers && <DashboardPage data={data} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} openTask={openTask} />}

    <TaskModal item={activeTask} data={data} onClose={() => setActiveTask(null)} reload={load} defaultMode={activeTask?.mode || 'execute'} />
    {briefReview && <BriefReviewModal project={briefReview} onClose={() => setBriefReview(null)} reload={load} />}
    <NotificationPopup notifications={data.notifications || []} open={popupOpen} onClose={() => setPopupOpen(false)} onOpen={openNotification} onReadAll={async () => { await api.put('/notifications/read-all', {}); setPopupOpen(false); await load(); }} />
  </Layout>;
}
