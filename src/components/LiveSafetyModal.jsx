import React from 'react';
import { AlertOctagon, ShieldAlert, X } from 'lucide-react';

export default function LiveSafetyModal({
  isOpen,
  onClose,
  onConfirm,
  robotId = "KUKA-01",
  targetJoints = {},
  commandType = "MOVE_JOINT"
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="safety-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="safety-modal-header">
          <div className="safety-icon-box">
            <ShieldAlert size={22} className="text-amber-600" />
          </div>
          <div>
            <h3 className="safety-modal-title">Live Robot Control Confirmation</h3>
            <p className="safety-modal-subtitle">Industrial Safety Standard ISO 10218-1</p>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>

        <div className="safety-modal-body">
          <div className="safety-warning-banner">
            <AlertOctagon size={18} className="text-rose-600 flex-shrink-0" />
            <p>
              This command will physically actuate industrial robot <strong>{robotId}</strong>.
              Verify personnel clearance within cell perimeter before confirming.
            </p>
          </div>

          <div className="target-summary-box">
            <span className="summary-label">Commanded Target Axes:</span>
            <div className="summary-grid">
              {['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((ax) => (
                <div key={ax} className="summary-cell">
                  <span className="axis-tag">{ax.toUpperCase()}</span>
                  <span className="axis-val">{(targetJoints[ax] ?? 0).toFixed(2)} deg</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="safety-modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger-confirm">
            Confirm & Send to Robot
          </button>
        </div>
      </div>
    </div>
  );
}
