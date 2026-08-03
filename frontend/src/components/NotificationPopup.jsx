import { BellRing, CheckCheck } from 'lucide-react';
import Modal from './Modal.jsx';
import { formatDateTime } from '../utils/dates.js';

export default function NotificationPopup({ notifications, open, onClose, onOpen, onReadAll }) {
  return <Modal open={open && notifications.length > 0} title="Tareas y alertas pendientes" subtitle="Estas son las novedades que requieren tu atención." onClose={onClose}>
    <div className="notification-popup-list">
      {notifications.map((notification) => <button key={notification.id} onClick={() => onOpen(notification)}>
        <span className="notification-icon"><BellRing size={18} /></span>
        <span><b>{notification.title}</b><small>{notification.message}</small><em>{formatDateTime(notification.createdAt)}</em></span>
      </button>)}
    </div>
    <div className="button-row end"><button className="button secondary" onClick={onReadAll}><CheckCheck size={17} />Marcar todas como vistas</button></div>
  </Modal>;
}
