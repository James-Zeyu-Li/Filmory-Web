import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import {
  SYNC_STATUS_EVENT,
  SyncService,
  summarizeSyncQueue,
  type SyncQueueSummary,
  type SyncStatusState,
} from '../services/syncService';

const getInitialStatus = (): SyncStatusState => SyncService.getStatus();

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

export const useSyncQueueSummary = (status: SyncStatusState): SyncQueueSummary => {
  return useLiveQuery(
    async () => {
      const queue = await db.syncQueue.orderBy('timestamp').toArray();
      return summarizeSyncQueue(queue, localStorage.getItem('grainfolio_user_id'));
    },
    [status],
    { pendingCount: 0, needsAttentionCount: 0 },
  );
};
