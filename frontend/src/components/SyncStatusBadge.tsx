import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CloudOff, RefreshCw, TriangleAlert, HardDriveDownload } from 'lucide-react';
import { useSyncQueueSummary, useSyncStatus } from '../hooks/useSyncStatus';
import { useLanguage } from '../contexts/useLanguage';
import { SyncIssuesModal } from './SyncIssuesModal';
import './SyncStatusBadge.css';

export const SyncStatusBadge: React.FC = () => {
  const status = useSyncStatus();
  const { t } = useLanguage();
  const { pendingCount, needsAttentionCount } = useSyncQueueSummary(status);
  const [isIssuesOpen, setIsIssuesOpen] = useState(false);
  const count = status === 'needs_attention' ? needsAttentionCount : pendingCount;
  const statusCopy = {
    local: t('syncStatus.local'),
    offline: t('syncStatus.offline'),
    pending: t('syncStatus.pending'),
    syncing: t('syncStatus.syncing'),
    synced: t('syncStatus.synced'),
    needs_attention: t('syncStatus.needsAttention'),
  } as const;
  const label = count > 0 && (status === 'pending' || status === 'syncing' || status === 'offline' || status === 'needs_attention')
    ? `${statusCopy[status]} (${count})`
    : statusCopy[status];

  const icon = status === 'local'
    ? <HardDriveDownload size={14} />
    : status === 'offline'
      ? <CloudOff size={14} />
      : status === 'syncing'
        ? <RefreshCw size={14} className="sync-status-badge-spin" />
        : status === 'needs_attention'
          ? <TriangleAlert size={14} />
          : <span className="sync-status-badge-dot" aria-hidden="true" />;

  const content = (
    <>
      <span className="sync-status-badge-icon">{icon}</span>
      <span>{label}</span>
    </>
  );

  return (
    <>
      {status === 'needs_attention' && needsAttentionCount > 0 ? (
        <button
          type="button"
          className={`sync-status-badge ${status} sync-status-badge-action`}
          title={label}
          onClick={() => setIsIssuesOpen(true)}
          aria-haspopup="dialog"
          aria-label={label}
        >
          {content}
        </button>
      ) : (
    <div
      className={`sync-status-badge ${status}`}
      title={label}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {content}
    </div>
      )}
      {isIssuesOpen && createPortal(
        <SyncIssuesModal isOpen={isIssuesOpen} onClose={() => setIsIssuesOpen(false)} />,
        document.body,
      )}
    </>
  );
};
