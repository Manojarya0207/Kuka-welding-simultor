import React, { useState, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Activity,
  Search,
  Download,
  Clock,
  Check,
  X,
  RefreshCw,
  Filter
} from 'lucide-react';

export default function NotificationsArchiveTable({
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onRefresh,
  isLoading = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Compute counts
  const counts = useMemo(() => {
    const res = {
      ALL: notifications.length,
      UNREAD: 0,
      ERROR: 0,
      WARNING: 0,
      SUCCESS: 0,
      ROBOT: 0
    };
    notifications.forEach((n) => {
      if (!n.read) res.UNREAD += 1;
      const sev = (n.severity || 'INFO').toUpperCase();
      if (sev === 'ERROR' || sev === 'CRITICAL') res.ERROR += 1;
      else if (sev === 'WARNING') res.WARNING += 1;
      else if (sev === 'SUCCESS') res.SUCCESS += 1;

      const isRobot = n.type?.startsWith('ROBOT') || n.event?.startsWith('ROBOT');
      if (isRobot) res.ROBOT += 1;
    });
    return res;
  }, [notifications]);

  // Filter list
  const filteredList = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'UNREAD' && n.read) return false;
      if (activeFilter === 'ERROR' && !(n.severity === 'ERROR' || n.severity === 'CRITICAL')) return false;
      if (activeFilter === 'WARNING' && n.severity !== 'WARNING') return false;
      if (activeFilter === 'SUCCESS' && n.severity !== 'SUCCESS') return false;
      if (activeFilter === 'ROBOT') {
        const isRobot = n.type?.startsWith('ROBOT') || n.event?.startsWith('ROBOT');
        if (!isRobot) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = n.title?.toLowerCase().includes(q);
        const msgMatch = n.message?.toLowerCase().includes(q);
        const cmdMatch = n.command_id?.toLowerCase().includes(q);
        const typeMatch = n.type?.toLowerCase().includes(q) || n.event?.toLowerCase().includes(q);
        if (!titleMatch && !msgMatch && !cmdMatch && !typeMatch) return false;
      }

      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notifications, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `kuka-notifications-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const renderSeverityBadge = (severity, type) => {
    const s = (severity || 'INFO').toUpperCase();
    const isRobot = type?.startsWith('ROBOT');

    if (s === 'SUCCESS') {
      return (
        <span className="notif-badge-pill pill-success">
          <CheckCircle2 size={11} />
          SUCCESS
        </span>
      );
    }
    if (s === 'WARNING') {
      return (
        <span className="notif-badge-pill pill-warning">
          <AlertTriangle size={11} />
          WARNING
        </span>
      );
    }
    if (s === 'ERROR' || s === 'CRITICAL') {
      return (
        <span className="notif-badge-pill pill-error">
          <AlertOctagon size={11} />
          {s === 'CRITICAL' ? 'CRITICAL' : 'ERROR'}
        </span>
      );
    }
    if (isRobot) {
      return (
        <span className="notif-badge-pill pill-robot">
          <Activity size={11} />
          ROBOT
        </span>
      );
    }
    return (
      <span className="notif-badge-pill pill-info">
        <Info size={11} />
        INFO
      </span>
    );
  };

  return (
    <div className="notif-archive-container">
      {/* Archive Header / Controls Bar */}
      <div className="notif-archive-toolbar">
        <div className="archive-toolbar-left">
          <div className="archive-title-group">
            <Bell size={16} className="text-slate-600" />
            <h3 className="archive-panel-title">System Event & Notification Audit</h3>
            <span className="archive-count-chip">{notifications.length} events logged</span>
          </div>

          {/* Quick Search */}
          <div className="archive-search-box">
            <Search size={13} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="archive-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="search-clear-btn" title="Clear">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="archive-toolbar-right">
          {/* Action Buttons */}
          {unreadCount > 0 && onMarkAllRead && (
            <button onClick={onMarkAllRead} className="btn-archive-action" title="Mark all as read">
              <CheckCheck size={13} />
              <span>Mark all read</span>
            </button>
          )}

          <button onClick={handleExportJSON} className="btn-archive-action" title="Export audit log to JSON">
            <Download size={13} />
            <span>Export JSON</span>
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`btn-archive-action ${isLoading ? 'opacity-70' : ''}`}
              title="Refresh log"
              disabled={isLoading}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notif-archive-filter-row">
        <button
          onClick={() => setActiveFilter('ALL')}
          className={`archive-filter-pill ${activeFilter === 'ALL' ? 'active' : ''}`}
        >
          All ({counts.ALL})
        </button>
        {counts.UNREAD > 0 && (
          <button
            onClick={() => setActiveFilter('UNREAD')}
            className={`archive-filter-pill ${activeFilter === 'UNREAD' ? 'active' : ''}`}
          >
            Unread ({counts.UNREAD})
          </button>
        )}
        {counts.ERROR > 0 && (
          <button
            onClick={() => setActiveFilter('ERROR')}
            className={`archive-filter-pill pill-err ${activeFilter === 'ERROR' ? 'active' : ''}`}
          >
            Errors ({counts.ERROR})
          </button>
        )}
        {counts.WARNING > 0 && (
          <button
            onClick={() => setActiveFilter('WARNING')}
            className={`archive-filter-pill pill-warn ${activeFilter === 'WARNING' ? 'active' : ''}`}
          >
            Warnings ({counts.WARNING})
          </button>
        )}
        {counts.SUCCESS > 0 && (
          <button
            onClick={() => setActiveFilter('SUCCESS')}
            className={`archive-filter-pill pill-suc ${activeFilter === 'SUCCESS' ? 'active' : ''}`}
          >
            Success ({counts.SUCCESS})
          </button>
        )}
        {counts.ROBOT > 0 && (
          <button
            onClick={() => setActiveFilter('ROBOT')}
            className={`archive-filter-pill pill-rob ${activeFilter === 'ROBOT' ? 'active' : ''}`}
          >
            Robot ({counts.ROBOT})
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="notif-table-wrapper">
        <table className="notif-archive-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Timestamp</th>
              <th style={{ width: '100px' }}>Severity</th>
              <th style={{ width: '120px' }}>Event Type</th>
              <th style={{ width: '90px' }}>Command</th>
              <th>Message & Details</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Status</th>
              <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={7} className="notif-empty-table-cell">
                  <div className="empty-table-content">
                    <Filter size={20} className="text-slate-400 mb-1" />
                    <span>No notifications matching current filters</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredList.map((n) => {
                const timeStr = n.timestamp || n.created_at;
                const formattedTime = timeStr
                  ? new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '-';
                const formattedDate = timeStr ? new Date(timeStr).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

                return (
                  <tr
                    key={n.id || n.event_id}
                    className={`archive-row ${!n.read ? 'row-unread' : 'row-read'}`}
                  >
                    {/* Timestamp */}
                    <td className="cell-timestamp">
                      <span className="timestamp-time">{formattedTime}</span>
                      <span className="timestamp-date">{formattedDate}</span>
                    </td>

                    {/* Severity */}
                    <td>{renderSeverityBadge(n.severity, n.type || n.event)}</td>

                    {/* Event Type */}
                    <td>
                      <span className="cell-event-tag">{n.type || n.event || 'SYSTEM'}</span>
                    </td>

                    {/* Command */}
                    <td>
                      {n.command_id ? (
                        <span className="cell-cmd-tag font-mono">{n.command_id}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Message & Title */}
                    <td className="cell-message-block">
                      <span className="row-title">{n.title}</span>
                      <span className="row-desc">{n.message}</span>
                      {(n.metadata?.error !== undefined || n.payload?.duration) && (
                        <span className="row-meta">
                          {n.metadata?.error !== undefined && `Deviation: ${n.metadata.error}° `}
                          {n.payload?.duration && `Duration: ${n.payload.duration}s`}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      {!n.read ? (
                        <span className="status-pill unread">Unread</span>
                      ) : (
                        <span className="status-pill read">Read</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions-group">
                        {!n.read && onMarkRead && (
                          <button
                            onClick={() => onMarkRead(n.event_id || n.id)}
                            className="btn-row-action"
                            title="Mark as read"
                          >
                            <Check size={13} />
                          </button>
                        )}
                        {onDeleteNotification && (
                          <button
                            onClick={() => onDeleteNotification(n.event_id || n.id)}
                            className="btn-row-action btn-row-delete"
                            title="Dismiss notification"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
