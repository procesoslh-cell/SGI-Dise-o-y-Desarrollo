import { X } from 'lucide-react';

export default function Modal({ open, title, subtitle, onClose, children, wide = false }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose?.();
  }}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
      </header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}
