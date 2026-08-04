import React from 'react';
import { CloudOff, RefreshCw, TriangleAlert, HardDriveDownload } from 'lucide-react';
import { useSyncQueueSummary, useSyncStatus } from '../hooks/useSyncStatus';
import './SyncStatusBadge.css';

const statusCopy = {
  local: '本地模式',
  offline: '离线等待',
  pending: '待同步',
  syncing: '同步中',
  synced: '已同步',
  needs_attention: '需要处理',
} as const;

export const SyncStatusBadge: React.FC = () => {
  const status = useSyncStatus();
  const { pendingCount, needsAttentionCount } = useSyncQueueSummary(status);
  const count = status === 'needs_attention' ? needsAttentionCount : pendingCount;
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

  return (
    <div
      className={`sync-status-badge ${status}`}
      title={label}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sync-status-badge-icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
};
