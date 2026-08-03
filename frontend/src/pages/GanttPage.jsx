import { useMemo, useState } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import { allProjectTasks, taskColorIndex, taskColorStyle, taskEnd, taskOwner, taskStart } from '../utils/tasks.js';
import { addDays, daysBetween, formatDate, parseDate } from '../utils/dates.js';

const DAY_WIDTH = 28;

export default function GanttPage({ data, selectedProjectId, setSelectedProjectId, openTask }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const projects = selectedProjectId ? data.projects.filter((project) => project.id === Number(selectedProjectId)) : data.projects;
  const tasks = projects.flatMap(allProjectTasks).filter((item) => taskStart(item) && taskEnd(item) && (typeFilter === 'all' || item.kind === typeFilter));
  const bounds = useMemo(() => getBounds(tasks), [tasks]);
  const days = useMemo(() => {
    const output = [];
    let current = bounds.start;
    while (parseDate(current) <= parseDate(bounds.end) && output.length < 260) {
      output.push(current);
      current = addDays(current, 1);
    }
    return output;
  }, [bounds]);
  const width = Math.max(900, days.length * DAY_WIDTH);
  const marketingCount = tasks.filter((item) => item.kind === 'marketing').length;

  return <div className="page-stack">
    <section className="filter-bar">
      <div className="calendar-filters">
        <label>Proyecto<select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value)}><option value="">Todos los proyectos</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label>
        <label>Tipo de tarea<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">Workflow + Marketing</option><option value="stage">Solo workflow</option><option value="marketing">Solo Plan de Marketing</option></select></label>
      </div>
      <div className="gantt-range"><span>Desde <b>{formatDate(bounds.start)}</b></span><span>Hasta <b>{formatDate(bounds.end)}</b></span><span>{tasks.length} tareas · {marketingCount} de Marketing</span></div>
    </section>

    <section className="gantt-panel card-panel">
      <div className="gantt-sticky-header">
        <div className="gantt-label-header">Tarea / responsable</div>
        <div className="gantt-scroll header-scroll">
          <div className="gantt-date-header" style={{ width }}>
            {days.map((day, index) => <span key={day} className={index % 7 === 0 ? 'week-start' : ''} style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}>
              <b>{new Date(`${day}T12:00:00`).getDate()}</b><small>{new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(new Date(`${day}T12:00:00`))}</small>
            </span>)}
          </div>
        </div>
      </div>
      <div className="gantt-body">
        <div className="gantt-labels">
          {tasks.map((item) => <button key={`${item.kind}-${item.task.id}`} onClick={() => openTask(item)}>
            <span><span className={`gantt-kind ${item.kind}`}>{item.kind === 'marketing' ? 'Plan Marketing' : 'Workflow'}</span><b>{item.task.name || item.task.title}</b><small>{item.project.code} · {taskOwner(item) || 'Sin responsable'}</small></span><StatusBadge status={item.task.status} />
          </button>)}
        </div>
        <div className="gantt-scroll gantt-main-scroll">
          <div className="gantt-timeline" style={{ width, height: tasks.length * 62 }}>
            {days.map((day, index) => <i key={day} className={index % 7 === 0 ? 'week-line' : ''} style={{ left: index * DAY_WIDTH }} />)}
            {tasks.map((item, row) => {
              const left = Math.max(0, daysBetween(bounds.start, taskStart(item)) - 1) * DAY_WIDTH;
              const duration = Math.max(1, daysBetween(taskStart(item), taskEnd(item)));
              const progress = Number(item.task.progressPercent || (item.task.status === 'Completa' || item.task.status === 'Completo' ? 100 : 0));
              const color = taskColorIndex(item);
              return <button key={`${item.kind}-${item.task.id}`} className={`gantt-bar task-color-${color} ${item.kind} status-${String(item.task.status).toLowerCase().replaceAll(' ', '-')}`} style={{ ...taskColorStyle(item), left, top: row * 62 + 13, width: Math.max(DAY_WIDTH, duration * DAY_WIDTH - 4) }} onClick={() => openTask(item)} title={`${item.task.name || item.task.title}\nTipo: ${item.kind === 'marketing' ? 'Plan de Marketing' : 'Workflow'}\n${formatDate(taskStart(item))} a ${formatDate(taskEnd(item))}\n${taskOwner(item) || 'Sin responsable'}\nAvance ${progress}%`}>
                <span style={{ width: `${progress}%` }} /><b>{item.task.name || item.task.title}</b><small>{progress}%</small>
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>
    <section className="gantt-legend card-panel"><span><i className="legend-stage" />Workflow</span><span><i className="legend-marketing" />Plan de Marketing incluido en el Gantt</span></section>
  </div>;
}

function getBounds(tasks) {
  if (!tasks.length) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: addDays(today, -7), end: addDays(today, 45) };
  }
  const starts = tasks.map(taskStart).sort();
  const ends = tasks.map(taskEnd).sort();
  return { start: addDays(starts[0], -3), end: addDays(ends[ends.length - 1], 5) };
}
