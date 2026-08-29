import React from 'react';
import { History, CheckCircle2, Clock, AlertTriangle, AlertOctagon, RefreshCw } from 'lucide-react';

export default function CommandHistoryTable({ commands = [], onRefresh, isLoading = false }) {
  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED') {
      return (
        <span className="badge badge-success">
          <CheckCircle2 size={12} />
          Completed
        </span>
      );
    }
    if (s === 'MOVING' || s === 'SENT_TO_ROBOT' || s === 'QUEUED') {
      return (
        <span className="badge badge-info">
          <Clock size={12} />
          {s === 'MOVING' ? 'Moving' : 'Queued'}
        </span>
      );
    }
    if (s === 'TIMEOUT') {
      return (
        <span className="badge badge-warning">
          <AlertTriangle size={12} />
          Timeout
        </span>
      );
    }
    return (
      <span className="badge badge-error">
        <AlertOctagon size={12} />
        {s || 'Failed'}
      </span>
    );
  };

  const formatJoints = (j) => {
    if (!j) return '-';
    if (typeof j === 'string') {
      try {
        j = JSON.parse(j);
      } catch (e) {
        return j;
      }
    }
    return ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']
      .filter((k) => j[k] !== undefined)
      .map((k) => `${k.toUpperCase()}=${Number(j[k]).toFixed(1)} deg`)
      .join(', ');
  };

  return (
    <div className="history-table-card">
      <div className="history-table-header">
        <div className="flex items-center gap-2">
          <History size={16} className="text-slate-600" />
          <h3 className="history-title">Command Execution History</h3>
          <span className="history-count">({commands.length} records)</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="btn-table-refresh"
          title="Refresh command history"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="table-responsive">
        <table className="kuka-table">
          <thead>
            <tr>
              <th>Command ID</th>
              <th>Mode</th>
              <th>Target Position</th>
              <th>Actual Reached Position</th>
              <th>Status</th>
              <th>Submitted Time</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {commands.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  No commands recorded in session.
                </td>
              </tr>
            ) : (
              commands.map((cmd) => (
                <tr key={cmd.command_id || cmd.id}>
                  <td className="font-mono text-slate-800 font-medium">
                    {cmd.command_id}
                  </td>
                  <td>
                    <span className="mode-pill">{cmd.mode || 'LIVE'}</span>
                  </td>
                  <td className="text-slate-700 text-xs max-w-xs truncate">
                    {formatJoints(cmd.target_joints)}
                  </td>
                  <td className="text-slate-700 text-xs max-w-xs truncate">
                    {formatJoints(cmd.actual_joints)}
                  </td>
                  <td>{getStatusBadge(cmd.status)}</td>
                  <td className="text-slate-600 text-xs whitespace-nowrap">
                    {cmd.created_at ? new Date(cmd.created_at).toLocaleTimeString() : '-'}
                  </td>
                  <td className="text-slate-600 text-xs whitespace-nowrap">
                    {cmd.duration !== undefined && cmd.duration !== null ? `${cmd.duration}s` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
