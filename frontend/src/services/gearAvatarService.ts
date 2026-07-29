import { db } from '../db/schema';

export type GearAvatarTableName = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';

export const removeGearAvatar = async (tableName: GearAvatarTableName, id: string) => {
  const table = db[tableName];
  const updatedCount = await table.update(id, { avatarUrl: null });
  if (updatedCount === 0) {
    throw new Error('Gear record not found');
  }

  const updatedRecord = await table.get(id);
  if (!updatedRecord) {
    throw new Error('Gear record not found');
  }

  await db.syncQueue.add({
    userId: updatedRecord.userId,
    tableName,
    action: 'upsert',
    recordId: id,
    payload: updatedRecord,
    timestamp: Date.now(),
  });
};
