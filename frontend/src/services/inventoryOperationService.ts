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

// Transaction-scoped write. Performs only Dexie reads/writes (including the
// syncQueue operation entry for film rolls) — no sync trigger. Callable
// either by the public wrapper below (which opens its own transaction) or by
// another caller's own outer transaction, as long as that transaction locks
// at least the same tables this function touches.
export const writeRollWithInventory = async ({ roll, ledger }: CreateRollWithInventoryInput): Promise<void> => {
  const userId = roll.userId;
  if (!roll.id || !userId) {
    throw new Error('A roll id and user id are required for inventory synchronization.');
  }

  // Digital rolls do not consume film inventory. Keep them on the ordinary
  // record queue instead of passing the local digital placeholder to a UUID RPC.
  if (!roll.filmStockId || roll.filmStockId === 'digital-placeholder') {
    await db.rolls.add(roll);
    if (ledger) await db.ledgerTransactions.add(ledger);
    return;
  }

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
};

export const createRollWithInventory = async (input: CreateRollWithInventoryInput): Promise<void> => {
  const isDigitalRoll = !input.roll.filmStockId || input.roll.filmStockId === 'digital-placeholder';
  await db.transaction(
    'rw',
    isDigitalRoll ? [db.rolls, db.ledgerTransactions] : [db.rolls, db.filmStocks, db.ledgerTransactions, db.syncQueue],
    () => writeRollWithInventory(input),
  );
  requestImmediateSync(isDigitalRoll ? 'digital-roll-create' : 'inventory-roll-create');
};

// Transaction-scoped write (same contract as writeRollWithInventory above):
// only Dexie reads/writes, no sync trigger.
export const writeFilmStockAdjustment = async (
  film: Pick<FilmStock, 'id' | 'userId'>,
  requestedDelta: number,
): Promise<{ nextStock: number; didQueueOperation: boolean }> => {
  // Read inside the transaction so rapid clicks never calculate a delta from
  // an obsolete React/Dexie snapshot.
  const currentFilm = await db.filmStocks.get(film.id!);
  if (!currentFilm || currentFilm.userId !== film.userId) {
    throw new Error('Film stock is unavailable for the current user.');
  }

  const currentStock = currentFilm.stockCount || 0;
  const nextStock = Math.max(0, currentStock + requestedDelta);
  const appliedDelta = nextStock - currentStock;
  if (appliedDelta === 0) return { nextStock, didQueueOperation: false };

  suppressSyncRecordsForCurrentTransaction();
  await db.filmStocks.update(film.id!, { stockCount: nextStock });
  await db.syncQueue.add(createOperation(film.userId!, 'adjust_film_stock', {
    filmStockId: film.id,
    delta: appliedDelta,
  }));
  return { nextStock, didQueueOperation: true };
};

export const adjustFilmStock = async (
  film: Pick<FilmStock, 'id' | 'userId'>,
  requestedDelta: number,
): Promise<number> => {
  if (!film.id || !film.userId || !Number.isInteger(requestedDelta)) {
    throw new Error('A film stock id, user id, and whole-number adjustment are required.');
  }

  let result = { nextStock: 0, didQueueOperation: false };
  await db.transaction('rw', db.filmStocks, db.syncQueue, async () => {
    result = await writeFilmStockAdjustment(film, requestedDelta);
  });

  if (result.didQueueOperation) {
    requestImmediateSync('inventory-stock-adjust');
  }
  return result.nextStock;
};
