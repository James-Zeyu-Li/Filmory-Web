import {
  db,
  suppressSyncRecordsForCurrentTransaction,
  type FilmStock,
  type LedgerTransaction,
  type Roll,
  type SyncOperationQueueItem,
} from '../db/schema';
import { requestImmediateSync } from './syncEvents';

type CreateRollWithInventoryInput = {
  roll: Roll;
  ledger?: LedgerTransaction;
};

const createOperation = (
  userId: string,
  operationType: SyncOperationQueueItem['operationType'],
  operationPayload: Record<string, unknown>,
): SyncOperationQueueItem => ({
  kind: 'operation',
  userId,
  operationId: crypto.randomUUID(),
  operationType,
  operationPayload,
  timestamp: Date.now(),
});

export const createRollWithInventory = async ({ roll, ledger }: CreateRollWithInventoryInput): Promise<void> => {
  const userId = roll.userId;
  if (!roll.id || !userId) {
    throw new Error('A roll id and user id are required for inventory synchronization.');
  }

  // Digital rolls do not consume film inventory. Keep them on the ordinary
  // record queue instead of passing the local digital placeholder to a UUID RPC.
  if (!roll.filmStockId || roll.filmStockId === 'digital-placeholder') {
    await db.transaction('rw', db.rolls, db.ledgerTransactions, async () => {
      await db.rolls.add(roll);
      if (ledger) await db.ledgerTransactions.add(ledger);
    });
    requestImmediateSync('digital-roll-create');
    return;
  }

  await db.transaction('rw', db.rolls, db.filmStocks, db.ledgerTransactions, db.syncQueue, async () => {
    suppressSyncRecordsForCurrentTransaction();

    const film = roll.filmStockId && roll.filmStockId !== 'digital-placeholder'
      ? await db.filmStocks.get(roll.filmStockId)
      : undefined;
    const consumeInventory = Boolean(film && (film.stockCount || 0) > 0);

    await db.rolls.add(roll);
    if (consumeInventory && film?.id) {
      await db.filmStocks.update(film.id, { stockCount: Math.max(0, (film.stockCount || 0) - 1) });
    }
    if (ledger) {
      await db.ledgerTransactions.add(ledger);
    }

    await db.syncQueue.add(createOperation(userId, 'create_roll_with_inventory', {
      roll,
      consumeInventory,
      ledger,
    }));
  });

  requestImmediateSync('inventory-roll-create');
};

export const adjustFilmStock = async (
  film: Pick<FilmStock, 'id' | 'userId' | 'stockCount'>,
  requestedDelta: number,
): Promise<number> => {
  if (!film.id || !film.userId || !Number.isInteger(requestedDelta)) {
    throw new Error('A film stock id, user id, and whole-number adjustment are required.');
  }

  const currentStock = film.stockCount || 0;
  const nextStock = Math.max(0, currentStock + requestedDelta);
  const appliedDelta = nextStock - currentStock;
  if (appliedDelta === 0) return nextStock;

  await db.transaction('rw', db.filmStocks, db.syncQueue, async () => {
    suppressSyncRecordsForCurrentTransaction();
    await db.filmStocks.update(film.id!, { stockCount: nextStock });
    await db.syncQueue.add(createOperation(film.userId!, 'adjust_film_stock', {
      filmStockId: film.id,
      delta: appliedDelta,
    }));
  });

  requestImmediateSync('inventory-stock-adjust');
  return nextStock;
};
