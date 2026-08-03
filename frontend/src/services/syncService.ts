import { supabase } from './supabaseClient';
import { db, type SyncQueueItem } from '../db/schema';

const isLocalSupabaseUrl = (url: string) => (
  url.includes('127.0.0.1:54321') || url.includes('localhost:54321')
);

const hasValidSupabaseKeyPair = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (isLocalSupabaseUrl(supabaseUrl)) return supabaseAnonKey.startsWith('eyJ');
  return supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.startsWith('eyJ');
};

const hasAutoSyncFlag = () => import.meta.env.VITE_ENABLE_SUPABASE_SYNC === 'true';

// --- Utility Functions for Key Case Conversion ---
const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const localOnlyFields = new Set(['blob', 'updatedAt', 'deletedAt']);

const convertKeysToSnakeCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);
  
  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Omit local-only fields that shouldn't go to Supabase
      if (localOnlyFields.has(key)) continue;
      if (obj[key] === undefined) continue;
      
      newObj[camelToSnake(key)] = convertKeysToSnakeCase(obj[key]);
    }
  }
  return newObj;
};

const convertKeysToCamelCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
  
  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (localOnlyFields.has(snakeToCamel(key))) continue;
      newObj[snakeToCamel(key)] = convertKeysToCamelCase(obj[key]);
    }
  }
  return newObj;
};

// Map Dexie table names to Supabase table names
const tableMap: Record<string, string> = {
  cameras: 'cameras',
  cameraSystems: 'camera_systems',
  filmBacks: 'film_backs',
  lenses: 'lenses',
  filmStocks: 'film_stocks',
  rolls: 'rolls',
  photoAssets: 'photo_assets',
  otherEquipments: 'other_equipments',
  collections: 'collections',
  albums: 'albums',
  albumPhotos: 'album_photos',
  tagConfigs: 'tag_configs',
  ledgerTransactions: 'ledger_transactions',
  userProfiles: 'user_profiles'
};

const getCurrentUserId = () => localStorage.getItem('grainfolio_user_id');
const getSyncWatermarkKey = (userId: string) => `grainfolio_last_sync_${userId}`;
const queueBelongsToUser = (item: SyncQueueItem, userId: string) => (
  item.userId === userId ||
  (!item.userId && (item.payload?.userId === userId || item.payload?.user_id === userId))
);

const getUserQueue = async (userId: string) => {
  const queue = await db.syncQueue.orderBy('timestamp').toArray();
  return queue.filter(item => queueBelongsToUser(item, userId));
};

const supabaseTables = Object.values(tableMap);
export const LOCAL_CHANGE_EVENT = 'grainfolio-sync-request';
export const SYNC_STATUS_EVENT = 'grainfolio-sync-status';
export type SyncStatusState = 'local' | 'offline' | 'syncing' | 'synced' | 'error';
type SyncPullResult = {
  remoteUserProfileFound: boolean;
};
const SYNC_DEBOUNCE_MS = 1500;
const RESUME_SYNC_DEBOUNCE_MS = 400;
const RETRY_SYNC_DELAY_MS = 5000;
const VISIBLE_FALLBACK_POLL_INTERVAL_MS = 60_000;
const REALTIME_SUBSCRIBED_STATUS = 'SUBSCRIBED';
const REALTIME_RETRY_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);
let currentSyncStatus: SyncStatusState = 'local';

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
  private static realtimeLifecycleId = 0;
  private static isRealtimeSubscribed = false;
  private static isRealtimeFallbackRequired = false;

  static isAutoSyncEnabled(): boolean {
    return hasAutoSyncFlag() && hasValidSupabaseKeyPair();
  }

  static getStatus(): SyncStatusState {
    if (!this.isAutoSyncEnabled()) return 'local';
    if (!navigator.onLine) return 'offline';
    return currentSyncStatus === 'local' ? 'syncing' : currentSyncStatus;
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
    const lifecycleId = this.realtimeLifecycleId;

    const unsubscribeRealtime = this.setupRealtimeSubscription(userId, lifecycleId);

    const handleOnline = () => {
      this.requestSync('online', 0);
      this.updateVisibleFallbackPolling();
    };

    const handleOffline = () => {
      dispatchSyncStatus('offline');
      this.stopVisibleFallbackPolling();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.requestSync('visibility', 0);
      }
      this.updateVisibleFallbackPolling();
    };

    const handleLocalChange = () => {
      this.requestSync('local-change', SYNC_DEBOUNCE_MS);
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
    this.requestSync('start', 0);
  }

  static stop(): void {
    this.realtimeLifecycleId += 1;
    this.activeCleanup?.();
    this.activeCleanup = null;
    this.activeUserId = null;
    this.isRealtimeSubscribed = false;
    this.isRealtimeFallbackRequired = false;
    this.shouldRunAgain = false;
    this.inFlightSync = null;

    if (this.scheduledSyncTimer) {
      clearTimeout(this.scheduledSyncTimer);
      this.scheduledSyncTimer = null;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.stopVisibleFallbackPolling();

    dispatchSyncStatus('local');
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
      this.requestSync('visible-fallback-poll');
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

    if (status === REALTIME_SUBSCRIBED_STATUS) {
      this.isRealtimeSubscribed = true;
      this.isRealtimeFallbackRequired = false;
      this.stopVisibleFallbackPolling();
      this.requestSync('realtime-subscribed', 0);
      return;
    }

    if (!REALTIME_RETRY_STATUSES.has(status)) return;

    this.isRealtimeSubscribed = false;
    this.isRealtimeFallbackRequired = true;
    console.warn('[Sync Realtime] Subscription unavailable; starting visible-page fallback.', status, error);
    this.updateVisibleFallbackPolling();
    this.requestSync('realtime-unavailable', 0);
  }

  static requestSync(reason = 'manual', delayMs = 0): void {
    void reason;
    if (!this.isAutoSyncEnabled() || !this.activeUserId) return;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.inFlightSync) {
      this.shouldRunAgain = true;
      return;
    }

    if (this.scheduledSyncTimer) {
      clearTimeout(this.scheduledSyncTimer);
    }

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
    let hadErrors = false;

    // 1. Fetch only this user's pending queue items
    const queue = await getUserQueue(userId);
    if (queue.length === 0) return;

    // 2. Group by table name to optimize network calls
    const grouped = queue.reduce((acc, item) => {
      if (!acc[item.tableName]) acc[item.tableName] = [];
      acc[item.tableName].push(item);
      return acc;
    }, {} as Record<string, SyncQueueItem[]>);

    // 3. Process each table
    for (const [tableName, items] of Object.entries(grouped)) {
      const supabaseTable = tableMap[tableName];
      if (!supabaseTable) continue;

      // Deduplicate: If multiple updates for same record, only keep the latest
      // For deletes, if deleted, we shouldn't upsert.
      const latestOps = new Map<string, SyncQueueItem>();
      items.forEach(item => latestOps.set(item.recordId, item));

      const upserts: any[] = [];
      const deletes: string[] = [];
      
      const queueIdsToClear: number[] = [];

      for (const op of latestOps.values()) {
        if (op.action === 'upsert' && op.payload) {
          const snakePayload = convertKeysToSnakeCase(op.payload);
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
          if (error) throw new Error(`[Sync Push Upsert] ${supabaseTable}: ${error.message}`);
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
            if (error) throw new Error(`[Sync Push Delete] ${supabaseTable}: ${error.message}`);
          }
        }

        // On success, remove these operations from local queue
        await db.syncQueue.bulkDelete(queueIdsToClear);

      } catch (err) {
        hadErrors = true;
        console.error('Failed to push sync queue batch:', err);
        // Will retry on next push call since we didn't delete from syncQueue
      }
    }

    if (hadErrors) {
      throw new Error('One or more sync push batches failed.');
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
      console.log(`[Sync Pull] Incremental pull since ${lastSync}`);
    } else {
      console.log('📦 [Sync Pull] No user sync watermark, forcing a FULL PULL from Supabase...');
    }

    const newSyncTime = new Date().toISOString();

    // Enable silent mode so local hooks don't throw fetched data back into the queue
    window.__grainfolio_is_pulling = true;

    let syncError: Error | null = null;
    let remoteUserProfileFound = false;

    try {
      // Fetch all independent tables concurrently. Applying them remains sequential so
      // Dexie conflict resolution and queued writes keep deterministic behavior.
      const remoteChanges = await Promise.all(Object.entries(tableMap).map(async ([dexieTable, supaTable]) => {
        const { data, error } = await supabase
          .from(supaTable)
          .select('*')
          .eq('user_id', userId)
          .gt('updated_at', lastSync);

        if (error) throw new Error(`[Sync Pull] ${supaTable}: ${error.message}`);
        return { dexieTable, supaTable, data: data || [] };
      }));

      for (const { dexieTable, supaTable, data } of remoteChanges) {
        if (data.length === 0) continue;

        console.log(`[Sync Pull] Downloaded ${data.length} new/updated records for ${supaTable}`);

        const shouldPreferRemoteProfile = preferRemoteUserProfile && dexieTable === 'userProfiles';
        if (shouldPreferRemoteProfile) remoteUserProfileFound = true;

        const table = (db as any)[dexieTable];

        const toPut: any[] = [];
        const toDelete: string[] = [];

        // Bulk fetch local rows for LWW comparison
        const recordIds = data.map((r: any) => r.id);
        const localRows = await table.where('id').anyOf(recordIds).toArray();
        const localMap = new Map();
        localRows.forEach((r: any) => localMap.set(r.id, r));

        // Fetch pending sync items to get the TRUE local last modified time
        const pendingSyncs = await db.syncQueue.where('recordId').anyOf(recordIds).toArray();
        const pendingSyncMap = new Map();
        pendingSyncs.forEach((s: any) => {
          const existing = pendingSyncMap.get(s.recordId) || 0;
          pendingSyncMap.set(s.recordId, Math.max(existing, s.timestamp));
        });

        for (const row of data) {
          const localRow = localMap.get(row.id);
          const remoteTime = new Date(row.updated_at).getTime();
          
          let localTime = 0;
          if (localRow) {
            // Local timestamps might be numeric or strings depending on legacy, but usually updatedAt is ISO string in our new architecture, addedAt is numeric.
            if (localRow.updatedAt) {
              localTime = typeof localRow.updatedAt === 'number' ? localRow.updatedAt : new Date(localRow.updatedAt).getTime();
            } else if (localRow.addedAt) {
              localTime = typeof localRow.addedAt === 'number' ? localRow.addedAt : new Date(localRow.addedAt).getTime();
            }
          }
          
          // CRITICAL EDGE CASE: If the user modified the item locally but it hasn't pushed yet, 
          // the localRow.updatedAt in Dexie might be STALE (because Dexie hook doesn't mutate local object updatedAt).
          // The true local modified time is in the syncQueue timestamp.
          const pendingTime = pendingSyncMap.get(row.id) || 0;
          localTime = Math.max(localTime, pendingTime);

          if (shouldPreferRemoteProfile || remoteTime >= localTime) {
            if (row.deleted_at) {
              toDelete.push(row.id);
            } else {
              const camelPayload = convertKeysToCamelCase(row);
              delete camelPayload.updatedAt;
              delete camelPayload.deletedAt;
              toPut.push(camelPayload);
            }
            
            // Critical: Drop any pending sync items that were overridden by cloud
            const pendingForRecord = (await db.syncQueue.where('recordId').equals(row.id).toArray())
              .filter((s: SyncQueueItem) => queueBelongsToUser(s, userId) || localMap.get(s.recordId)?.userId === userId)
              .map((s: SyncQueueItem) => s.id)
              .filter((id): id is number => typeof id === 'number');
            if (pendingForRecord.length > 0) {
              await db.syncQueue.bulkDelete(pendingForRecord);
            }
          } else {
            console.log(`[Sync LWW] Kept local version for ${row.id} (${localTime} > ${remoteTime})`);
          }
        }

        if (toPut.length > 0) {
          await table.bulkPut(toPut);
          console.log(`[Sync Pull] Saved ${toPut.length} records to local Dexie ${dexieTable}`);
        }
        if (toDelete.length > 0) await table.bulkDelete(toDelete);
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
      throw syncError;
    }

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

    this.inFlightSync = (async () => {
      try {
        const userId = getCurrentUserId();
        const isInitialSync = userId && !localStorage.getItem(getSyncWatermarkKey(userId));

        if (isInitialSync) {
          // A new browser must import the account profile before its local default can queue a write.
          await this.pull({ preferRemoteUserProfile: true });
          await this.push();
        } else {
          await this.push();
          await this.pull();
        }
        dispatchSyncStatus('synced');
      } catch {
        dispatchSyncStatus('error');
        if (this.activeUserId) {
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.requestSync('retry', 0);
          }, RETRY_SYNC_DELAY_MS);
        }
      } finally {
        this.inFlightSync = null;
        if (this.shouldRunAgain && this.activeUserId) {
          this.shouldRunAgain = false;
          this.requestSync('follow-up', RESUME_SYNC_DEBOUNCE_MS);
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

    console.log('[Sync Realtime] Subscribing to postgres changes...');
    let channel = supabase.channel(`grainfolio-user-${userId}`);

    for (const table of supabaseTables) {
      channel = channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        console.log('[Sync Realtime] Cloud mutated!', payload);
        this.requestSync('realtime', RESUME_SYNC_DEBOUNCE_MS);
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
