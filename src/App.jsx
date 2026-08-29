import React, { useState, useEffect, useRef, useCallback } from 'react';
import ThreeViewport from './components/ThreeViewport';
import JointControlPanel from './components/JointControlPanel';
import NotificationBell from './components/NotificationBell';
import ToastNotificationStack from './components/ToastNotificationStack';
import CommandHistoryTable from './components/CommandHistoryTable';
import LiveSafetyModal from './components/LiveSafetyModal';
import TeachPendant from './components/TeachPendant';
import { METALS, WORKPIECE_SHAPES } from './materials';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Cpu,
  History,
  Info,
  Radio,
  RefreshCw,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';
const WS_BASE = 'ws://127.0.0.1:8000/ws/robots/KUKA-01';

const DEFAULT_JOINTS = {
  a1: 0.0,
  a2: -30.6,
  a3: 29.4,
  a4: 0.0,
  a5: 43.8,
  a6: -112.5,
};

export default function App() {
  // Core Robot State
  const [robotId, setRobotId] = useState('KUKA-01');
  const [robotStatus, setRobotStatus] = useState('idle');
  const [robotMode, setRobotMode] = useState('LIVE'); // 'LIVE' | 'SIMULATION'
  const [drivesEnergized, setDrivesEnergized] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  // Kinematics: Commanded Target vs Authoritative Actual Feedback
  const [targetJoints, setTargetJoints] = useState(DEFAULT_JOINTS);
  const [actualJoints, setActualJoints] = useState(DEFAULT_JOINTS);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const isPreviewActiveRef = useRef(false);

  useEffect(() => {
    isPreviewActiveRef.current = isPreviewActive;
  }, [isPreviewActive]);

  // Command Execution State Machine
  const [activeCommandState, setActiveCommandState] = useState(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Notification Engine State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  // UI Tabs & Views
  const [activeBottomTab, setActiveBottomTab] = useState('history'); // 'history' | 'notifications' | 'telemetry' | 'audit' | 'teach'
  const [auditLogs, setAuditLogs] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraPreset, setCameraPreset] = useState(null);

  // Audio Context
  const audioCtxRef = useRef(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  };

  const playChime = (freq = 520, duration = 0.2) => {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  // ---------------------------------------------------------------------------
  // Toast Management (Auto-dismiss after 4.5 seconds)
  // ---------------------------------------------------------------------------
  const addToast = useCallback((notif) => {
    const toastItem = {
      id: notif.id || notif.event_id || `toast-${Date.now()}`,
      title: notif.title,
      message: notif.message,
      severity: notif.severity || 'INFO',
      command_id: notif.command_id,
      payload: notif.payload || {},
    };

    setToasts((prev) => [toastItem, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== toastItem.id));
    }, 4500);

    if (notif.severity === 'SUCCESS') playChime(640, 0.25);
    else if (notif.severity === 'WARNING' || notif.severity === 'ERROR') playChime(320, 0.35);
  }, [soundEnabled]);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ---------------------------------------------------------------------------
  // API Fetch Utilities
  // ---------------------------------------------------------------------------
  const fetchState = async () => {
    try {
      const res = await fetch(`${API_BASE}/robots/${robotId}/state`);
      if (res.ok) {
        const data = await res.json();
        if (data.joints) {
          setActualJoints(data.joints);
          if (!isPreviewActiveRef.current) {
            setTargetJoints(data.joints);
          }
        }
        if (data.status) setRobotStatus(data.status);
        if (data.mode) setRobotMode(data.mode);
        if (data.drives_energized !== undefined) setDrivesEnergized(data.drives_energized);
      }
    } catch (e) {
      // Backend starting
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {}
  };

  const fetchCommandHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/robots/${robotId}/commands?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setCommandHistory(data.commands || []);
      }
    } catch (e) {
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/audit-logs?limit=50`);
      if (res.ok) {
        setAuditLogs(data.logs || []);
      }
    } catch (e) {}
  };

  // ---------------------------------------------------------------------------
  // WebSocket Connection (Telemetry, Notifications, Command Updates)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let ws;
    let reconnectTimeout;
    let isUnmounted = false;

    const connect = () => {
      try {
        ws = new WebSocket(WS_BASE);

        ws.onopen = () => {
          if (isUnmounted) return;
          setWsConnected(true);
          fetchState();
          fetchNotifications();
          fetchCommandHistory();
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);

            // 1. Authoritative robot_state feedback stream
            if (data.type === 'robot_state' && data.payload) {
              const pl = data.payload;
              if (pl.actual_joints) {
                setActualJoints(pl.actual_joints);
                if (!isPreviewActiveRef.current) {
                  setTargetJoints(pl.actual_joints);
                }
              }
              if (pl.status) setRobotStatus(pl.status.toLowerCase());
              if (pl.mode) setRobotMode(pl.mode);
              if (pl.drives_energized !== undefined) setDrivesEnergized(pl.drives_energized);
            }

            // 2. Real-time verified notification
            else if (data.type === 'notification') {
              setNotifications((prev) => [data, ...prev.filter((n) => n.id !== data.id)]);
              setUnreadCount((prev) => prev + 1);
              addToast(data);

              if (data.event === 'COMMAND_COMPLETED') {
                setIsPreviewActive(false);
                setActiveCommandState((prev) => ({
                  ...prev,
                  status: 'COMPLETED',
                  event: 'COMMAND_COMPLETED',
                }));
                fetchCommandHistory();
              }
            }

            // 3. Command Lifecycle state update
            else if (data.type === 'command_update') {
              setActiveCommandState({
                command_id: data.command_id,
                status: data.status,
                event: data.event,
                payload: data.payload,
              });

              if (['COMPLETED', 'FAILED', 'TIMEOUT', 'STOPPED'].includes(data.status)) {
                fetchCommandHistory();
                setTimeout(() => {
                  setActiveCommandState(null);
                }, 6000);
              }
            }
          } catch (err) {
            console.warn('WS parse error:', err);
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          reconnectTimeout = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connect, 2000);
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [robotId, addToast]);

  // Periodic fallback refresh
  useEffect(() => {
    fetchState();
    fetchNotifications();
    fetchCommandHistory();
  }, []);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleTargetChange = (axis, val) => {
    setTargetJoints((prev) => ({ ...prev, [axis]: val }));
    setIsPreviewActive(true);
  };

  const handleSyncWithRobot = () => {
    setTargetJoints({ ...actualJoints });
    setIsPreviewActive(false);
  };

  const handleApplyPreset = (presetJoints) => {
    setTargetJoints({ ...presetJoints });
    setIsPreviewActive(true);
  };

  const handlePreviewToggle = () => {
    setIsPreviewActive((prev) => !prev);
  };

  const handleSendCommandClick = () => {
    if (robotMode === 'LIVE') {
      setIsSafetyModalOpen(true);
    } else {
      executeSendCommand();
    }
  };

  const executeSendCommand = async () => {
    setIsSafetyModalOpen(false);
    try {
      const res = await fetch(`${API_BASE}/robots/${robotId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command_type: 'MOVE_JOINT',
          joints: targetJoints,
          mode: robotMode,
          speed: 50.0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast({
          title: 'Command Rejected',
          message: data.detail?.message || 'Pre-flight check failed',
          severity: 'ERROR',
        });
      } else {
        setActiveCommandState({
          command_id: data.command_id,
          status: 'QUEUED',
          event: 'COMMAND_RECEIVED',
        });
      }
    } catch (err) {
      addToast({
        title: 'Network Error',
        message: 'Could not connect to FastAPI server.',
        severity: 'ERROR',
      });
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await fetch(`${API_BASE}/robots/${robotId}/stop`, { method: 'POST' });
    } catch (e) {}
  };

  const handleResetDrives = async () => {
    try {
      await fetch(`${API_BASE}/robots/${robotId}/reset`, { method: 'POST' });
    } catch (e) {}
  };

  const handleModeChange = async (newMode) => {
    try {
      const res = await fetch(`${API_BASE}/robots/${robotId}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        setRobotMode(newMode);
      }
    } catch (e) {}
  };

  const handleMarkNotifRead = async (notifId) => {
    try {
      await fetch(`${API_BASE}/notifications/${notifId}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId || n.event_id === notifId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API_BASE}/notifications/read-all`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  // Convert joint angles for ThreeViewport format { A1, A2, A3, A4, A5, A6 }
  const viewportActualAngles = {
    A1: actualJoints.a1 ?? 0,
    A2: actualJoints.a2 ?? -30.6,
    A3: actualJoints.a3 ?? 29.4,
    A4: actualJoints.a4 ?? 0,
    A5: actualJoints.a5 ?? 43.8,
    A6: actualJoints.a6 ?? -112.5,
  };

  const viewportTargetAngles = {
    A1: targetJoints.a1 ?? 0,
    A2: targetJoints.a2 ?? -30.6,
    A3: targetJoints.a3 ?? 29.4,
    A4: targetJoints.a4 ?? 0,
    A5: targetJoints.a5 ?? 43.8,
    A6: targetJoints.a6 ?? -112.5,
  };

  return (
    <div className="kuka-app-root">
      {/* Toast Stack (Top Right, Non-intrusive) */}
      <ToastNotificationStack toasts={toasts} onDismiss={dismissToast} />

      {/* Live Mode Safety Modal */}
      <LiveSafetyModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        onConfirm={executeSendCommand}
        robotId={robotId}
        targetJoints={targetJoints}
      />

      {/* Top Industrial Header (Pure White Card / Subtle Slate Border) */}
      <header className="kuka-header">
        <div className="header-left">
          <div className="brand-logo-badge">
            <span className="brand-kuka-text">KUKA</span>
            <span className="brand-sub-tag">KR C5 DIGITAL TWIN</span>
          </div>

          <div className="robot-select-group">
            <label className="text-xs text-slate-500 font-medium">Unit:</label>
            <select
              value={robotId}
              onChange={(e) => setRobotId(e.target.value)}
              className="robot-select-input"
            >
              <option value="KUKA-01">KUKA-01 (KR CYBERTECH)</option>
              <option value="KUKA-02">KUKA-02 (Welding Cell B)</option>
            </select>
          </div>

          <div className={`connection-pill ${wsConnected ? 'connected' : 'offline'}`}>
            <span className="dot" />
            <span>{wsConnected ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>

          <div className={`drives-pill ${drivesEnergized ? 'energized' : 'deenergized'}`}>
            <Zap size={13} />
            <span>{drivesEnergized ? '400V DRIVES ON' : 'DRIVES OFF'}</span>
          </div>
        </div>

        <div className="header-right">
          {/* Mode Switcher */}
          <div className="mode-toggle-group">
            <button
              onClick={() => handleModeChange('SIMULATION')}
              className={`mode-btn ${robotMode === 'SIMULATION' ? 'active' : ''}`}
            >
              SIMULATION
            </button>
            <button
              onClick={() => handleModeChange('LIVE')}
              className={`mode-btn live ${robotMode === 'LIVE' ? 'active' : ''}`}
            >
              LIVE ROBOT
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="header-icon-btn"
            title={soundEnabled ? 'Mute audio' : 'Unmute audio'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Notification Bell with Badge & Drawer */}
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={handleMarkNotifRead}
            onMarkAllRead={handleMarkAllRead}
          />

          {/* Emergency Stop Button */}
          <button
            onClick={drivesEnergized ? handleEmergencyStop : handleResetDrives}
            className={`btn-header-estop ${!drivesEnergized ? 'reset' : ''}`}
            title={drivesEnergized ? 'Emergency Stop (Clamp Brakes)' : 'Reset E-Stop Relay'}
          >
            <AlertOctagon size={16} />
            <span>{drivesEnergized ? 'E-STOP' : 'RESET DRIVES'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="main-viewport-grid">
        {/* Left: 3D Digital Twin Simulation Viewport */}
        <section className="viewport-column">
          <ThreeViewport
            jointAngles={viewportActualAngles}
            targetJoints={viewportTargetAngles}
            controlMode="JOINTS"
            isPreviewActive={isPreviewActive}
            robotStatus={robotStatus}
            robotMode={robotMode}
            commandId={activeCommandState?.command_id}
            isPoweredOn={drivesEnergized}
            isWelding={false}
            selectedMetalKey="carbon_steel"
            selectedShapeKey="circle_pipe"
            speedOverride={50}
            autoStepName="CLOSED-LOOP FEEDBACK"
            cameraPreset={cameraPreset}
            setCameraPreset={setCameraPreset}
          />
        </section>

        {/* Right: Joint Control & Command Center */}
        <section className="control-column">
          <JointControlPanel
            targetJoints={targetJoints}
            actualJoints={actualJoints}
            onTargetChange={handleTargetChange}
            onApplyPreset={handleApplyPreset}
            onSyncWithRobot={handleSyncWithRobot}
            onPreviewToggle={handlePreviewToggle}
            isPreviewActive={isPreviewActive}
            onSendCommand={handleSendCommandClick}
            onEmergencyStop={handleEmergencyStop}
            onResetDrives={handleResetDrives}
            robotMode={robotMode}
            robotStatus={robotStatus}
            drivesEnergized={drivesEnergized}
            activeCommandState={activeCommandState}
          />
        </section>
      </main>

      {/* Bottom Tabs Drawer: History, Notifications, Telemetry, Audit Logs */}
      <section className="bottom-workspace-tabs">
        <div className="tabs-header-bar">
          <div className="tabs-nav-buttons">
            <button
              onClick={() => { setActiveBottomTab('history'); fetchCommandHistory(); }}
              className={`tab-nav-item ${activeBottomTab === 'history' ? 'active' : ''}`}
            >
              <History size={14} />
              Command History ({commandHistory.length})
            </button>

            <button
              onClick={() => { setActiveBottomTab('notifications'); fetchNotifications(); }}
              className={`tab-nav-item ${activeBottomTab === 'notifications' ? 'active' : ''}`}
            >
              <CheckCircle2 size={14} />
              Notifications Archive ({notifications.length})
            </button>

            <button
              onClick={() => setActiveBottomTab('telemetry')}
              className={`tab-nav-item ${activeBottomTab === 'telemetry' ? 'active' : ''}`}
            >
              <Activity size={14} />
              Verified Telemetry Stream
            </button>

            <button
              onClick={() => { setActiveBottomTab('audit'); fetchAuditLogs(); }}
              className={`tab-nav-item ${activeBottomTab === 'audit' ? 'active' : ''}`}
            >
              <Shield size={14} />
              Audit Trail
            </button>
          </div>
        </div>

        <div className="tabs-content-area">
          {activeBottomTab === 'history' && (
            <CommandHistoryTable
              commands={commandHistory}
              onRefresh={fetchCommandHistory}
              isLoading={isHistoryLoading}
            />
          )}

          {activeBottomTab === 'notifications' && (
            <div className="notifications-archive-panel">
              <div className="archive-header">
                <span className="text-sm font-semibold text-slate-800">
                  All System Notifications ({notifications.length} logged in database)
                </span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="btn-secondary text-xs">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="archive-grid">
                {notifications.map((n) => (
                  <div key={n.id || n.event_id} className={`archive-card notif-${(n.severity || 'INFO').toLowerCase()}`}>
                    <div className="archive-card-top">
                      <span className="archive-badge">{n.type}</span>
                      <span className="archive-time text-xs text-slate-500">
                        {n.created_at ? new Date(n.created_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <h4 className="archive-title">{n.title}</h4>
                    <p className="archive-message">{n.message}</p>
                    {n.command_id && (
                      <span className="archive-cmd text-xs font-mono text-slate-600">
                        ID: {n.command_id}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeBottomTab === 'telemetry' && (
            <div className="telemetry-panel">
              <div className="telemetry-summary-cards">
                {['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((ax) => {
                  const act = actualJoints[ax] ?? 0.0;
                  const tgt = targetJoints[ax] ?? 0.0;
                  const err = Math.abs(act - tgt);
                  return (
                    <div key={ax} className="telemetry-stat-card">
                      <div className="stat-card-title">{ax.toUpperCase()} Servomotor</div>
                      <div className="stat-card-main-val font-mono">{act.toFixed(2)} deg</div>
                      <div className="stat-card-sub text-xs text-slate-500">
                        Target: {tgt.toFixed(2)} deg | Delta: {err.toFixed(3)} deg
                      </div>
                      <div className="telemetry-bar-bg">
                        <div
                          className="telemetry-bar-fill"
                          style={{ width: `${Math.min(100, (Math.abs(act) / 185) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeBottomTab === 'audit' && (
            <div className="audit-table-container">
              <table className="kuka-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Resource Type</th>
                    <th>Resource ID</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="table-empty">No audit records found.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-xs text-slate-500 whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                        </td>
                        <td className="font-mono text-xs font-semibold text-slate-800">{log.action}</td>
                        <td className="text-xs text-slate-600">{log.resource_type}</td>
                        <td className="text-xs font-mono text-slate-700">{log.resource_id || '-'}</td>
                        <td className="text-xs text-slate-600 max-w-md truncate">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
