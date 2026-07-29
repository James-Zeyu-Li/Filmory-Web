import { db } from '../db/schema';

export interface CurrencyConversionSummary {
  cameras: number;
  lenses: number;
  filmStocks: number;
  rolls: number;
  otherEquipments: number;
  ledgerTransactions: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const convertMoney = (value: unknown, rate: number) => (
  typeof value === 'number' && Number.isFinite(value)
    ? roundMoney(value * rate)
    : value
);

export const convertCurrentUserMoney = async (
  userId: string,
  rate: number
): Promise<CurrencyConversionSummary> => {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid conversion rate');
  }

  const summary: CurrencyConversionSummary = {
    cameras: 0,
    lenses: 0,
    filmStocks: 0,
    rolls: 0,
    otherEquipments: 0,
    ledgerTransactions: 0,
  };

  await db.transaction(
    'rw',
    [db.cameras, db.lenses, db.filmStocks, db.rolls, db.otherEquipments, db.ledgerTransactions],
    async () => {
      const [cameras, lenses, filmStocks, rolls, otherEquipments, ledgerTransactions] = await Promise.all([
        db.cameras.where('userId').equals(userId).toArray(),
        db.lenses.where('userId').equals(userId).toArray(),
        db.filmStocks.where('userId').equals(userId).toArray(),
        db.rolls.where('userId').equals(userId).toArray(),
        db.otherEquipments.where('userId').equals(userId).toArray(),
        db.ledgerTransactions.where('userId').equals(userId).toArray(),
      ]);

      const cameraUpdates = cameras
        .filter(item => item.id && typeof item.purchasePrice === 'number' && Number.isFinite(item.purchasePrice))
        .map(item => {
          summary.cameras += 1;
          return db.cameras.update(item.id!, { purchasePrice: convertMoney(item.purchasePrice, rate) as number });
        });

      const lensUpdates = lenses
        .filter(item => item.id && typeof item.purchasePrice === 'number' && Number.isFinite(item.purchasePrice))
        .map(item => {
          summary.lenses += 1;
          return db.lenses.update(item.id!, { purchasePrice: convertMoney(item.purchasePrice, rate) as number });
        });

      const filmStockUpdates = filmStocks
        .filter(item => item.id && typeof item.pricePerRoll === 'number' && Number.isFinite(item.pricePerRoll))
        .map(item => {
          summary.filmStocks += 1;
          return db.filmStocks.update(item.id!, { pricePerRoll: convertMoney(item.pricePerRoll, rate) as number });
        });

      const rollUpdates = rolls
        .filter(item => (
          item.id
          && (
            (typeof item.filmPrice === 'number' && Number.isFinite(item.filmPrice))
            || (typeof item.developPrice === 'number' && Number.isFinite(item.developPrice))
          )
        ))
        .map(item => {
          const changes: { filmPrice?: number; developPrice?: number } = {};
          if (typeof item.filmPrice === 'number' && Number.isFinite(item.filmPrice)) {
            changes.filmPrice = convertMoney(item.filmPrice, rate) as number;
          }
          if (typeof item.developPrice === 'number' && Number.isFinite(item.developPrice)) {
            changes.developPrice = convertMoney(item.developPrice, rate) as number;
          }
          summary.rolls += 1;
          return db.rolls.update(item.id!, changes);
        });

      const otherEquipmentUpdates = otherEquipments
        .filter(item => item.id && typeof item.purchasePrice === 'number' && Number.isFinite(item.purchasePrice))
        .map(item => {
          summary.otherEquipments += 1;
          return db.otherEquipments.update(item.id!, { purchasePrice: convertMoney(item.purchasePrice, rate) as number });
        });

      const ledgerTransactionUpdates = ledgerTransactions
        .filter(item => item.id && typeof item.amount === 'number' && Number.isFinite(item.amount))
        .map(item => {
          summary.ledgerTransactions += 1;
          return db.ledgerTransactions.update(item.id!, { amount: convertMoney(item.amount, rate) as number });
        });

      await Promise.all([
        ...cameraUpdates,
        ...lensUpdates,
        ...filmStockUpdates,
        ...rollUpdates,
        ...otherEquipmentUpdates,
        ...ledgerTransactionUpdates,
      ]);
    }
  );

  return summary;
};
