import React from 'react';
import { CloudOff, RefreshCw, TriangleAlert, HardDriveDownload } from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import './SyncStatusBadge.css';

interface SyncStatusBadgeProps {
  compact?: boolean;
}

const statusCopy = {
  local: '本地模式',
  offline: '离线等待',
  syncing: '同步中',
  synced: '已同步',
  error: '稍后重试',
} as const;

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ compact = false }) => {
  const status = useSyncStatus();

  const icon = status === 'local'
    ? <HardDriveDownload size={14} />
    : status === 'offline'
      ? <CloudOff size={14} />
      : status === 'syncing'
        ? <RefreshCw size={14} className="sync-status-badge-spin" />
        : status === 'error'
          ? <TriangleAlert size={14} />
          : <span className="sync-status-badge-dot" aria-hidden="true" />;

  return (
    <div className={`sync-status-badge ${status} ${compact ? 'compact' : ''}`}>
      <span className="sync-status-badge-icon">{icon}</span>
      <span>{statusCopy[status]}</span>
    </div>
  );
};
