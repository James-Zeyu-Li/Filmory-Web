import type { TranslationKey } from '../../i18n/translations';

export type ImportExcelTranslator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export type ImportSheetName = '相机机身' | '镜头' | '胶卷库存' | '拍摄任务';
export type ImportEntityKind = 'camera' | 'lens' | 'filmStock' | 'roll';
export type ImportRowStatus = 'valid' | 'warning' | 'rejected';
export type DuplicateChoice = 'skip' | 'update' | 'import-as-new';

export interface CameraDraft {
  name: string;
  type: 'film' | 'digital';
  format: string;
  purchasePrice?: number;
}

export interface LensDraft {
  name: string;
  focalLength: number;
  maxAperture: string;
  type: string;
  purchasePrice?: number;
}

export interface FilmStockDraft {
  brand: string;
  name: string;
  iso: number;
  colorType: 'color' | 'bw';
  format: string;
  stockCount: number;
  pricePerRoll?: number;
}

// A reference to either an already-existing Dexie record (resolved at
// preview time and re-confirmed at commit time) or a specific draft row
// parsed from the same workbook (resolved by rowRef, never by name again).
export type EntityReference =
  | { kind: 'existing'; entityId: string }
  | { kind: 'draft'; rowRef: string };

export interface RollDraft {
  name: string;
  cameraRef: EntityReference;
  filmRef?: EntityReference; // absent for digital cameras
  location?: string;
  developmentCost?: number;
}

export type ImportDraft = CameraDraft | LensDraft | FilmStockDraft | RollDraft;

export interface ImportRowIssue {
  field: string;
  reasonKey: TranslationKey;
  reasonValues?: Record<string, string | number>;
  severity: 'warning' | 'error';
}

export interface ImportRowResult<TDraft extends ImportDraft = ImportDraft> {
  sheet: ImportSheetName;
  rowNumber: number;
  rowRef: string; // `${sheet}:${rowNumber}`, stable within one import
  status: ImportRowStatus;
  issues: ImportRowIssue[];
  draft?: TDraft;
  duplicateGroupId?: string;
  // The row's best-effort parsed name (camera/lens name, or "brand model" for
  // film stock), set regardless of status so a rejected row can still be
  // matched (and then itself rejected) by a Roll row referencing it by name.
  matchName?: string;
}

export interface ImportColumnMapping {
  sheet: ImportSheetName;
  expectedField: string;
  expectedLabel: string;
  matchedHeader: string | null;
  required: boolean;
  status: 'auto-matched' | 'needs-user-choice' | 'skipped';
}

export interface DuplicateGroup {
  id: string;
  entityKind: 'camera' | 'lens' | 'filmStock';
  matchField: 'name' | 'brandName';
  existing: { id: string; label: string };
  incomingRowRefs: string[];
  choice: DuplicateChoice;
}

export interface ImportPreview {
  fileName: string;
  mappings: ImportColumnMapping[];
  actualHeadersBySheet: Record<ImportSheetName, string[]>;
  rows: {
    cameras: ImportRowResult<CameraDraft>[];
    lenses: ImportRowResult<LensDraft>[];
    filmStocks: ImportRowResult<FilmStockDraft>[];
    rolls: ImportRowResult<RollDraft>[];
  };
  duplicateGroups: DuplicateGroup[];
  counts: { valid: number; warning: number; rejected: number };
}

export type DuplicateChoiceMap = Record<string, DuplicateChoice>; // keyed by DuplicateGroup.id

export interface InstantArchiveSummary {
  importedRollCount: number;
  dateRange?: { earliest: number; latest: number };
  topCamera?: { cameraId: string; name: string; count: number };
  topFilmStock?: { filmStockId: string; label: string; count: number };
  isFallbackSummary: boolean;
}

export interface ImportResult {
  createdCounts: Record<ImportEntityKind, number>;
  updatedCounts: Record<ImportEntityKind, number>;
  skippedCounts: Record<ImportEntityKind, number>;
  failedCounts: Record<ImportEntityKind, number>;
  createdRollIds: string[];
  representativeCameraId?: string;
  instantArchive: InstantArchiveSummary;
}

// Kept for the existing (unchanged) ExcelImportModal.tsx caller — a thin
// projection of ImportResult onto the old toast summary shape.
export interface ImportExcelSummary {
  camerasAdded: number;
  lensesAdded: number;
  filmsAdded: number;
  rollsAdded: number;
  errors: string[];
}
