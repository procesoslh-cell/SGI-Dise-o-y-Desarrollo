export default function ProgressBar({ value = 0, label }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return <div className="progress-wrap">
    {label && <div className="progress-label"><span>{label}</span><b>{safe}%</b></div>}
    <div className="progress-track"><span style={{ width: `${safe}%` }} /></div>
  </div>;
}
