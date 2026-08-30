import {
  db,
  isSyncOperationQueueItem,
  isSyncRecordQueueItem,
  type SyncOperationQueueItem,
  type SyncQueueItem,
  type SyncRecordQueueItem,
} from '../../db/schema';
import { recordSyncDiagnostic } from '../syncDiagnostics';
import { getUserQueue } from './queueUtils';

const MISSING_RPC_SCHEMA_CACHE_CODE = 'PGRST202';
const MISSING_COLUMN_SCHEMA_CACHE_CODE = 'PGRST204';
const FILM_STOCK_METADATA_COLUMNS = ['price_per_roll', 'avatar_url'];

const isRecoverableLegacyInventoryRpcFailure = (item: SyncQueueItem): item is SyncOperationQueueItem => (
  isSyncOperationQueueItem(item) &&
  item.failureKind === 'needs_attention' &&
  item.recoveryAttemptedAt === undefined &&
  item.lastErrorCode === MISSING_RPC_SCHEMA_CACHE_CODE &&
  item.lastErrorMessage?.includes(`public.${item.operationType}`) === true
);

const isRecoverableFilmStockMetadataSchemaFailure = (item: SyncQueueItem): item is SyncRecordQueueItem => (
  isSyncRecordQueueItem(item) &&
  item.tableName === 'filmStocks' &&
  item.failureKind === 'needs_attention' &&
  item.recoveryAttemptedAt === undefined &&
  item.lastErrorCode === MISSING_COLUMN_SCHEMA_CACHE_CODE &&
  FILM_STOCK_METADATA_COLUMNS.some(column => item.lastErrorMessage?.includes(column))
);

// A deployment can add an inventory RPC after local operations were already
// queued. Re-open only the exact schema-cache failure once; all other
// actionable failures remain blocked until a user-facing resolution exists.
export const recoverLegacyInventoryRpcFailures = async (userId: string): Promise<number> => {
  const recoverableItems = (await getUserQueue(userId))
    .filter(isRecoverableLegacyInventoryRpcFailure)
    .filter((item): item is SyncOperationQueueItem & { id: number } => item.id !== undefined);

  if (recoverableItems.length === 0) return 0;

  await db.syncQueue.where('id').anyOf(recoverableItems.map(item => item.id)).modify(item => {
    item.recoveryAttemptedAt = Date.now();
    delete item.attemptCount;
    delete item.failureKind;
    delete item.lastErrorCode;
    delete item.lastErrorMessage;
    delete item.lastAttemptAt;
    delete item.nextRetryAt;
  });

  recordSyncDiagnostic('legacy_inventory_rpc_reopened', {
    queueItemCount: recoverableItems.length,
  });
  return recoverableItems.length;
};

// Re-open only records blocked by film-stock columns introduced in a known
// migration. Other PGRST204 failures remain actionable rather than guessed.
export const recoverFilmStockMetadataSchemaFailures = async (userId: string): Promise<number> => {
  const recoverableItems = (await getUserQueue(userId))
    .filter(isRecoverableFilmStockMetadataSchemaFailure)
    .filter((item): item is SyncRecordQueueItem & { id: number } => item.id !== undefined);

  if (recoverableItems.length === 0) return 0;

  await db.syncQueue.where('id').anyOf(recoverableItems.map(item => item.id)).modify(item => {
    item.recoveryAttemptedAt = Date.now();
    delete item.attemptCount;
    delete item.failureKind;
    delete item.lastErrorCode;
    delete item.lastErrorMessage;
    delete item.lastAttemptAt;
    delete item.nextRetryAt;
  });

  recordSyncDiagnostic('legacy_film_stock_schema_reopened', {
    queueItemCount: recoverableItems.length,
  });
  return recoverableItems.length;
};
