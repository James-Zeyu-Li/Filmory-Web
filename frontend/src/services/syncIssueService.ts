import {
  db,
  isSyncOperationQueueItem,
  suppressSyncRecordsForCurrentTransaction,
  type LedgerTransaction,
  type Roll,
  type SyncOperationQueueItem,
  type SyncQueueItem,
} from '../db/schema';
import { requestImmediateSync } from './syncEvents';

type FailedInventoryOperation = SyncOperationQueueItem & { id: number };
type FailedSyncQueueItem = SyncQueueItem & { id: number };

type CreateRollOperationPayload = {
  roll: Roll;
  ledger?: LedgerTransaction;
  consumeInventory: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const getFailedOperation = async (queueItemId: number, userId: string): Promise<FailedInventoryOperation> => {
  const item = await db.syncQueue.get(queueItemId);
  if (!item || !isSyncOperationQueueItem(item) || item.userId !== userId || item.failureKind !== 'needs_attention') {
    throw new Error('This sync issue is no longer available.');
  }

  return item as FailedInventoryOperation;
};

const getFailedQueueItem = async (queueItemId: number, userId: string): Promise<FailedSyncQueueItem> => {
  const item = await db.syncQueue.get(queueItemId);
  if (!item || item.id === undefined || item.userId !== userId || item.failureKind !== 'needs_attention') {
    throw new Error('This sync issue is no longer available.');
  }
  return item as FailedSyncQueueItem;
};

const getCreateRollPayload = (operation: FailedInventoryOperation): CreateRollOperationPayload => {
  const { roll, ledger, consumeInventory } = operation.operationPayload;
  if (!isRecord(roll) || typeof roll.id !== 'string' || typeof roll.userId !== 'string') {
    throw new Error('The failed shooting record is missing its recovery data.');
  }

  return {
    roll: roll as unknown as Roll,
    ledger: isRecord(ledger) ? ledger as unknown as LedgerTransaction : undefined,
    consumeInventory: consumeInventory === true,
  };
};

const isMissingFilmStockFailure = (operation: FailedInventoryOperation): boolean => (
  operation.lastErrorCode === '23503'
  || operation.lastErrorCode === 'FILM_STOCK_NOT_FOUND'
  || operation.lastErrorMessage?.includes('FILM_STOCK_NOT_FOUND') === true
);

const clearFailureState = <T extends SyncQueueItem>(operation: T): T => {
  const retryableOperation = { ...operation };
  Reflect.deleteProperty(retryableOperation, 'id');
  delete retryableOperation.attemptCount;
  delete retryableOperation.failureKind;
  delete retryableOperation.lastErrorCode;
  delete retryableOperation.lastErrorMessage;
  delete retryableOperation.lastAttemptAt;
  delete retryableOperation.nextRetryAt;
  delete retryableOperation.recoveryAttemptedAt;
  return retryableOperation;
};

/** Re-open the exact failed operation without creating a second operation id. */
export const retrySyncIssue = async (queueItemId: number, userId: string): Promise<void> => {
  await db.transaction('rw', db.syncQueue, async () => {
    const operation = await getFailedQueueItem(queueItemId, userId);
    await db.syncQueue.put({
      ...clearFailureState(operation),
      id: operation.id,
    });
  });

  requestImmediateSync('sync-issue-retry');
};

/** Undo only the local optimistic work for an operation that Cloud rejected. */
export const undoSyncIssue = async (queueItemId: number, userId: string): Promise<void> => {
  await db.transaction('rw', db.filmStocks, db.rolls, db.ledgerTransactions, db.syncQueue, async () => {
    const operation = await getFailedOperation(queueItemId, userId);
    suppressSyncRecordsForCurrentTransaction();

    if (operation.operationType === 'adjust_film_stock') {
      const filmStockId = operation.operationPayload.filmStockId;
      const delta = operation.operationPayload.delta;
      if (typeof filmStockId !== 'string' || typeof delta !== 'number' || !Number.isInteger(delta)) {
        throw new Error('The failed inventory adjustment is invalid.');
      }

      const film = await db.filmStocks.get(filmStockId);
      if (film?.userId === userId) {
        if (isMissingFilmStockFailure(operation)) {
          // The RPC confirmed the Cloud record is gone. Keeping a compensated
          // local copy would leave the workspace showing stale inventory.
          await db.filmStocks.delete(filmStockId);
        } else {
          await db.filmStocks.update(filmStockId, {
            stockCount: Math.max(0, (film.stockCount || 0) - delta),
          });
        }
      }
    } else {
      const { roll, ledger, consumeInventory } = getCreateRollPayload(operation);
      if (roll.userId !== userId) throw new Error('The failed shooting record belongs to another user.');

      if (consumeInventory && roll.filmStockId) {
        const film = await db.filmStocks.get(roll.filmStockId);
        if (film?.userId === userId) {
          await db.filmStocks.update(roll.filmStockId, {
            stockCount: (film.stockCount || 0) + 1,
          });
        }
      }

      if (roll.id) await db.rolls.delete(roll.id);
      if (ledger?.id) await db.ledgerTransactions.delete(ledger.id);
    }

    await db.syncQueue.delete(operation.id);
  });
};

/**
 * Keep a rejected shooting record, but stop trying to consume its registered
 * inventory. This is available only while the referenced local film stock exists.
 */
export const keepRollWithoutInventory = async (queueItemId: number, userId: string): Promise<void> => {
  await db.transaction('rw', db.filmStocks, db.rolls, db.syncQueue, async () => {
    const operation = await getFailedOperation(queueItemId, userId);
    if (operation.operationType !== 'create_roll_with_inventory') {
      throw new Error('Only shooting-record inventory operations can be changed.');
    }

    const { roll, consumeInventory } = getCreateRollPayload(operation);
    if (!consumeInventory || !roll.filmStockId) {
      throw new Error('This shooting record does not have registered inventory to release.');
    }

    suppressSyncRecordsForCurrentTransaction();
    // Cloud has confirmed this inventory source no longer exists. Keep the
    // shooting record, but remove its stale inventory relationship locally
    // and from the replayed RPC payload.
    await db.filmStocks.delete(roll.filmStockId);
    const unregisteredRoll: Roll = { ...roll, filmStockId: undefined };
    await db.rolls.update(roll.id!, { filmStockId: undefined });
    await db.syncQueue.put({
      ...clearFailureState(operation),
      id: operation.id,
      operationPayload: {
        ...operation.operationPayload,
        roll: unregisteredRoll,
        consumeInventory: false,
      },
    });
  });

  requestImmediateSync('sync-issue-keep-roll-without-inventory');
};

export const canKeepRollWithoutInventory = async (operation: SyncOperationQueueItem, userId: string): Promise<boolean> => {
  if (operation.operationType !== 'create_roll_with_inventory') return false;

  try {
    const { roll, consumeInventory } = getCreateRollPayload(operation as FailedInventoryOperation);
    if (!consumeInventory || !roll.filmStockId || !isMissingFilmStockFailure(operation as FailedInventoryOperation)) return false;
    const localRoll = await db.rolls.get(roll.id!);
    return localRoll?.userId === userId;
  } catch {
    return false;
  }
};
