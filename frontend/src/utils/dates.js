export const isoToday = () => new Date().toISOString().slice(0, 10);

export function parseDate(value) {
  if (!value) return null;
  return new Date(`${String(value).slice(0, 10)}T12:00:00`);
}

export function formatDate(value) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : '-';
}

export function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function addDays(value, days) {
  const date = parseDate(value) || new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(start, end) {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to) return 0;
  return Math.max(1, Math.round((to - from) / 86400000) + 1);
}

export function slaInfo(dueDate) {
  if (!dueDate) return { label: 'Sin fecha', tone: 'muted', hours: null };
  const diffMs = new Date(`${dueDate}T23:59:59`) - new Date();
  const hours = Math.ceil(diffMs / 3600000);
  if (hours < 0) return { label: `Vencida hace ${Math.ceil(Math.abs(hours) / 24)} día(s)`, tone: 'bad', hours };
  if (hours <= 24) return { label: hours <= 1 ? 'Vence en menos de 1 hora' : `Quedan ${hours} horas`, tone: 'bad', hours };
  const days = Math.ceil(hours / 24);
  if (days <= 3) return { label: `Quedan ${days} días`, tone: 'warn', hours };
  return { label: `Quedan ${days} días`, tone: 'ok', hours };
}

export function dateRange(start, end) {
  const current = parseDate(start);
  const last = parseDate(end || start);
  const result = [];
  if (!current || !last) return result;
  while (current <= last && result.length < 370) {
    result.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return result;
}
