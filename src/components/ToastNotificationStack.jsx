import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Info,
  X,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

function ToastCard({ toast, onDismiss, duration = 5000 }) {
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const remainingTimeRef = useRef(duration);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id || toast.event_id);
    }, 180);
  };

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
      return;
    }

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, remainingTimeRef.current);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused]);

  const severity = (toast.severity || 'INFO').toUpperCase();
  const isError = severity === 'ERROR' || severity === 'CRITICAL';
  const isWarning = severity === 'WARNING';
  const isSuccess = severity === 'SUCCESS';
  const isRobot = toast.type?.includes('ROBOT') || toast.event?.includes('ROBOT');

  // Exact icon badge styles matching user specification
  let variantClass = 'mnc-card-info';
  let badgeIcon = <Info size={13} strokeWidth={2.6} className="text-white" />;

  if (isSuccess) {
    variantClass = 'mnc-card-success';
    badgeIcon = <Check size={13} strokeWidth={2.8} className="text-white" />;
  } else if (isError) {
    variantClass = 'mnc-card-error';
    badgeIcon = <X size={13} strokeWidth={2.8} className="text-white" />;
  } else if (isWarning) {
    variantClass = 'mnc-card-warning';
    badgeIcon = <AlertTriangle size={12} strokeWidth={2.6} className="text-white" />;
  } else if (isRobot) {
    variantClass = 'mnc-card-robot';
    badgeIcon = <Check size={13} strokeWidth={2.8} className="text-white" />;
  }

  // Handle retry / action button if provided
  const handleAction = () => {
    if (toast.onAction) {
      toast.onAction();
    }
    handleDismiss();
  };

  const hasAction = isError || toast.actionLabel;
  const actionText = toast.actionLabel || (isError ? 'Retry' : null);

  return (
    <div
      className={`mnc-toast-card ${variantClass} ${isExiting ? 'mnc-toast-card-exit' : ''}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
    >
      {/* Solid Circular Status Badge */}
      <div className="mnc-icon-badge">
        {badgeIcon}
      </div>

      {/* Main Content Area */}
      <div className="mnc-card-content">
        <div className="mnc-card-header">
          <span className="mnc-card-title">{toast.title}</span>
          {toast.command_id && (
            <span className="mnc-cmd-tag font-mono">{toast.command_id}</span>
          )}
        </div>

        {toast.message && (
          <p className="mnc-card-message">{toast.message}</p>
        )}

        {/* Action Links (e.g. Retry | Dismiss) matching Card 3 in design */}
        {hasAction && (
          <div className="mnc-card-actions">
            <button onClick={handleAction} className="mnc-action-primary">
              {actionText}
            </button>
            <button onClick={handleDismiss} className="mnc-action-secondary">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Top-right Minimalist Close Icon */}
      <button
        onClick={handleDismiss}
        className="mnc-card-close"
        title="Close notification"
        aria-label="Close"
      >
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export default function ToastNotificationStack({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="mnc-toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard
          key={t.id || t.event_id}
          toast={t}
          onDismiss={onDismiss}
          duration={5000}
        />
      ))}
    </div>
  );
}
