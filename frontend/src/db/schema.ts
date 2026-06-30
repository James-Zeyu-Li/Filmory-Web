import Dexie, { type Table } from 'dexie';

declare global {
  interface Window {
    __filmory_is_pulling?: boolean;
  }
}

export interface SyncQueueItem {
  id?: number;
  userId?: string;
  tableName: string;
  action: 'upsert' | 'delete';
  recordId: string;
  payload?: any;
  timestamp: number;
}

export interface LedgerTransaction {
  id?: string;
  userId?: string;
  amount: number; // Positive for Income, Negative for Expense
  date: number; // timestamp
  type: 'expense' | 'income';
  category: 'camera' | 'lens' | 'film' | 'develop' | 'chemical' | 'repair' | 'accessory' | 'service' | 'other';
  relatedEntityId?: string; // e.g. CameraId, RollId
  notes?: string;
  addedAt: number;
}

export interface UserProfile {
  id: string; // matches userId for 1:1 relation
  userId: string;
  tier: 'regular' | 'vip';
  highResQuotaUsed: number;
  updatedAt?: number;
}

export interface Camera {
  id?: string;
  name: string;
  type: 'film' | 'digital';
  format: string; // '135', '120', etc.
  notes?: string;
  avatarUrl?: string; // Camera profile image URL/relative path
  purchasePrice?: number; // Price of the camera body
  status?: 'active' | 'archived';
  addedAt: number;
  userId?: string;
}

export interface Lens {
  id?: string;
  name: string;
  focalLength: number;
  maxAperture: string; // e.g. 'f/1.8'
  type: string;        // 'prime' or 'zoom'
  avatarUrl?: string;
  purchasePrice?: number;
  status?: 'active' | 'archived';
  addedAt: number;
  userId?: string;
}

export interface FilmStock {
  id?: string;
  brand: string;
  name: string;
  iso: number;
  colorType: 'color' | 'bw';
  format: string; // '135', '120'
  isSystem: number; // 0 = standard, 1 = system placeholder (digital)
  systemKey?: string; // 'digital'
  stockCount?: number; // Inventory count
  pricePerRoll?: number; // Average purchase price per roll
  avatarUrl?: string;
  addedAt: number;
  userId?: string;
}

export interface Roll {
  id?: string;
  name: string;
  cameraIds: string[];
  filmStockId: string;
  status: 'active' | 'archived';
  startDate?: number;
  endDate?: number;
  rating?: number;
  location?: string;
  notes?: string;
  developNotes?: string; // Developer notepad text
  coverPhotoId?: string; // photoAssetId
  filmPrice?: number;
  developPrice?: number;
  userId?: string;
  collectionId?: string;
}

export interface OtherEquipment {
  id?: string;
  name: string;
  type: 'chemical' | 'tripod' | 'cleaner' | 'other';
  notes?: string;
  avatarUrl?: string;
  purchaseDate?: number; // timestamp
  expiryDate?: number;   // timestamp
  purchasePrice?: number;
  addedAt: number;
  userId?: string;
}

export interface PhotoAsset {
  id?: string;
  rollId: string;
  originalFileName: string;
  fileSize: number;
  blob?: Blob; // Stored binary image file (optional, deprecated in backend mode)
  thumbnailUrl?: string; // 300px thumbnail preview
  previewUrl?: string; // 1600px preview
  storageKey?: string; // S3 storage key
  addedAt: number;
  note?: string;
  focalLength?: number;
  aperture?: string;
  shutterSpeed?: string;
  exposureCompensation?: number;
  isPinned: number; // 0 or 1
  rating?: number;
  tags?: string; // Comma-separated list of tag names
  orderIndex?: number; // Used for drag-and-drop manual reordering
  userId?: string;
}

export interface TagConfig {
  id?: string;
  name: string;
  color: string;
  userId?: string;
}


export interface Collection {
  id?: string;
  userId: string;
  name: string;
  date: number;
  description?: string;
  coverUrl?: string;
  addedAt: number;
}

export interface Album {
  id?: string;
  name: string;
  description?: string;
  coverPhotoId?: string; // cover photoAssetId
  addedAt: number;
  userId?: string;
}

export interface AlbumPhoto {
  id?: string;
  albumId: string;
  photoId: string;
  addedAt: number;
}

export class FilmoryDatabase extends Dexie {
  cameras!: Table<Camera>;
  lenses!: Table<Lens>;
  filmStocks!: Table<FilmStock>;
  rolls!: Table<Roll>;
  photoAssets!: Table<PhotoAsset>;
  otherEquipments!: Table<OtherEquipment>;
  collections!: Table<Collection, string>;
  albums!: Table<Album, string>;
  albumPhotos!: Table<AlbumPhoto, string>;
  tagConfigs!: Table<TagConfig, string>;
  ledgerTransactions!: Table<LedgerTransaction>;
  syncQueue!: Table<SyncQueueItem>;
  userProfiles!: Table<UserProfile, string>;

  constructor() {
    super('FilmoryDatabase');
    this.version(1).stores({
      cameras: '++id, name, type, format, addedAt',
      lenses: '++id, name, focalLength, maxAperture, type, addedAt',
      filmStocks: '++id, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: '++id, name, cameraId, filmStockId, status, startDate, endDate, rating, location',
      photoAssets: '++id, rollId, originalFileName, fileSize, addedAt, isPinned, rating'
    });

    this.version(2).stores({
      cameras: '++id, name, type, format, addedAt',
      lenses: '++id, name, focalLength, maxAperture, type, addedAt',
      filmStocks: '++id, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: '++id, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: '++id, rollId, originalFileName, fileSize, addedAt, isPinned, rating',
      otherEquipments: '++id, name, type, notes, purchaseDate, expiryDate, addedAt'
    });

    this.version(3).stores({
      cameras: '++id, name, type, format, avatarUrl, addedAt',
      lenses: '++id, name, focalLength, maxAperture, type, addedAt',
      filmStocks: '++id, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: '++id, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: '++id, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating',
      otherEquipments: '++id, name, type, notes, purchaseDate, expiryDate, addedAt'
    });

    this.version(4).stores({
      cameras: '++id, name, type, format, avatarUrl, addedAt',
      lenses: '++id, name, focalLength, maxAperture, type, addedAt',
      filmStocks: '++id, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: '++id, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: '++id, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating',
      otherEquipments: '++id, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: '++id, name, description, coverPhotoId, addedAt',
      albumPhotos: '++id, albumId, photoId, addedAt'
    });

    this.version(5).stores({
      cameras: '++id, name, type, format, avatarUrl, addedAt',
      lenses: '++id, name, focalLength, maxAperture, type, addedAt',
      filmStocks: '++id, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: '++id, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: '++id, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags',
      otherEquipments: '++id, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: '++id, name, description, coverPhotoId, addedAt',
      albumPhotos: '++id, albumId, photoId, addedAt',
      tagConfigs: '++id, &name, color',
      ledgerTransactions: '++id, userId, type, category, relatedEntityId, date, addedAt'
    });

    this.version(6).stores({
      cameras: '++id, name, type, format, avatarUrl, addedAt',
      lenses: '++id, name, focalLength, maxAperture, type, addedAt',
      filmStocks: '++id, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: '++id, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: '++id, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: '++id, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: '++id, name, description, coverPhotoId, addedAt',
      albumPhotos: '++id, albumId, photoId, addedAt',
      tagConfigs: '++id, &name, color'
    });

    this.version(7).stores({
      cameras: '++id, userId, name, type, format, avatarUrl, addedAt',
      lenses: '++id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: '++id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: '++id, userId, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: '++id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: '++id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: '++id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: '++id, userId, albumId, photoId, addedAt',
      tagConfigs: '++id, userId, &name, color'
    });

    // Version 8: Move from ++id to string UUIDs for cloud synchronization
    this.version(8).stores({
      cameras: 'id, userId, name, type, format, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color'
    });

    // Version 9: Add syncQueue for offline-first sync engine
    this.version(9).stores({
      cameras: 'id, userId, name, type, format, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color',
      syncQueue: '++id, tableName, action, recordId, timestamp'
    });

    // Version 10: Hotfix missing userId index on albumPhotos
    this.version(10).stores({
      cameras: 'id, userId, name, type, format, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color',
      syncQueue: '++id, tableName, action, recordId, timestamp'
    });

    // Version 11: Add ledgerTransactions
    this.version(11).stores({
      cameras: 'id, userId, name, type, format, avatarUrl, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color',
      syncQueue: '++id, tableName, action, recordId, timestamp',
      ledgerTransactions: 'id, userId, amount, date, type, category, relatedEntityId, addedAt'
    });

    // Version 12: Add userProfiles for VIP subscription limitations
    this.version(12).stores({
      cameras: 'id, userId, name, type, format, avatarUrl, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color',
      syncQueue: '++id, tableName, action, recordId, timestamp',
      ledgerTransactions: 'id, userId, amount, date, type, category, relatedEntityId, addedAt',
      userProfiles: 'id, userId, tier'
    });


    // Version 13: Change rolls to support multiple cameras and film stocks (cameraIds, filmStockIds)
    this.version(13).stores({
      cameras: 'id, userId, name, type, format, avatarUrl, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, *cameraIds, *filmStockIds, status, startDate, endDate, rating, location, developNotes',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color',
      syncQueue: '++id, tableName, action, recordId, timestamp',
      ledgerTransactions: 'id, userId, amount, date, type, category, relatedEntityId, addedAt',
      userProfiles: 'id, userId, tier'
    }).upgrade(tx => {
      return tx.table('rolls').toCollection().modify(roll => {
        if (roll.cameraId !== undefined && !roll.cameraIds) {
          roll.cameraIds = [roll.cameraId];
          delete roll.cameraId;
        }
        if (roll.filmStockId !== undefined && !roll.filmStockIds) {
          roll.filmStockIds = [roll.filmStockId];
          delete roll.filmStockId;
        }
      });
    });


    // Version 14: Revert rolls to use singular filmStockId, keep cameraIds
    this.version(14).stores({
      cameras: 'id, userId, name, type, format, avatarUrl, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, *cameraIds, filmStockId, status, startDate, endDate, rating, location, developNotes',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color',
      syncQueue: '++id, tableName, action, recordId, timestamp',
      ledgerTransactions: 'id, userId, amount, date, type, category, relatedEntityId, addedAt',
      userProfiles: 'id, userId, tier'
    }).upgrade(tx => {
      return tx.table('rolls').toCollection().modify(roll => {
        if (roll.filmStockIds && roll.filmStockIds.length > 0) {
          roll.filmStockId = roll.filmStockIds[0];
          delete roll.filmStockIds;
        } else if (roll.filmStockIds) {
          roll.filmStockId = 'digital-placeholder';
          delete roll.filmStockIds;
        }
      });
    });

    // Version 15: Add collections (Shooting Projects) and roll.collectionId
    this.version(15).stores({
      cameras: 'id, userId, name, type, format, avatarUrl, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, *cameraIds, filmStockId, status, startDate, endDate, rating, location, developNotes, collectionId',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color',
      syncQueue: '++id, tableName, action, recordId, timestamp',
      ledgerTransactions: 'id, userId, amount, date, type, category, relatedEntityId, addedAt',
      userProfiles: 'id, userId, tier',
      collections: 'id, userId, name, date, addedAt'
    });

    // Version 16: Add userId index to sync queue for local multi-tenant isolation
    this.version(16).stores({
      cameras: 'id, userId, name, type, format, avatarUrl, addedAt',
      lenses: 'id, userId, name, focalLength, maxAperture, type, addedAt',
      filmStocks: 'id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt',
      rolls: 'id, userId, name, *cameraIds, filmStockId, status, startDate, endDate, rating, location, developNotes, collectionId',
      photoAssets: 'id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex',
      otherEquipments: 'id, userId, name, type, notes, purchaseDate, expiryDate, addedAt',
      albums: 'id, userId, name, description, coverPhotoId, addedAt',
      albumPhotos: 'id, userId, albumId, photoId, addedAt',
      tagConfigs: 'id, userId, &name, color',
      syncQueue: '++id, userId, tableName, action, recordId, timestamp',
      ledgerTransactions: 'id, userId, amount, date, type, category, relatedEntityId, addedAt',
      userProfiles: 'id, userId, tier',
      collections: 'id, userId, name, date, addedAt'
    });

    // Auto-inject userId and track sync changes on creation
    this.on('ready', () => {
      this.tables.forEach(table => {
        if (table.name === 'syncQueue') return; // Do not intercept queue itself

        table.hook('creating', (primKey, obj) => {
          const currentUserId = localStorage.getItem('filmory_user_id') || 'mock_uid_123';
          if (typeof obj === 'object' && obj !== null && !('userId' in obj)) {
            obj.userId = currentUserId;
          }
          
          // Force UUID if not provided
          let assignedId = primKey;
          if (!assignedId && typeof crypto !== 'undefined' && crypto.randomUUID) {
            obj.id = crypto.randomUUID();
            assignedId = obj.id;
          }

          if (!window.__filmory_is_pulling) {
            this.syncQueue.add({
              userId: obj.userId || currentUserId,
              tableName: table.name,
              action: 'upsert',
              recordId: assignedId as string,
              payload: obj,
              timestamp: Date.now()
            });
          }

          if (!primKey && assignedId) {
            return assignedId;
          }
        });

        table.hook('updating', (modifications, primKey, obj) => {
          if (!window.__filmory_is_pulling) {
            const updatedObj = { ...obj, ...modifications };
            const currentUserId = updatedObj.userId || localStorage.getItem('filmory_user_id') || 'mock_uid_123';
            this.syncQueue.add({
              userId: currentUserId,
              tableName: table.name,
              action: 'upsert',
              recordId: primKey as string,
              payload: updatedObj,
              timestamp: Date.now()
            });
          }
        });

        table.hook('deleting', (primKey, obj: any) => {
          if (!window.__filmory_is_pulling) {
            const currentUserId = obj?.userId || localStorage.getItem('filmory_user_id') || 'mock_uid_123';
            this.syncQueue.add({
              userId: currentUserId,
              tableName: table.name,
              action: 'delete',
              recordId: primKey as string,
              timestamp: Date.now()
            });
          }
        });
      });
    });
  }
}

export const db = new FilmoryDatabase();
