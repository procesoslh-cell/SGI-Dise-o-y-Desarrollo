export function allProjectTasks(project) {
  if (!project) return [];
  return [
    ...(project.stages || []).map((task) => ({ kind: 'stage', task, project })),
    ...(project.marketingTasks || []).map((task) => ({ kind: 'marketing', task, project }))
  ];
}

export function taskKey(item) {
  return `${item.kind}-${item.task?.id || item.project?.id}`;
}

export function taskStart(item) {
  return item.kind === 'stage' ? item.task.startDate : item.task.startDate || item.task.dueDate;
}

export function taskEnd(item) {
  return item.task.dueDate || taskStart(item);
}

export function taskOwner(item) {
  return item.kind === 'stage' ? item.task.assignedUser?.name : item.task.owner?.name;
}

export function taskStatus(item) {
  return item.task.status || 'Pendiente';
}

function taskHash(item) {
  const key = `${item.project?.id || 0}-${item.kind}-${item.task?.id || 0}-${item.task?.name || item.task?.title || ''}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

export function taskColorIndex(item, paletteSize = 12) {
  return taskHash(item) % paletteSize;
}

export function taskColorStyle(item) {
  const hue = taskHash(item) % 360;
  return {
    '--task-bg': `hsl(${hue} 72% 92%)`,
    '--task-border': `hsl(${hue} 58% 44%)`,
    '--task-text': `hsl(${hue} 55% 27%)`
  };
}
