import { supabase } from './supabaseClient';
import {
  db,
  isSyncOperationQueueItem,
  isSyncRecordQueueItem,
  type FilmStock,
  type SyncQueueItem,
  type SyncRecordQueueItem,
} from '../db/schema';
import {
  getSyncIntentFromEvent,
  LOCAL_CHANGE_EVENT,
  type SyncIntent,
} from './syncEvents';
import { recordSyncDiagnostic } from './syncDiagnostics';
import { hasAutoSyncFlag, hasValidSupabaseKeyPair } from './sync/config';
import {
  convertKeysToCamelCase,
  convertKeysToSnakeCase,
  getSyncTable,
  isFilmStockSyncRow,
  isSyncRecord,
  isSyncTableName,
  supabaseTables,
  tableMap,
  type SyncRecord,
  type SyncRow,
  type SyncTableName,
} from './sync/keyCaseMapping';
import {
  getCurrentUserId,
  getReadyUserQueue,
  getString,
  getSyncWatermarkKey,
  getTimestamp,
  getUserQueue,
  queueBelongsToUser,
  summarizeSyncQueue,
  type SyncQueueSummary,
} from './sync/queueUtils';
import {
  applyInventoryOperationResult,
  getPendingInventoryDeltas,
  pushInventoryOperation,
} from './sync/inventoryOperations';
import {
  recoverFilmStockMetadataSchemaFailures,
  recoverLegacyInventoryRpcFailures,
} from './sync/schemaCacheRecovery';
import {
  classifySyncFailure,
  getErrorDetails,
  getRetryDelayMs,
  RETRY_SYNC_DELAY_MS,
  SyncPushError,
  type SyncFailure,
} from './sync/failureClassification';

export { summarizeSyncQueue, type SyncQueueSummary } from './sync/queueUtils';

export const SYNC_STATUS_EVENT = 'grainfolio-sync-status';
export type SyncStatusState = 'local' | 'offline' | 'pending' | 'syncing' | 'synced' | 'needs_attention';
type SyncPullResult = {
  remoteUserProfileFound: boolean;
};
const SYNC_DEBOUNCE_MS = 500;
const RESUME_SYNC_DEBOUNCE_MS = 400;
const VISIBLE_FALLBACK_POLL_INTERVAL_MS = 60_000;
const REALTIME_STARTUP_TIMEOUT_MS = 3_000;
const REALTIME_SUBSCRIBED_STATUS = 'SUBSCRIBED';
const REALTIME_RETRY_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);
const SYNC_INTENT_DELAYS: Record<SyncIntent, number> = {
  debounced: SYNC_DEBOUNCE_MS,
  immediate: 0,
  background: RESUME_SYNC_DEBOUNCE_MS,
};
let currentSyncStatus: SyncStatusState = 'local';

type SyncTrigger = {
  intent: SyncIntent;
  reason: string;
};

const countSyncIntents = (triggers: SyncTrigger[]): Partial<Record<SyncIntent, number>> => (
  triggers.reduce<Partial<Record<SyncIntent, number>>>((counts, trigger) => {
    counts[trigger.intent] = (counts[trigger.intent] || 0) + 1;
    return counts;
  }, {})
);

const dispatchSyncStatus = (status: SyncStatusState) => {
  currentSyncStatus = status;
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: status }));
};

export class SyncService {
  private static activeUserId: string | null = null;
  private static activeCleanup: (() => void) | null = null;
  private static scheduledSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private static retryTimer: ReturnType<typeof setTimeout> | null = null;
  private static visiblePollTimer: ReturnType<typeof setInterval> | null = null;
  private static inFlightSync: Promise<void> | null = null;
  private static shouldRunAgain = false;
  private static pendingSyncTriggers: SyncTrigger[] = [];
  private static nextSyncRunId = 1;
  private static activeSyncRunId: number | undefined;
  private static realtimeLifecycleId = 0;
  private static isRealtimeSubscribed = false;
  private static isRealtimeFallbackRequired = false;
  private static isStartupSyncPending = false;
  private static startupSyncTimer: ReturnType<typeof setTimeout> | null = null;

  static isAutoSyncEnabled(): boolean {
    return hasAutoSyncFlag() && hasValidSupabaseKeyPair();
  }

  static getStatus(): SyncStatusState {
    if (!this.isAutoSyncEnabled()) return 'local';
    if (!navigator.onLine) return 'offline';
    return currentSyncStatus === 'local' ? 'syncing' : currentSyncStatus;
  }

  static async getQueueSummary(userId = getCurrentUserId()): Promise<SyncQueueSummary> {
    const queue = await db.syncQueue.orderBy('timestamp').toArray();
    return summarizeSyncQueue(queue, userId);
  }

  private static async refreshQueueAwareStatus(
    fallback: SyncStatusState = 'synced',
    allowDuringSync = false,
  ): Promise<void> {
    const activeUserId = this.activeUserId;
    const summary = await this.getQueueSummary(this.activeUserId || undefined);
    if (activeUserId !== this.activeUserId || (!allowDuringSync && this.inFlightSync)) return;
    if (summary.needsAttentionCount > 0) {
      dispatchSyncStatus('needs_attention');
      return;
    }
    if (summary.pendingCount > 0) {
      dispatchSyncStatus('pending');
      this.scheduleRetryForQueuedWork();
      return;
    }
    dispatchSyncStatus(fallback);
  }

  private static scheduleRetryForQueuedWork(): void {
    const userId = this.activeUserId;
    if (!userId || this.retryTimer) return;

    void getUserQueue(userId).then(queue => {
      const nextRetryAt = queue
        .filter(item => item.failureKind === 'retryable' && item.nextRetryAt)
        .reduce<number | null>((earliest, item) => (
          earliest === null || item.nextRetryAt! < earliest ? item.nextRetryAt! : earliest
        ), null);
      if (nextRetryAt === null || !this.activeUserId || this.retryTimer) return;

      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.requestSyncIntent('background', 'retry', 0);
      }, Math.max(0, nextRetryAt - Date.now()));
    });
  }

  private static async markQueueFailure(
    queueIds: number[],
    items: SyncQueueItem[],
    failure: SyncFailure,
  ): Promise<number | null> {
    const now = Date.now();
    let earliestRetryAt: number | null = null;

    await Promise.all(queueIds.map(async id => {
      const item = items.find(candidate => candidate.id === id);
      if (!item) return;
      const attemptCount = (item.attemptCount || 0) + 1;
      const nextRetryAt = failure.kind === 'retryable'
        ? now + getRetryDelayMs(attemptCount)
        : undefined;
      if (nextRetryAt !== undefined) {
        earliestRetryAt = earliestRetryAt === null
          ? nextRetryAt
          : Math.min(earliestRetryAt, nextRetryAt);
      }
      await db.syncQueue.update(id, {
        attemptCount,
        failureKind: failure.kind,
        lastErrorCode: failure.code,
        lastErrorMessage: failure.message,
        lastAttemptAt: now,
        nextRetryAt,
      });
    }));

    return earliestRetryAt;
  }

  private static recoverLegacyInventoryRpcFailures(userId: string): Promise<number> {
    return recoverLegacyInventoryRpcFailures(userId);
  }

  private static recoverFilmStockMetadataSchemaFailures(userId: string): Promise<number> {
    return recoverFilmStockMetadataSchemaFailures(userId);
  }

  static start(): void {
    const userId = getCurrentUserId();
    if (!userId) {
      this.stop();
      return;
    }

    if (!this.isAutoSyncEnabled()) {
      this.stop();
      dispatchSyncStatus('local');
      return;
    }

    if (this.activeUserId === userId && this.activeCleanup) return;

    this.stop();
    this.activeUserId = userId;
    this.isStartupSyncPending = true;
    const lifecycleId = this.realtimeLifecycleId;

    const unsubscribeRealtime = this.setupRealtimeSubscription(userId, lifecycleId);

    const handleOnline = () => {
      if (!this.requestStartupSync('online')) {
        this.requestSyncIntent('background', 'online', 0);
      }
      this.updateVisibleFallbackPolling();
    };

    const handleOffline = () => {
      dispatchSyncStatus('offline');
      this.stopVisibleFallbackPolling();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.requestSyncIntent('background', 'visibility', 0);
      }
      this.updateVisibleFallbackPolling();
    };

    const handleLocalChange = (event: Event) => {
      this.requestSyncIntent(getSyncIntentFromEvent(event), 'local-change');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(LOCAL_CHANGE_EVENT, handleLocalChange as EventListener);

    this.activeCleanup = () => {
      unsubscribeRealtime?.();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(LOCAL_CHANGE_EVENT, handleLocalChange as EventListener);
      this.stopVisibleFallbackPolling();
    };

    if (!navigator.onLine) {
      dispatchSyncStatus('offline');
      return;
    }

    dispatchSyncStatus('syncing');
    this.scheduleStartupSyncFallback(userId, lifecycleId);

  }

  static stop(): void {
    this.realtimeLifecycleId += 1;
    this.activeCleanup?.();
    this.activeCleanup = null;
    this.activeUserId = null;
    this.isRealtimeSubscribed = false;
    this.isRealtimeFallbackRequired = false;
    this.isStartupSyncPending = false;
    this.shouldRunAgain = false;
    this.pendingSyncTriggers = [];
    this.activeSyncRunId = undefined;
    this.inFlightSync = null;

    if (this.scheduledSyncTimer) {
      clearTimeout(this.scheduledSyncTimer);
      this.scheduledSyncTimer = null;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.clearStartupSyncTimer();

    this.stopVisibleFallbackPolling();

    dispatchSyncStatus('local');
  }

  private static clearStartupSyncTimer(): void {
    if (this.startupSyncTimer === null) return;
    clearTimeout(this.startupSyncTimer);
    this.startupSyncTimer = null;
  }

  private static requestStartupSync(reason: string): boolean {
    if (!this.isStartupSyncPending || !this.activeUserId) return false;

    this.isStartupSyncPending = false;
    this.clearStartupSyncTimer();
    this.requestSyncIntent('background', reason, 0);
    return true;
  }

  private static scheduleStartupSyncFallback(userId: string, lifecycleId: number): void {
    if (!this.isStartupSyncPending || this.startupSyncTimer !== null) return;

    this.startupSyncTimer = setTimeout(() => {
      this.startupSyncTimer = null;
      if (this.activeUserId !== userId || this.realtimeLifecycleId !== lifecycleId) return;

      this.isRealtimeSubscribed = false;
      this.isRealtimeFallbackRequired = true;
      this.updateVisibleFallbackPolling();
      this.requestStartupSync('realtime-startup-timeout');
    }, REALTIME_STARTUP_TIMEOUT_MS);
  }

  private static updateVisibleFallbackPolling(): void {
    const shouldPoll =
      this.isAutoSyncEnabled() &&
      Boolean(this.activeUserId) &&
      !this.isRealtimeSubscribed &&
      this.isRealtimeFallbackRequired &&
      navigator.onLine &&
      document.visibilityState === 'visible';

    if (!shouldPoll) {
      this.stopVisibleFallbackPolling();
      return;
    }

    if (this.visiblePollTimer !== null) return;

    this.visiblePollTimer = setInterval(() => {
      this.requestSyncIntent('background', 'visible-fallback-poll', 0);
    }, VISIBLE_FALLBACK_POLL_INTERVAL_MS);
  }

  private static stopVisibleFallbackPolling(): void {
    if (this.visiblePollTimer === null) return;
    clearInterval(this.visiblePollTimer);
    this.visiblePollTimer = null;
  }

  private static handleRealtimeStatus(
    status: string,
    userId: string,
    lifecycleId: number,
    error?: Error
  ): void {
    if (this.activeUserId !== userId || this.realtimeLifecycleId !== lifecycleId) return;

    recordSyncDiagnostic('realtime_status', { realtimeStatus: status });

    if (status === REALTIME_SUBSCRIBED_STATUS) {
      const wasRealtimeFallbackRequired = this.isRealtimeFallbackRequired;
      this.isRealtimeSubscribed = true;
      this.isRealtimeFallbackRequired = false;
      this.stopVisibleFallbackPolling();
      const startedInitialSync = this.requestStartupSync('realtime-subscribed');
      if (!startedInitialSync && wasRealtimeFallbackRequired) {
        this.requestSyncIntent('background', 'realtime-subscribed', 0);
      }
      return;
    }

    if (!REALTIME_RETRY_STATUSES.has(status)) return;

    this.isRealtimeSubscribed = false;
    this.isRealtimeFallbackRequired = true;
    console.warn('[Sync Realtime] Subscription unavailable; starting visible-page fallback.', status, error);
    this.updateVisibleFallbackPolling();
    if (!this.requestStartupSync('realtime-unavailable')) {
      this.requestSyncIntent('background', 'realtime-unavailable', 0);
    }
  }

  static requestSyncIntent(intent: SyncIntent, reason: string = intent, delayMs = SYNC_INTENT_DELAYS[intent]): void {
    this.pendingSyncTriggers.push({ intent, reason });
    recordSyncDiagnostic('intent_requested', { intent, reason, delayMs });
    this.requestSync(reason, delayMs);
  }

  static requestSync(reason = 'manual', delayMs = 0): void {
    if (!this.isAutoSyncEnabled() || !this.activeUserId) return;

    let latestTrigger = this.pendingSyncTriggers.at(-1);
    if (!latestTrigger) {
      latestTrigger = { intent: 'background', reason };
      this.pendingSyncTriggers.push(latestTrigger);
      recordSyncDiagnostic('intent_requested', { intent: 'background', reason, delayMs });
    }

    if (currentSyncStatus !== 'syncing') {
      void this.refreshQueueAwareStatus('pending');
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.inFlightSync) {
      this.shouldRunAgain = true;
      recordSyncDiagnostic('coalesced_in_flight', {
        intent: latestTrigger?.intent,
        reason,
        triggerCount: this.pendingSyncTriggers.length,
      });
      return;
    }

    if (this.scheduledSyncTimer) {
      clearTimeout(this.scheduledSyncTimer);
      recordSyncDiagnostic('timer_replaced', {
        intent: latestTrigger?.intent,
        reason,
        delayMs,
        triggerCount: this.pendingSyncTriggers.length,
      });
    }

    recordSyncDiagnostic('scheduled', {
      intent: latestTrigger?.intent,
      reason,
      delayMs,
      triggerCount: this.pendingSyncTriggers.length,
    });
    this.scheduledSyncTimer = setTimeout(() => {
      this.scheduledSyncTimer = null;
      void this.sync();
    }, Math.max(0, delayMs));
  }

  /**
   * PUSH: Consume the local sync queue and send changes to Supabase
   */
  static async push(): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) return;
    let earliestRetryAt: number | null = null;

    // 1. Skip operations that are waiting for backoff or need user intervention.
    const queue = await getReadyUserQueue(userId);
    if (queue.length === 0) {
      recordSyncDiagnostic('push_started', {
        runId: this.activeSyncRunId,
        queueItemCount: 0,
        recordItemCount: 0,
        operationItemCount: 0,
      });
      return;
    }

    // Record sync runs first so an operation can safely reference a newly-created
    // film stock. Operations then execute one at a time through idempotent RPCs.
    const recordQueue = queue.filter(isSyncRecordQueueItem);
    const operationQueue = queue.filter(isSyncOperationQueueItem);
    recordSyncDiagnostic('push_started', {
      runId: this.activeSyncRunId,
      queueItemCount: queue.length,
      recordItemCount: recordQueue.length,
      operationItemCount: operationQueue.length,
    });

    // 2. Group ordinary record work by table name to optimize network calls.
    const grouped = recordQueue.reduce((acc, item) => {
      if (!acc[item.tableName]) acc[item.tableName] = [];
      acc[item.tableName].push(item);
      return acc;
    }, {} as Record<string, SyncRecordQueueItem[]>);

    // 3. Process each table
    for (const [tableName, items] of Object.entries(grouped)) {
      if (!isSyncTableName(tableName)) continue;
      const supabaseTable = tableMap[tableName];
      if (!supabaseTable) continue;

      // Deduplicate: If multiple updates for same record, only keep the latest
      // For deletes, if deleted, we shouldn't upsert.
      const latestOps = new Map<string, typeof recordQueue[number]>();
      items.forEach(item => latestOps.set(item.recordId, item));

      const upserts: SyncRecord[] = [];
      const deletes: string[] = [];

      const queueIdsToClear: number[] = [];

      for (const op of latestOps.values()) {
        if (op.action === 'upsert' && op.payload) {
          const snakePayload = convertKeysToSnakeCase(op.payload);
          if (!isSyncRecord(snakePayload)) continue;
          // Inventory values are changed only by idempotent RPC operations. A
          // normal film-stock edit may still update metadata, but must never
          // overwrite a newer server-side stock count with an LWW snapshot.
          if (tableName === 'filmStocks') {
            delete snakePayload.stock_count;
          }
          // Ensure user_id is injected just in case
          snakePayload.user_id = userId;
          upserts.push(snakePayload);
        } else if (op.action === 'delete') {
          deletes.push(op.recordId);
        }
      }

      items.forEach(i => i.id && queueIdsToClear.push(i.id));

      try {
        // Execute Upserts
        if (upserts.length > 0) {
          const { error } = await supabase.from(supabaseTable).upsert(upserts);
          if (error) throw error;
        }

        // Execute Soft Deletes on Supabase
        if (deletes.length > 0) {
          for (const delId of deletes) {
            const { error } = await supabase
              .from(supabaseTable)
              .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', delId)
              .eq('user_id', userId);
            if (error) throw error;
          }
        }

        // On success, remove these operations from local queue
        await db.syncQueue.bulkDelete(queueIdsToClear);
        recordSyncDiagnostic('record_batch_completed', {
          runId: this.activeSyncRunId,
          tableName,
          queueItemCount: items.length,
          upsertCount: upserts.length,
          deleteCount: deletes.length,
        });

      } catch (err) {
        const failure = classifySyncFailure(err);
        const retryAt = await this.markQueueFailure(queueIdsToClear, items, failure);
        if (retryAt !== null) {
          earliestRetryAt = earliestRetryAt === null ? retryAt : Math.min(earliestRetryAt, retryAt);
        }
        console.error('Failed to push sync queue batch:', err);
        recordSyncDiagnostic('record_batch_failed', {
          runId: this.activeSyncRunId,
          tableName,
          queueItemCount: items.length,
          errorCode: failure.code,
          failureKind: failure.kind,
        });
      }
    }

    for (const operation of operationQueue) {
      if (operation.id === undefined) continue;
      try {
        const result = await pushInventoryOperation(operation);
        await applyInventoryOperationResult(result, userId, operation.id);
        recordSyncDiagnostic('inventory_operation_completed', {
          runId: this.activeSyncRunId,
          operationType: operation.operationType,
        });
      } catch (err) {
        const failure = classifySyncFailure(err);
        const retryAt = await this.markQueueFailure([operation.id], [operation], failure);
        if (retryAt !== null) {
          earliestRetryAt = earliestRetryAt === null ? retryAt : Math.min(earliestRetryAt, retryAt);
        }
        console.error('Failed to push inventory sync operation:', err);
        recordSyncDiagnostic('inventory_operation_failed', {
          runId: this.activeSyncRunId,
          operationType: operation.operationType,
          errorCode: failure.code,
          failureKind: failure.kind,
        });
      }
    }

    if (earliestRetryAt !== null || (await this.getQueueSummary(userId)).needsAttentionCount > 0) {
      throw new SyncPushError(earliestRetryAt);
    }
  }

  /**
   * PULL: Fetch remote changes since last sync and apply locally
   */
  static async pull({ preferRemoteUserProfile = false }: { preferRemoteUserProfile?: boolean } = {}): Promise<SyncPullResult> {
    const userId = getCurrentUserId();
    if (!userId) return { remoteUserProfileFound: false };

    let lastSync = new Date(0).toISOString();
    const lastSyncStr = localStorage.getItem(getSyncWatermarkKey(userId));
    const isInitialPull = !lastSyncStr;
    if (!isInitialPull) {
      lastSync = new Date(lastSyncStr).toISOString();
    }
    recordSyncDiagnostic('pull_started', {
      runId: this.activeSyncRunId,
      pullMode: isInitialPull ? 'initial' : 'incremental',
      lastSync: isInitialPull ? undefined : lastSync,
    });

    const newSyncTime = new Date().toISOString();

    // Enable silent mode so local hooks don't throw fetched data back into the queue
    window.__grainfolio_is_pulling = true;

    let syncError: Error | null = null;
    let remoteUserProfileFound = false;
    let changedTableCount = 0;
    let receivedRecordCount = 0;

    try {
      // Fetch all independent tables concurrently. Applying them remains sequential so
      // Dexie conflict resolution and queued writes keep deterministic behavior.
      const remoteChanges = await Promise.all((Object.entries(tableMap) as Array<[SyncTableName, string]>).map(async ([dexieTable, supaTable]) => {
        const { data, error } = await supabase
          .from(supaTable)
          .select('*')
          .eq('user_id', userId)
          .gt('updated_at', lastSync);

        if (error) throw new Error(`[Sync Pull] ${supaTable}: ${error.message}`);
        return { dexieTable, supaTable, data: (data || []) as SyncRecord[] };
      }));

      for (const { dexieTable, data } of remoteChanges) {
        if (data.length === 0) continue;
        changedTableCount += 1;
        receivedRecordCount += data.length;
        let keptLocalCount = 0;

        const shouldPreferRemoteProfile = preferRemoteUserProfile && dexieTable === 'userProfiles';
        if (shouldPreferRemoteProfile) remoteUserProfileFound = true;

        const table = getSyncTable(dexieTable);

        const toPut: SyncRow[] = [];
        const toDelete: string[] = [];

        // Bulk fetch local rows for LWW comparison
        const recordIds = data.map(row => getString(row.id)).filter((id): id is string => Boolean(id));
        if (recordIds.length === 0) continue;
        const localRows = await table.where('id').anyOf(recordIds).toArray();
        const localMap = new Map<string, SyncRow>();
        localRows.forEach(row => {
          if (row.id) localMap.set(row.id, row);
        });

        // Fetch pending sync items to get the TRUE local last modified time
        const pendingSyncs = (await db.syncQueue.where('recordId').anyOf(recordIds).toArray())
          .filter(isSyncRecordQueueItem);
        const pendingSyncMap = new Map<string, number>();
        pendingSyncs.forEach(syncItem => {
          const existing = pendingSyncMap.get(syncItem.recordId) || 0;
          pendingSyncMap.set(syncItem.recordId, Math.max(existing, syncItem.timestamp));
        });

        for (const row of data) {
          const rowId = getString(row.id);
          if (!rowId) continue;
          const localRow = localMap.get(rowId);
          const remoteTime = getTimestamp(row.updated_at);

          let localTime = 0;
          if (localRow) {
            // Local timestamps might be numeric or strings depending on legacy, but usually updatedAt is ISO string in our new architecture, addedAt is numeric.
            localTime = getTimestamp(localRow.updatedAt ?? localRow.addedAt);
          }

          // CRITICAL EDGE CASE: If the user modified the item locally but it hasn't pushed yet,
          // the localRow.updatedAt in Dexie might be STALE (because Dexie hook doesn't mutate local object updatedAt).
          // The true local modified time is in the syncQueue timestamp.
          const pendingTime = pendingSyncMap.get(rowId) || 0;
          localTime = Math.max(localTime, pendingTime);

          if (shouldPreferRemoteProfile || remoteTime >= localTime) {
            if (row.deleted_at) {
              toDelete.push(rowId);
            } else {
              const camelPayload = convertKeysToCamelCase(row);
              if (!isSyncRecord(camelPayload)) continue;
              delete camelPayload.updatedAt;
              delete camelPayload.deletedAt;
              // Cloud keeps added_at nullable for historic rows, while Dexie
              // requires addedAt. updated_at is the only reliable timestamp
              // available during an incremental pull, so use it as the
              // compatibility fallback rather than rejecting the whole pull.
              if (dexieTable === 'filmStocks' && typeof camelPayload.addedAt !== 'number') {
                camelPayload.addedAt = getTimestamp(row.updated_at);
              }
              toPut.push({ ...camelPayload, id: rowId });
            }

            // Critical: Drop any pending sync items that were overridden by cloud
            const pendingForRecord = (await db.syncQueue.where('recordId').equals(rowId).toArray())
              .filter(isSyncRecordQueueItem)
              .filter(s => queueBelongsToUser(s, userId) || localMap.get(s.recordId)?.userId === userId)
              .map(s => s.id)
              .filter((id): id is number => typeof id === 'number');
            if (pendingForRecord.length > 0) {
              await db.syncQueue.bulkDelete(pendingForRecord);
            }
          } else {
            keptLocalCount += 1;
          }
        }

        if (toPut.length > 0) {
          if (dexieTable === 'filmStocks') {
            await db.transaction('rw', db.filmStocks, db.syncQueue, async () => {
              // Re-read the outbox at commit time. A user may adjust inventory
              // while the Cloud request is in flight, after Pull's initial snapshot.
              const pendingDeltas = getPendingInventoryDeltas(await getUserQueue(userId));
              const rebasedRows = toPut.map(row => {
                if (!row.id || typeof row.stockCount !== 'number') return row;
                return {
                  ...row,
                  stockCount: Math.max(0, row.stockCount + (pendingDeltas.get(row.id) || 0)),
                };
              });
              const filmStockRows: FilmStock[] = [];
              for (const row of rebasedRows) {
                if (!isFilmStockSyncRow(row)) {
                  throw new Error('Cloud film stock data does not match the local schema.');
                }
                filmStockRows.push(row);
              }
              await db.filmStocks.bulkPut(filmStockRows);
            });
          } else {
            await table.bulkPut(toPut);
          }
        }
        if (toDelete.length > 0) await table.bulkDelete(toDelete);

        recordSyncDiagnostic('pull_table_synced', {
          runId: this.activeSyncRunId,
          tableName: dexieTable,
          downloadedCount: data.length,
          upsertCount: toPut.length,
          deleteCount: toDelete.length,
          keptLocalCount,
        });
      }

      // Update the user-scoped sync watermark only after every table succeeds.
      localStorage.setItem(getSyncWatermarkKey(userId), newSyncTime);

    } catch (err) {
      syncError = err instanceof Error ? err : new Error('Unknown sync pull failure.');
      console.error('Failed to pull from cloud:', err);
    } finally {
      // Disengage silent mode
      window.__grainfolio_is_pulling = false;
    }

    if (syncError) {
      recordSyncDiagnostic('pull_failed', {
        runId: this.activeSyncRunId,
        errorCode: getErrorDetails(syncError).code || 'unknown',
      });
      throw syncError;
    }

    recordSyncDiagnostic('pull_completed', {
      runId: this.activeSyncRunId,
      pullMode: isInitialPull ? 'initial' : 'incremental',
      changedTableCount,
      receivedRecordCount,
    });

    return { remoteUserProfileFound };
  }

  /**
   * Run a full cycle (Push then Pull)
   */
  static async sync(): Promise<void> {
    if (!this.isAutoSyncEnabled()) {
      dispatchSyncStatus('local');
      return;
    }
    // Basic connectivity check
    if (!navigator.onLine) {
      dispatchSyncStatus('offline');
      return;
    }

    if (this.inFlightSync) {
      this.shouldRunAgain = true;
      return this.inFlightSync;
    }

    // Dispatch sync start event
    dispatchSyncStatus('syncing');

    const runId = this.nextSyncRunId;
    this.nextSyncRunId += 1;
    const triggers = this.pendingSyncTriggers.splice(0);
    const runTriggers: SyncTrigger[] = triggers.length > 0
      ? triggers
      : [{ intent: 'background', reason: 'manual' }];
    const startedAt = Date.now();
    this.activeSyncRunId = runId;
    recordSyncDiagnostic('run_started', {
      runId,
      triggerCount: runTriggers.length,
      intentCounts: countSyncIntents(runTriggers),
    });

    this.inFlightSync = (async () => {
      try {
        const userId = getCurrentUserId();
        const isInitialSync = userId && !localStorage.getItem(getSyncWatermarkKey(userId));

        if (userId) {
          await Promise.all([
            this.recoverLegacyInventoryRpcFailures(userId),
            this.recoverFilmStockMetadataSchemaFailures(userId),
          ]);
        }

        if (isInitialSync) {
          // A new browser must import the account profile before its local default can queue a write.
          await this.pull({ preferRemoteUserProfile: true });
          await this.push();
        } else {
          await this.push();
          await this.pull();
        }
        await this.refreshQueueAwareStatus('synced', true);
        recordSyncDiagnostic('run_completed', {
          runId,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        recordSyncDiagnostic('run_failed', {
          runId,
          durationMs: Date.now() - startedAt,
          errorCode: getErrorDetails(error).code || 'unknown',
        });
        await this.refreshQueueAwareStatus('pending', true);
        const hasScheduledQueueRetry = error instanceof SyncPushError;
        const shouldRetryGenericFailure = !hasScheduledQueueRetry;
        if (shouldRetryGenericFailure && this.activeUserId && !this.retryTimer) {
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.requestSyncIntent('background', 'retry', 0);
          }, RETRY_SYNC_DELAY_MS);
        }
      } finally {
        this.inFlightSync = null;
        if (this.activeSyncRunId === runId) {
          this.activeSyncRunId = undefined;
        }
        if (this.shouldRunAgain && this.activeUserId) {
          this.shouldRunAgain = false;
          this.requestSyncIntent('background', 'follow-up');
        }
      }
    })();

    return this.inFlightSync;
  }

  /**
   * Setup WebSocket listener for real-time cloud changes
   */
  static setupRealtimeSubscription(
    userId = getCurrentUserId(),
    lifecycleId = this.realtimeLifecycleId
  ) {
    if (!userId || !this.isAutoSyncEnabled()) return;

    let channel = supabase.channel(`grainfolio-user-${userId}`);

    for (const table of supabaseTables) {
      channel = channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        recordSyncDiagnostic('realtime_change_received', {
          tableName: table,
          realtimeEventType: payload.eventType,
        });
        this.requestSyncIntent('background', 'realtime');
      });
    }

    channel.subscribe((status, error) => {
      this.handleRealtimeStatus(status, userId, lifecycleId, error);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
