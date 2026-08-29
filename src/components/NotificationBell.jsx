import React, { useState } from 'react';
import { Bell, CheckCheck, CheckCircle2, AlertTriangle, AlertOctagon, Info, X, Filter } from 'lucide-react';

export default function NotificationBell({
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');

  const filterOptions = [
    { key: 'ALL', label: 'All' },
    { key: 'SUCCESS', label: 'Success' },
    { key: 'WARNING', label: 'Warnings' },
    { key: 'ERROR', label: 'Errors' },
    { key: 'ROBOT', label: 'Robot Events' },
    { key: 'COMMAND', label: 'Command Events' }
  ];

  const filteredList = notifications.filter((notif) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'SUCCESS') return notif.severity === 'SUCCESS';
    if (activeFilter === 'WARNING') return notif.severity === 'WARNING';
    if (activeFilter === 'ERROR') return notif.severity === 'ERROR' || notif.severity === 'CRITICAL';
    if (activeFilter === 'ROBOT') return notif.type?.startsWith('ROBOT') || notif.event?.startsWith('ROBOT');
    if (activeFilter === 'COMMAND') return notif.type?.startsWith('COMMAND') || notif.event?.startsWith('COMMAND');
    return true;
  });

  return (
    <div className="notification-bell-root">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bell-trigger-btn"
        title="View Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="bell-badge-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="notification-backdrop" onClick={() => setIsOpen(false)} />
          <div className="notification-drawer">
            {/* Drawer Header */}
            <div className="drawer-header">
              <div className="drawer-title-group">
                <Bell size={18} className="text-slate-700" />
                <h3 className="drawer-title">Notifications</h3>
                <span className="drawer-count-chip">{notifications.length} total</span>
              </div>
              <div className="drawer-actions">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="mark-all-read-btn"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="drawer-close-btn"
                  title="Close panel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="drawer-filters">
              {filterOptions.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`filter-pill ${activeFilter === f.key ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div className="drawer-list">
              {filteredList.length === 0 ? (
                <div className="empty-notifications">
                  <Info size={24} className="text-slate-400 mb-2" />
                  <p>No notifications match this filter</p>
                </div>
              ) : (
                filteredList.map((n) => {
                  const severity = (n.severity || 'INFO').toUpperCase();
                  let IconComponent = Info;
                  let colorClass = 'notif-info';

                  if (severity === 'SUCCESS') {
                    IconComponent = CheckCircle2;
                    colorClass = 'notif-success';
                  } else if (severity === 'WARNING') {
                    IconComponent = AlertTriangle;
                    colorClass = 'notif-warning';
                  } else if (severity === 'ERROR' || severity === 'CRITICAL') {
                    IconComponent = AlertOctagon;
                    colorClass = 'notif-error';
                  }

                  const timeStr = n.timestamp || n.created_at;
                  const formattedTime = timeStr ? new Date(timeStr).toLocaleTimeString() : '';

                  return (
                    <div
                      key={n.id || n.event_id}
                      className={`notification-item ${colorClass} ${!n.read ? 'unread' : 'read'}`}
                      onClick={() => !n.read && onMarkRead && onMarkRead(n.event_id || n.id)}
                    >
                      <div className="notif-icon">
                        <IconComponent size={16} />
                      </div>
                      <div className="notif-content">
                        <div className="notif-top">
                          <span className="notif-title">{n.title}</span>
                          <span className="notif-time">{formattedTime}</span>
                        </div>
                        <p className="notif-message">{n.message}</p>
                        {n.command_id && (
                          <div className="notif-footer">
                            <span className="notif-cmd-tag">{n.command_id}</span>
                            {n.metadata?.error !== undefined && (
                              <span className="notif-err-tag">
                                Error: {n.metadata.error} deg
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {!n.read && <span className="unread-dot" title="Unread" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
