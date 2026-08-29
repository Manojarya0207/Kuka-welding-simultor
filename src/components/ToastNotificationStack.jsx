import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';

export default function ToastNotificationStack({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => {
        const severity = (t.severity || 'INFO').toUpperCase();
        let Icon = Info;
        let borderClass = 'toast-info';

        if (severity === 'SUCCESS') {
          Icon = CheckCircle2;
          borderClass = 'toast-success';
        } else if (severity === 'WARNING') {
          Icon = AlertTriangle;
          borderClass = 'toast-warning';
        } else if (severity === 'ERROR' || severity === 'CRITICAL') {
          Icon = AlertOctagon;
          borderClass = 'toast-error';
        }

        return (
          <div key={t.id || t.event_id} className={`toast-card ${borderClass}`}>
            <div className="toast-icon-wrapper">
              <Icon size={18} />
            </div>
            <div className="toast-body">
              <div className="toast-header-row">
                <span className="toast-title">{t.title}</span>
                {t.command_id && <span className="toast-cmd-badge">{t.command_id}</span>}
              </div>
              <p className="toast-message">{t.message}</p>
              {t.payload?.duration && (
                <div className="toast-meta">
                  Duration: {t.payload.duration}s | Max Error: {t.payload.error ?? '0.00'} deg
                </div>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id || t.event_id)}
              className="toast-close-btn"
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
