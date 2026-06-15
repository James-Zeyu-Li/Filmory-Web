import Dexie, { type Table } from 'dexie';

export interface Camera {
  id?: number;
  name: string;
  type: 'film' | 'digital';
  format: string; // '135', '120', etc.
  notes?: string;
  addedAt: number;
}

export interface Lens {
  id?: number;
  name: string;
  focalLength: number;
  maxAperture: string; // e.g. 'f/1.8'
  type: string;        // 'prime' or 'zoom'
  addedAt: number;
}

export interface FilmStock {
  id?: number;
  brand: string;
  name: string;
  iso: number;
  colorType: 'color' | 'bw';
  format: string; // '135', '120'
  isSystem: number; // 0 = standard, 1 = system placeholder (digital)
  systemKey?: string; // 'digital'
  addedAt: number;
}

export interface Roll {
  id?: number;
  name: string;
  cameraId: number;
  filmStockId: number;
  status: 'active' | 'archived';
  startDate?: number;
  endDate?: number;
  rating?: number;
  location?: string;
  notes?: string;
  developNotes?: string; // Developer notepad text
  coverPhotoId?: number; // photoAssetId
  filmPrice?: number;
  developPrice?: number;
}

export interface OtherEquipment {
  id?: number;
  name: string;
  type: 'chemical' | 'tripod' | 'cleaner' | 'other';
  notes?: string;
  purchaseDate?: number; // timestamp
  expiryDate?: number;   // timestamp
  addedAt: number;
}

export interface PhotoAsset {
  id?: number;
  rollId: number;
  originalFileName: string;
  fileSize: number;
  blob: Blob; // Stored binary image file
  addedAt: number;
  note?: string;
  focalLength?: number;
  aperture?: string;
  shutterSpeed?: string;
  exposureCompensation?: number;
  isPinned: number; // 0 or 1
  rating?: number;
}

export class FilmoryDatabase extends Dexie {
  cameras!: Table<Camera>;
  lenses!: Table<Lens>;
  filmStocks!: Table<FilmStock>;
  rolls!: Table<Roll>;
  photoAssets!: Table<PhotoAsset>;
  otherEquipments!: Table<OtherEquipment>; // New table

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
  }
}

export const db = new FilmoryDatabase();
