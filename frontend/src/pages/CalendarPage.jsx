import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import { allProjectTasks, taskColorIndex, taskColorStyle, taskEnd, taskOwner, taskStart } from '../utils/tasks.js';
import { dateRange, formatDate } from '../utils/dates.js';

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarPage({ data, selectedProjectId, setSelectedProjectId, openTask }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [typeFilter, setTypeFilter] = useState('all');
  const project = data.projects.find((item) => item.id === Number(selectedProjectId));
  const projects = project ? [project] : data.projects;
  const tasks = projects.flatMap(allProjectTasks).filter((item) => typeFilter === 'all' || item.kind === typeFilter);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(cursor);

  const days = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const taskMap = useMemo(() => {
    const map = new Map();
    tasks.forEach((item) => {
      dateRange(taskStart(item), taskEnd(item)).forEach((date) => {
        if (!map.has(date)) map.set(date, []);
        map.get(date).push(item);
      });
    });
    map.forEach((items) => items.sort((a, b) => String(taskStart(a)).localeCompare(String(taskStart(b))) || String(a.task.name || a.task.title).localeCompare(String(b.task.name || b.task.title))));
    return map;
  }, [tasks]);

  return <div className="page-stack">
    <section className="filter-bar calendar-toolbar">
      <div className="calendar-filters">
        <label>Proyecto<select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value)}><option value="">Todos los proyectos</option>{data.projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Tipo de tarea<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">Workflow + Marketing</option><option value="stage">Solo workflow</option><option value="marketing">Solo Plan de Marketing</option></select></label>
      </div>
      <div className="month-switcher"><button className="icon-button" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft /></button><strong>{monthLabel}</strong><button className="icon-button" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight /></button></div>
    </section>

    <section className="calendar-panel card-panel">
      <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const events = taskMap.get(key) || [];
          const inMonth = day.getMonth() === month;
          const today = key === new Date().toISOString().slice(0, 10);
          return <div key={key} className={`calendar-day ${!inMonth ? 'outside' : ''} ${today ? 'today' : ''}`}>
            <span className="day-number">{day.getDate()}</span>
            <div className="day-events">
              {events.slice(0, 5).map((item) => {
                const color = taskColorIndex(item);
                const tooltip = `${item.task.name || item.task.title}\nProyecto: ${item.project.code} · ${item.project.name}\nTipo: ${item.kind === 'marketing' ? 'Plan de Marketing' : 'Workflow'}\nResponsable: ${taskOwner(item) || 'Sin responsable'}\nPeríodo: ${formatDate(taskStart(item))} a ${formatDate(taskEnd(item))}\nEstado: ${item.task.status}\nAvance: ${item.task.progressPercent || 0}%`;
                return <button key={`${item.kind}-${item.task.id}-${key}`} style={taskColorStyle(item)} className={`calendar-event task-color-${color} ${item.kind} status-${String(item.task.status).toLowerCase().replaceAll(' ', '-')}`} title={tooltip} onClick={() => openTask(item)}>
                  <span className="calendar-event-type">{item.kind === 'marketing' ? 'MKT' : 'WF'}</span>
                  <b>{item.task.name || item.task.title}</b><small>{taskOwner(item) || 'Sin responsable'} · {item.task.status}</small>
                </button>;
              })}
              {events.length > 5 && <span className="more-events">+{events.length - 5} tareas</span>}
            </div>
          </div>;
        })}
      </div>
    </section>

    <section className="calendar-legend card-panel">
      <span><Palette size={16} />Cada tarea conserva un color propio durante todo su período.</span><span><i className="legend-stage" />WF: Workflow</span><span><i className="legend-marketing" />MKT: Plan de Marketing</span><span><StatusBadge status="En curso" /></span><span><StatusBadge status="Pendiente validación" /></span><span><StatusBadge status="Completa" /></span>
    </section>
  </div>;
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayIndex);
  const endOffset = 6 - ((last.getDay() + 6) % 7);
  const end = new Date(year, month + 1, endOffset);
  const result = [];
  const current = new Date(start);
  while (current <= end) {
    result.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return result;
}
