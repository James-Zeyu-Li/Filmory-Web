import { supabase } from './supabaseClient';
import { db, type SyncQueueItem } from '../db/schema';

// --- Utility Functions for Key Case Conversion ---
const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const convertKeysToSnakeCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);
  
  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Omit local-only fields that shouldn't go to Supabase
      if (key === 'blob') continue; 
      
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
      newObj[snakeToCamel(key)] = convertKeysToCamelCase(obj[key]);
    }
  }
  return newObj;
};

// Map Dexie table names to Supabase table names
const tableMap: Record<string, string> = {
  cameras: 'cameras',
  lenses: 'lenses',
  filmStocks: 'film_stocks',
  rolls: 'rolls',
  photoAssets: 'photo_assets',
  otherEquipments: 'other_equipments',
  albums: 'albums',
  albumPhotos: 'album_photos',
  tagConfigs: 'tag_configs',
  ledgerTransactions: 'ledger_transactions',
  userProfiles: 'user_profiles'
};

const getCurrentUserId = () => localStorage.getItem('filmory_user_id');
const getSyncWatermarkKey = (userId: string) => `filmory_last_sync_${userId}`;
const queueBelongsToUser = (item: SyncQueueItem, userId: string) => (
  item.userId === userId ||
  (!item.userId && (item.payload?.userId === userId || item.payload?.user_id === userId))
);

const getUserQueue = async (userId: string) => {
  const queue = await db.syncQueue.orderBy('timestamp').toArray();
  return queue.filter(item => queueBelongsToUser(item, userId));
};

export class SyncService {
  /**
   * PUSH: Consume the local sync queue and send changes to Supabase
   */
  static async push(): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) return;

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
        console.error('Failed to push sync queue batch:', err);
        // Will retry on next push call since we didn't delete from syncQueue
      }
    }
  }

  /**
   * PULL: Fetch remote changes since last sync and apply locally
   */
  static async pull(): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) return;

    let lastSync = new Date(0).toISOString();
    const localStockCount = await db.filmStocks.where('userId').equals(userId).count();
    
    if (localStockCount > 0) {
      const lastSyncStr = localStorage.getItem(getSyncWatermarkKey(userId)) || localStorage.getItem('filmory_last_sync');
      if (lastSyncStr) lastSync = new Date(lastSyncStr).toISOString();
      console.log(`[Sync Pull] Incremental pull since ${lastSync}`);
    } else {
      console.log('📦 [Sync Pull] Local Dexie is completely empty, forcing a FULL PULL from Supabase...');
    }

    const newSyncTime = new Date().toISOString();

    // Enable silent mode so local hooks don't throw fetched data back into the queue
    window.__filmory_is_pulling = true;

    try {
      for (const [dexieTable, supaTable] of Object.entries(tableMap)) {
        // Fetch rows updated since last sync
        const { data, error } = await supabase
          .from(supaTable)
          .select('*')
          .eq('user_id', userId)
          .gt('updated_at', lastSync);

        if (error) throw new Error(`[Sync Pull] ${supaTable}: ${error.message}`);
        if (!data || data.length === 0) continue;

        console.log(`[Sync Pull] Downloaded ${data.length} new/updated records for ${supaTable}`);

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

          if (remoteTime >= localTime) {
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

      // Update the sync watermark on success
      localStorage.setItem(getSyncWatermarkKey(userId), newSyncTime);

    } catch (err) {
      console.error('Failed to pull from cloud:', err);
    } finally {
      // Disengage silent mode
      window.__filmory_is_pulling = false;
    }
  }

  /**
   * Run a full cycle (Push then Pull)
   */
  static async sync(): Promise<void> {
    // Basic connectivity check
    if (!navigator.onLine) return;
    
    // Dispatch sync start event
    window.dispatchEvent(new CustomEvent('filmory-sync-status', { detail: 'syncing' }));

    try {
      await this.push();
      await this.pull();
      window.dispatchEvent(new CustomEvent('filmory-sync-status', { detail: 'synced' }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('filmory-sync-status', { detail: 'error' }));
    }
  }

  /**
   * Setup WebSocket listener for real-time cloud changes
   */
  static setupRealtimeSubscription() {
    const userId = getCurrentUserId();
    if (!userId) return;

    console.log('[Sync Realtime] Subscribing to postgres changes...');
    const channel = supabase.channel(`filmory-user-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('[Sync Realtime] Cloud mutated!', payload);
        // Trigger a background pull immediately
        this.sync();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
