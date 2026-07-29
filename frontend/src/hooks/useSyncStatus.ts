import { useEffect, useState } from 'react';
import { SYNC_STATUS_EVENT, SyncService, type SyncStatusState } from '../services/syncService';

const getInitialStatus = (): SyncStatusState => {
  if (!SyncService.isAutoSyncEnabled()) return 'local';
  return navigator.onLine ? 'synced' : 'offline';
};

export const useSyncStatus = () => {
  const [status, setStatus] = useState<SyncStatusState>(getInitialStatus);

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatusState>).detail;
      if (detail) setStatus(detail);
    };

    window.addEventListener(SYNC_STATUS_EVENT, handleStatus as EventListener);
    return () => {
      window.removeEventListener(SYNC_STATUS_EVENT, handleStatus as EventListener);
    };
  }, []);

  return status;
};
