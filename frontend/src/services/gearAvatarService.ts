import { db } from '../db/schema';

export type GearAvatarTableName = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';

export const removeGearAvatar = async (tableName: GearAvatarTableName, id: string) => {
  const table = db[tableName];
  const updatedCount = await table.update(id, { avatarUrl: null });
  if (updatedCount === 0) {
    throw new Error('Gear record not found');
  }
};
