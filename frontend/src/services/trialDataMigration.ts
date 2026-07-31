import { db } from '../db/schema';
import { TRIAL_USER_ID } from './trialPolicy';

const TRIAL_MIGRATION_STORAGE_KEY = 'filmory_trial_migrated_to_user';

const USER_SCOPED_TABLES = [
  'cameras',
  'cameraSystems',
  'filmBacks',
  'lenses',
  'filmStocks',
  'rolls',
  'photoAssets',
  'otherEquipments',
  'collections',
  'albums',
  'albumPhotos',
  'tagConfigs',
  'ledgerTransactions',
] as const;

type UserScopedTableName = typeof USER_SCOPED_TABLES[number];

const getUserScopedTable = (tableName: UserScopedTableName) => (
  db[tableName] as any
);

const countRecordsForUser = async (userId: string) => {
  const counts = await Promise.all(
    USER_SCOPED_TABLES.map(tableName => getUserScopedTable(tableName).where('userId').equals(userId).count())
  );
  return counts.reduce((total, count) => total + count, 0);
};

export type TrialDataMigrationResult =
  | 'migrated'
  | 'no-trial-data'
  | 'target-has-data'
  | 'same-user';

export const migrateTrialDataToUser = async (targetUserId: string): Promise<TrialDataMigrationResult> => {
  if (!targetUserId || targetUserId === TRIAL_USER_ID) {
    return 'same-user';
  }

  const trialRecordCount = await countRecordsForUser(TRIAL_USER_ID);
  if (trialRecordCount === 0) {
    return 'no-trial-data';
  }

  const targetRecordCount = await countRecordsForUser(targetUserId);
  if (targetRecordCount > 0) {
    return 'target-has-data';
  }

  for (const tableName of USER_SCOPED_TABLES) {
    const table = getUserScopedTable(tableName);
    const records = await table.where('userId').equals(TRIAL_USER_ID).toArray();
    for (const record of records) {
      await table.update(record.id, { userId: targetUserId });
    }
  }

  const trialQueueItems = await db.syncQueue.where('userId').equals(TRIAL_USER_ID).toArray();
  await db.syncQueue.bulkDelete(
    trialQueueItems
      .map(item => item.id)
      .filter((id): id is number => typeof id === 'number')
  );

  localStorage.setItem(TRIAL_MIGRATION_STORAGE_KEY, targetUserId);
  return 'migrated';
};
