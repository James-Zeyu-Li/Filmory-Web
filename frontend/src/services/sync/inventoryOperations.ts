import { supabase } from '../supabaseClient';
import {
  db,
  isSyncOperationQueueItem,
  suppressSyncRecordsForCurrentTransaction,
  type SyncOperationQueueItem,
  type SyncQueueItem,
} from '../../db/schema';
import { isSyncRecord } from './keyCaseMapping';
import { getString, getUserQueue } from './queueUtils';

export const getInventoryOperationDelta = (item: SyncOperationQueueItem): { filmStockId: string; delta: number } | null => {
  if (item.operationType === 'adjust_film_stock') {
    const filmStockId = getString(item.operationPayload.filmStockId);
    const delta = item.operationPayload.delta;
    return filmStockId && typeof delta === 'number' && Number.isInteger(delta)
      ? { filmStockId, delta }
      : null;
  }

  const roll = item.operationPayload.roll;
  if (item.operationPayload.consumeInventory !== true || !isSyncRecord(roll)) return null;
  const filmStockId = getString(roll.filmStockId);
  return filmStockId ? { filmStockId, delta: -1 } : null;
};

export const getPendingInventoryDeltas = (queue: SyncQueueItem[]): Map<string, number> => {
  const deltas = new Map<string, number>();
  for (const item of queue) {
    if (!isSyncOperationQueueItem(item)) continue;
    const operation = getInventoryOperationDelta(item);
    if (!operation) continue;
    deltas.set(operation.filmStockId, (deltas.get(operation.filmStockId) || 0) + operation.delta);
  }
  return deltas;
};

export type InventoryOperationResult = {
  operationId: string;
  filmStockId?: string | null;
  stockCount?: number | null;
};

export const isInventoryOperationResult = (value: unknown): value is InventoryOperationResult => (
  isSyncRecord(value) &&
  typeof value.operationId === 'string' &&
  (value.filmStockId === undefined || value.filmStockId === null || typeof value.filmStockId === 'string') &&
  (value.stockCount === undefined || value.stockCount === null || typeof value.stockCount === 'number')
);

export const applyInventoryOperationResult = async (
  result: InventoryOperationResult,
  userId: string,
  completedQueueItemId: number,
): Promise<void> => {
  const filmStockId = result.filmStockId;
  const confirmedStockCount = result.stockCount;

  await db.transaction('rw', db.filmStocks, db.syncQueue, async () => {
    // Every accepted RPC must leave the durable outbox, including an
    // unregistered shooting record that intentionally has no stock result.
    await db.syncQueue.delete(completedQueueItemId);
    if (!filmStockId || typeof confirmedStockCount !== 'number') return;

    // The remaining local operations are rebased onto the Cloud-confirmed
    // count in the same transaction so rapid local changes stay visible.
    const pendingQueue = await getUserQueue(userId);
    const pendingDelta = getPendingInventoryDeltas(pendingQueue).get(filmStockId) || 0;
    suppressSyncRecordsForCurrentTransaction();
    await db.filmStocks.update(filmStockId, {
      stockCount: Math.max(0, confirmedStockCount + pendingDelta),
    });
  });
};

export const pushInventoryOperation = async (item: SyncOperationQueueItem): Promise<InventoryOperationResult> => {
  const payload = item.operationPayload;
  let data: unknown;
  let error: unknown;

  if (item.operationType === 'create_roll_with_inventory') {
    const roll = payload.roll;
    if (!isSyncRecord(roll)) {
      throw new Error('Invalid create-roll inventory operation payload.');
    }
    const response = await supabase.rpc('create_roll_with_inventory', {
      p_operation_id: item.operationId,
      p_roll: roll,
      p_consume_inventory: payload.consumeInventory === true,
      p_ledger: isSyncRecord(payload.ledger) ? payload.ledger : null,
    });
    data = response.data;
    error = response.error;
  } else {
    const filmStockId = getString(payload.filmStockId);
    const delta = payload.delta;
    if (!filmStockId || typeof delta !== 'number' || !Number.isInteger(delta)) {
      throw new Error('Invalid film-stock adjustment operation payload.');
    }
    const response = await supabase.rpc('adjust_film_stock', {
      p_operation_id: item.operationId,
      p_film_stock_id: filmStockId,
      p_delta: delta,
    });
    data = response.data;
    error = response.error;
  }

  if (error) throw error;
  if (!isInventoryOperationResult(data) || data.operationId !== item.operationId) {
    throw new Error('Inventory operation returned an invalid result.');
  }

  return data;
};
