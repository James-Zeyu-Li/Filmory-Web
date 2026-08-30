import type { Table } from 'dexie';
import { db, type FilmStock } from '../../db/schema';

// --- Utility Functions for Key Case Conversion ---
export const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
export const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

export const localOnlyFields = new Set([
  'blob',
  'cloudUploadPending',
  'cloudUploadError',
  'cloudDeletePending',
  'cloudDeleteError',
  'replacesPhotoId',
  'updatedAt',
  'deletedAt',
]);
export type SyncRecord = Record<string, unknown>;
export type SyncRow = SyncRecord & {
  id?: string;
  userId?: string;
  updatedAt?: number | string;
  addedAt?: number | string;
};

export const isSyncRecord = (value: unknown): value is SyncRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const isFilmStockSyncRow = (value: unknown): value is FilmStock => {
  if (!isSyncRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.brand === 'string'
    && typeof value.name === 'string'
    && typeof value.iso === 'number'
    && (value.colorType === 'color' || value.colorType === 'bw')
    && typeof value.format === 'string'
    && typeof value.isSystem === 'number'
    && typeof value.addedAt === 'number';
};

export const convertKeysToSnakeCase = (obj: unknown): unknown => {
  if (!isSyncRecord(obj)) {
    return Array.isArray(obj) ? obj.map(convertKeysToSnakeCase) : obj;
  }
  if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);

  const newObj: SyncRecord = {};
  for (const [key, value] of Object.entries(obj)) {
    if (localOnlyFields.has(key) || value === undefined) continue;
    newObj[camelToSnake(key)] = convertKeysToSnakeCase(value);
  }
  return newObj;
};

export const convertKeysToCamelCase = (obj: unknown): unknown => {
  if (!isSyncRecord(obj)) {
    return Array.isArray(obj) ? obj.map(convertKeysToCamelCase) : obj;
  }
  if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);

  const newObj: SyncRecord = {};
  for (const [key, value] of Object.entries(obj)) {
    if (localOnlyFields.has(snakeToCamel(key))) continue;
    newObj[snakeToCamel(key)] = convertKeysToCamelCase(value);
  }
  return newObj;
};

// Map Dexie table names to Supabase table names
export const tableMap = {
  cameras: 'cameras',
  cameraSystems: 'camera_systems',
  filmBacks: 'film_backs',
  lenses: 'lenses',
  filmStocks: 'film_stocks',
  rolls: 'rolls',
  photoAssets: 'photo_assets',
  otherEquipments: 'other_equipments',
  collections: 'collections',
  albums: 'albums',
  albumPhotos: 'album_photos',
  tagConfigs: 'tag_configs',
  ledgerTransactions: 'ledger_transactions',
  userProfiles: 'user_profiles'
} as const;

export type SyncTableName = keyof typeof tableMap;

export const isSyncTableName = (value: string): value is SyncTableName => value in tableMap;

// Sync is the only layer that bridges heterogeneous Dexie entities. The cast is
// intentionally isolated here so views never receive an untyped database table.
export const getSyncTable = (tableName: SyncTableName): Table<SyncRow, string> => (
  db[tableName] as unknown as Table<SyncRow, string>
);

export const supabaseTables = Object.values(tableMap);
