import { CheckCircle2, Circle, Clock3, LockKeyhole, UserRound } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import ProgressBar from '../../components/ProgressBar.jsx';
import { formatDate, slaInfo } from '../../utils/dates.js';

export default function ProjectWorkflow({ project, openTask }) {
  return <div className="project-submodule">
    <div className="submodule-header">
      <div><h3>Workflow completo</h3><p>Cada tarea muestra responsable, fechas, avance, resultado y entregables.</p></div>
      <div className="workflow-progress"><ProgressBar value={project.progress} label="Avance validado" /></div>
    </div>
    <div className="workflow-list">
      {project.stages.map((stage, index) => {
        const sla = slaInfo(stage.dueDate);
        return <button key={stage.id} className={`workflow-row ${stage.status === 'Bloqueada' ? 'locked' : ''}`} onClick={() => openTask({ kind: 'stage', task: stage, project })}>
          <span className="workflow-index">{stage.status === 'Completa' ? <CheckCircle2 size={20} /> : stage.status === 'Bloqueada' ? <LockKeyhole size={18} /> : <Circle size={18} />}</span>
          <span className="workflow-main"><small>{stage.phase} · Etapa {index + 1}</small><b>{stage.name}</b><em>{stage.formData?.detalleTrabajo || 'Sin resultado cargado todavía.'}</em></span>
          <span className="workflow-owner"><UserRound size={15} />{stage.assignedUser?.name || 'Sin asignar'}</span>
          <span className={`workflow-sla ${sla.tone}`}><Clock3 size={14} />{formatDate(stage.startDate)} → {formatDate(stage.dueDate)}<small>{sla.label}</small></span>
          <span className="workflow-mini-progress"><ProgressBar value={stage.progressPercent} /></span>
          <StatusBadge status={stage.status} />
        </button>;
      })}
    </div>
  </div>;
}
