import { db, isSyncRecordQueueItem, type SyncQueueItem } from '../../db/schema';

export const getString = (value: unknown) => typeof value === 'string' ? value : undefined;
export const getTimestamp = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  return 0;
};

export const getCurrentUserId = () => localStorage.getItem('grainfolio_user_id');
export const getSyncWatermarkKey = (userId: string) => `grainfolio_last_sync_${userId}`;
export const queueBelongsToUser = (item: SyncQueueItem, userId: string) => (
  item.userId === userId ||
  (isSyncRecordQueueItem(item) && !item.userId && (item.payload?.userId === userId || item.payload?.user_id === userId))
);

export const getUserQueue = async (userId: string) => {
  const queue = await db.syncQueue.orderBy('timestamp').toArray();
  return queue.filter(item => queueBelongsToUser(item, userId));
};

export const getReadyUserQueue = async (userId: string) => {
  const now = Date.now();
  const queue = await getUserQueue(userId);
  return queue.filter(item => (
    item.failureKind !== 'needs_attention' &&
    (!item.nextRetryAt || item.nextRetryAt <= now)
  ));
};

export type SyncQueueSummary = {
  pendingCount: number;
  needsAttentionCount: number;
};

export const summarizeSyncQueue = (queue: SyncQueueItem[], userId: string | null): SyncQueueSummary => {
  if (!userId) return { pendingCount: 0, needsAttentionCount: 0 };
  return queue
    .filter(item => queueBelongsToUser(item, userId))
    .reduce<SyncQueueSummary>((summary, item) => {
      if (item.failureKind === 'needs_attention') {
        summary.needsAttentionCount += 1;
      } else {
        summary.pendingCount += 1;
      }
      return summary;
    }, { pendingCount: 0, needsAttentionCount: 0 });
};
