import { db } from '../db/schema';

export type GearAvatarTableName = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';

const gearAvatarTables = {
  cameras: db.cameras,
  lenses: db.lenses,
  filmStocks: db.filmStocks,
  otherEquipments: db.otherEquipments,
} as const;

export const updateGearAvatar = async (tableName: GearAvatarTableName, id: string, avatarUrl: string | null) => {
  const updatedCount = await gearAvatarTables[tableName].update(id, { avatarUrl });
  if (updatedCount === 0) {
    throw new Error('Gear record not found');
  }
};

export const removeGearAvatar = async (tableName: GearAvatarTableName, id: string) => {
  await updateGearAvatar(tableName, id, null);
};
