import React from 'react';
import { Play, Eye, AlertOctagon, RotateCcw, Sliders, CheckCircle2, ArrowRight } from 'lucide-react';

const JOINT_LIMITS = {
  a1: { min: -185, max: 185, label: 'Turntable' },
  a2: { min: -155, max: 35, label: 'Shoulder' },
  a3: { min: -130, max: 154, label: 'Elbow' },
  a4: { min: -350, max: 350, label: 'Forearm Roll' },
  a5: { min: -130, max: 130, label: 'Wrist Pitch' },
  a6: { min: -350, max: 350, label: 'Flange Roll' },
};

const PRESETS = [
  {
    name: 'Home Standby',
    joints: { a1: 0.0, a2: -30.6, a3: 29.4, a4: 0.0, a5: 43.8, a6: -112.5 }
  },
  {
    name: 'High Approach',
    joints: { a1: 0.0, a2: -15.0, a3: 40.0, a4: 0.0, a5: 50.0, a6: -90.0 }
  },
  {
    name: 'Welding Seam',
    joints: { a1: 0.0, a2: 5.0, a3: 65.0, a4: 0.0, a5: 20.0, a6: -90.0 }
  },
  {
    name: 'Torch Clean',
    joints: { a1: 55.0, a2: -25.0, a3: 35.0, a4: 10.0, a5: 40.0, a6: -45.0 }
  },
];

export default function JointControlPanel({
  targetJoints,
  actualJoints,
  onTargetChange,
  onApplyPreset,
  onPreviewToggle,
  isPreviewActive,
  onSendCommand,
  onEmergencyStop,
  onResetDrives,
  robotMode = 'LIVE',
  robotStatus = 'idle',
  drivesEnergized = true,
  activeCommandState = null
}) {
  const handleSliderChange = (axis, value) => {
    onTargetChange(axis, parseFloat(value));
  };

  const handleInputChange = (axis, value) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onTargetChange(axis, num);
    }
  };

  const isMoving = robotStatus.toLowerCase() === 'moving';

  // Lifecycle steps
  const steps = [
    { key: 'RECEIVED', label: 'Received' },
    { key: 'VALIDATED', label: 'Validated' },
    { key: 'SENT_TO_ROBOT', label: 'Sent' },
    { key: 'MOVING', label: 'Moving' },
    { key: 'TARGET_REACHED', label: 'Target Reached' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const currentStepIndex = activeCommandState
    ? steps.findIndex(s => s.key === activeCommandState.status || s.key === activeCommandState.event)
    : -1;

  return (
    <div className="joint-control-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-slate-600" />
          <h2 className="panel-title">6-Axis Joint Controller</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-pill ${drivesEnergized ? 'status-pill-green' : 'status-pill-red'}`}>
            {drivesEnergized ? 'Drives Energized' : 'Drives Off'}
          </span>
          <span className="mode-badge">{robotMode}</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="presets-bar">
        <span className="presets-label">Presets:</span>
        <div className="presets-buttons">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => onApplyPreset(p.joints)}
              className="preset-btn"
              disabled={isMoving}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Joint Sliders & Numeric Inputs */}
      <div className="joint-grid">
        {Object.entries(JOINT_LIMITS).map(([axis, limit]) => {
          const targetVal = targetJoints[axis] ?? 0.0;
          const actualVal = actualJoints[axis] ?? 0.0;
          const diff = Math.abs(targetVal - actualVal);

          return (
            <div key={axis} className="joint-card">
              <div className="joint-card-top">
                <div className="joint-title-group">
                  <span className="joint-axis-tag">{axis.toUpperCase()}</span>
                  <span className="joint-axis-name">{limit.label}</span>
                </div>
                <div className="joint-values-display">
                  <span className="val-item actual">
                    Actual: <strong>{actualVal.toFixed(2)} deg</strong>
                  </span>
                  <span className="val-item target">
                    Target: <strong>{targetVal.toFixed(2)} deg</strong>
                  </span>
                  {diff > 0.05 && (
                    <span className="val-diff">
                      Delta: {diff.toFixed(2)} deg
                    </span>
                  )}
                </div>
              </div>

              {/* Slider & Numeric Input */}
              <div className="joint-inputs-row">
                <input
                  type="range"
                  min={limit.min}
                  max={limit.max}
                  step="0.5"
                  value={targetVal}
                  onChange={(e) => handleSliderChange(axis, e.target.value)}
                  className="joint-range-slider"
                  disabled={isMoving}
                />
                <div className="numeric-input-wrapper">
                  <input
                    type="number"
                    min={limit.min}
                    max={limit.max}
                    step="1"
                    value={targetVal}
                    onChange={(e) => handleInputChange(axis, e.target.value)}
                    className="joint-number-field"
                    disabled={isMoving}
                  />
                  <span className="unit-label">deg</span>
                </div>
              </div>

              <div className="joint-limit-footer">
                <span>Min: {limit.min} deg</span>
                <span>Max: {limit.max} deg</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Command Lifecycle Stepper */}
      {activeCommandState && (
        <div className="lifecycle-stepper-box">
          <div className="stepper-header">
            <span className="stepper-cmd-id">
              Command: {activeCommandState.command_id || 'Active Execution'}
            </span>
            <span className="stepper-status-badge">
              {activeCommandState.status}
            </span>
          </div>
          <div className="stepper-track">
            {steps.map((step, idx) => {
              const isPast = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.key} className={`step-node ${isPast ? 'past' : ''} ${isCurrent ? 'current' : ''}`}>
                  <div className="step-circle">
                    {isPast ? <CheckCircle2 size={12} /> : <span>{idx + 1}</span>}
                  </div>
                  <span className="step-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="panel-actions-toolbar">
        <button
          onClick={onPreviewToggle}
          className={`btn-preview ${isPreviewActive ? 'active' : ''}`}
          title="Toggle 3D target preview ghost model"
        >
          <Eye size={16} />
          {isPreviewActive ? 'Hide 3D Preview' : 'Preview in 3D'}
        </button>

        <button
          onClick={onSendCommand}
          disabled={isMoving || !drivesEnergized}
          className="btn-send-command"
        >
          <Play size={16} />
          Send to Robot
        </button>

        {!drivesEnergized ? (
          <button onClick={onResetDrives} className="btn-reset-drives">
            <RotateCcw size={16} />
            Reset E-Stop
          </button>
        ) : (
          <button onClick={onEmergencyStop} className="btn-estop">
            <AlertOctagon size={16} />
            E-STOP
          </button>
        )}
      </div>
    </div>
  );
}
