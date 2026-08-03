export default function StatusBadge({ status = 'Pendiente' }) {
  const normalized = status.toLowerCase().replaceAll(' ', '-').replaceAll('ó', 'o').replaceAll('í', 'i');
  return <span className={`status-badge status-${normalized}`}>{status}</span>;
}
