import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  X,
  Search,
  Check,
  Sparkles,
  ExternalLink
} from 'lucide-react';

function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const now = new Date();
  const past = new Date(dateInput);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  return past.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationBell({
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onOpenArchive,
  onSimulateAlert
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'CRITICAL'
  const rootRef = useRef(null);

  // Close on outside click or ESC key
  useEffect(() => {
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Tab counts
  const counts = useMemo(() => {
    let unread = 0;
    let critical = 0;
    notifications.forEach((n) => {
      if (!n.read) unread += 1;
      const s = (n.severity || 'INFO').toUpperCase();
      if (s === 'CRITICAL' || s === 'ERROR') critical += 1;
    });
    return { all: notifications.length, unread, critical };
  }, [notifications]);

  // Filtered notifications
  const filteredList = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === 'UNREAD' && n.read) return false;
      if (activeTab === 'CRITICAL') {
        const s = (n.severity || 'INFO').toUpperCase();
        if (s !== 'CRITICAL' && s !== 'ERROR') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = n.title?.toLowerCase().includes(q);
        const msgMatch = n.message?.toLowerCase().includes(q);
        const cmdMatch = n.command_id?.toLowerCase().includes(q);
        if (!titleMatch && !msgMatch && !cmdMatch) return false;
      }

      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  return (
    <div className="mnc-bell-root" ref={rootRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`mnc-bell-btn ${isOpen ? 'active' : ''}`}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={16} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="mnc-bell-dot" title={`${unreadCount} unread`} />
        )}
      </button>

      {/* Linear / Stripe Dropdown Popover */}
      {isOpen && (
        <div className="mnc-popover" role="dialog" aria-label="Notification Center">
          {/* Header */}
          <div className="mnc-popover-header">
            <div className="mnc-header-title-row">
              <div className="mnc-header-left">
                <span className="mnc-title">Notifications</span>
                {unreadCount > 0 ? (
                  <span className="mnc-unread-badge">{unreadCount}</span>
                ) : (
                  <span className="mnc-all-read-text">All read</span>
                )}
              </div>

              <div className="mnc-header-actions">
                {onSimulateAlert && (
                  <button
                    onClick={onSimulateAlert}
                    className="mnc-action-link"
                    title="Simulate enterprise alert"
                  >
                    <Sparkles size={12} className="text-amber-500" />
                    <span>Test</span>
                  </button>
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="mnc-action-link"
                    title="Mark all as read"
                  >
                    <CheckCheck size={13} />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="mnc-close-btn"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Segmented Tab Filter (Linear Style) */}
            <div className="mnc-tabs-row">
              <div className="mnc-segmented-control">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`mnc-segment-btn ${activeTab === 'ALL' ? 'active' : ''}`}
                >
                  All ({counts.all})
                </button>
                <button
                  onClick={() => setActiveTab('UNREAD')}
                  className={`mnc-segment-btn ${activeTab === 'UNREAD' ? 'active' : ''}`}
                >
                  Unread ({counts.unread})
                </button>
                <button
                  onClick={() => setActiveTab('CRITICAL')}
                  className={`mnc-segment-btn ${activeTab === 'CRITICAL' ? 'active' : ''}`}
                >
                  Critical ({counts.critical})
                </button>
              </div>

              {/* Minimal Search Input */}
              <div className="mnc-search-wrap">
                <Search size={12} className="mnc-search-icon" />
                <input
                  type="text"
                  placeholder="Filter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mnc-search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mnc-search-clear"
                    title="Clear"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="mnc-list-body">
            {filteredList.length === 0 ? (
              <div className="mnc-empty-state">
                <p className="mnc-empty-title">All caught up</p>
                <p className="mnc-empty-desc">
                  {searchQuery
                    ? `No notifications match "${searchQuery}".`
                    : 'No pending alerts. KUKA robot telemetry is nominal.'}
                </p>
              </div>
            ) : (
              filteredList.map((n) => {
                const s = (n.severity || 'INFO').toUpperCase();
                const isCritical = s === 'CRITICAL';
                const isError = s === 'ERROR';
                const isWarning = s === 'WARNING';
                const isSuccess = s === 'SUCCESS';

                let variantClass = 'mnc-card-info';
                let badgeIcon = <Info size={11} strokeWidth={2.6} className="text-white" />;

                if (isSuccess) {
                  variantClass = 'mnc-card-success';
                  badgeIcon = <Check size={11} strokeWidth={2.8} className="text-white" />;
                } else if (isCritical || isError) {
                  variantClass = 'mnc-card-error';
                  badgeIcon = <X size={11} strokeWidth={2.8} className="text-white" />;
                } else if (isWarning) {
                  variantClass = 'mnc-card-warning';
                  badgeIcon = <AlertTriangle size={10} strokeWidth={2.6} className="text-white" />;
                }

                const timeRaw = n.timestamp || n.created_at;
                const relTime = formatRelativeTime(timeRaw);

                return (
                  <div
                    key={n.id || n.event_id}
                    className={`mnc-item ${variantClass} ${!n.read ? 'is-unread' : ''}`}
                    onClick={() => !n.read && onMarkRead && onMarkRead(n.event_id || n.id)}
                  >
                    {/* Solid Circular Status Badge */}
                    <div className="mnc-icon-badge" style={{ width: '18px', height: '18px', marginTop: '2px' }}>
                      {badgeIcon}
                    </div>

                    {/* Notification Body */}
                    <div className="mnc-item-body">
                      <div className="mnc-item-headline">
                        <span className="mnc-item-title">{n.title}</span>
                        {isCritical && <span className="mnc-critical-badge">SAFETY</span>}
                        {n.command_id && (
                          <span className="mnc-item-cmd font-mono">{n.command_id}</span>
                        )}
                        <span className="mnc-item-time">{relTime}</span>
                      </div>

                      {n.message && <p className="mnc-item-desc">{n.message}</p>}

                      {(n.metadata?.error !== undefined || n.payload?.duration) && (
                        <div className="mnc-item-meta">
                          {n.payload?.duration && (
                            <span>Duration: {n.payload.duration}s</span>
                          )}
                          {n.metadata?.error !== undefined && (
                            <span>Deviation: {n.metadata.error}°</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quiet Hover Actions */}
                    <div className="mnc-item-actions">
                      {!n.read && onMarkRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead(n.event_id || n.id);
                          }}
                          className="mnc-item-btn"
                          title="Mark as read"
                        >
                          <Check size={12} />
                        </button>
                      )}
                      {onDeleteNotification && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotification(n.event_id || n.id);
                          }}
                          className="mnc-item-btn"
                          title="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {onOpenArchive && (
            <div className="mnc-popover-footer">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenArchive();
                }}
                className="mnc-archive-link"
              >
                <span>View full audit history</span>
                <ExternalLink size={11} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
