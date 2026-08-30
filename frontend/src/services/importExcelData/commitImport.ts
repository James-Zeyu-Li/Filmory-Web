import * as XLSX from 'xlsx';
import {
  db,
  suppressSyncRecordsForCurrentTransaction,
  type LedgerTransaction,
  type Roll,
  type SyncRecordQueueItem,
} from '../../db/schema';
import { requestImmediateSync } from '../syncEvents';
import { writeRollWithInventory, writeFilmStockAdjustment } from '../inventoryOperationService';
import { buildColumnMappings } from './columnMapping';
import {
  validateCameraRows, validateFilmStockRows, validateLensRows, validateRollRows, type ExcelRow,
} from './validateRows';
import { detectDuplicateGroups, findCameraByNameForUser, findFilmByBrandNameForUser, findLensByNameForUser } from './duplicateDetection';
import { buildInstantArchiveSummary } from './instantArchiveSummary';
import type {
  DuplicateChoiceMap, EntityReference, ImportColumnMapping, ImportEntityKind,
  ImportExcelTranslator, ImportPreview, ImportResult, ImportRowResult, ImportSheetName,
} from './types';

const SHEETS: ImportSheetName[] = ['相机机身', '镜头', '胶卷库存', '拍摄任务'];

const getRows = (workbook: XLSX.WorkBook, sheetName: ImportSheetName): ExcelRow[] => {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' }) : [];
};

const getSheetHeaders = (workbook: XLSX.WorkBook, sheetName: ImportSheetName): string[] => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const headerRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  return (headerRows[0] as unknown as string[]) ?? [];
};

export const parseAndValidateExcelImport = async (
  file: File,
  userId: string,
  _t?: ImportExcelTranslator,
  mappingOverrides?: ImportColumnMapping[],
): Promise<ImportPreview> => {
  if (!userId) {
    throw new Error('Excel import needs a valid user identity and blocked cross-account import.');
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });

  const mappings = SHEETS.flatMap(sheet => {
    const override = mappingOverrides?.filter(mapping => mapping.sheet === sheet);
    return override && override.length > 0 ? override : buildColumnMappings(sheet, getSheetHeaders(workbook, sheet));
  });
  const mappingsFor = (sheet: ImportSheetName) => mappings.filter(mapping => mapping.sheet === sheet);

  const cameraRows = validateCameraRows(getRows(workbook, '相机机身'), mappingsFor('相机机身'));
  const lensRows = validateLensRows(getRows(workbook, '镜头'), mappingsFor('镜头'));
  const filmStockRows = validateFilmStockRows(getRows(workbook, '胶卷库存'), mappingsFor('胶卷库存'));
  const rollRows = await validateRollRows(
    getRows(workbook, '拍摄任务'),
    mappingsFor('拍摄任务'),
    cameraRows,
    filmStockRows,
    async name => {
      const camera = await findCameraByNameForUser(name, userId);
      return camera?.id ? { id: camera.id } : undefined;
    },
    async (brand, name) => {
      const film = await findFilmByBrandNameForUser(brand, name, userId);
      return film?.id ? { id: film.id } : undefined;
    },
  );

  const duplicateGroups = await detectDuplicateGroups(cameraRows, lensRows, filmStockRows, userId);

  const allRows: ImportRowResult[] = [...cameraRows, ...lensRows, ...filmStockRows, ...rollRows];
  const counts = {
    valid: allRows.filter(row => row.status === 'valid').length,
    warning: allRows.filter(row => row.status === 'warning').length,
    rejected: allRows.filter(row => row.status === 'rejected').length,
  };

  return {
    fileName: file.name,
    mappings,
    rows: { cameras: cameraRows, lenses: lensRows, filmStocks: filmStockRows, rolls: rollRows },
    duplicateGroups,
    counts,
  };
};

const emptyEntityCounts = (): Record<ImportEntityKind, number> => ({ camera: 0, lens: 0, filmStock: 0, roll: 0 });

export const commitExcelImport = async (
  preview: ImportPreview,
  duplicateChoices: DuplicateChoiceMap,
  userId: string,
  t?: ImportExcelTranslator,
): Promise<ImportResult> => {
  if (!userId) {
    throw new Error('Excel import needs a valid user identity and blocked cross-account import.');
  }

  const createdCounts = emptyEntityCounts();
  const updatedCounts = emptyEntityCounts();
  const skippedCounts = emptyEntityCounts();
  const failedCounts = emptyEntityCounts();
  const createdRollIds: string[] = [];
  let wroteAnything = false;

  const resolveChoice = (row: ImportRowResult) => (
    row.duplicateGroupId ? (duplicateChoices[row.duplicateGroupId] ?? 'skip') : 'skip'
  );

  await db.transaction(
    'rw', [db.cameras, db.lenses, db.filmStocks, db.rolls, db.ledgerTransactions, db.syncQueue],
    async () => {
      // Suppressing up front turns off the ordinary per-table `creating` hook
      // (schema.ts) for this whole transaction, since that hook defers its
      // actual db.syncQueue.add(...) to the transaction's 'complete' event —
      // an async step outside this transaction's atomic scope. Every write
      // below manually enqueues its own sync record instead, so every
      // syncQueue entry this import produces is committed before this
      // transaction resolves.
      suppressSyncRecordsForCurrentTransaction();

      const enqueueRecordSync = async (tableName: string, recordId: string, payload: Record<string, unknown>) => {
        const item: SyncRecordQueueItem = { tableName, action: 'upsert', recordId, payload, timestamp: Date.now() };
        await db.syncQueue.add(item);
        wroteAnything = true;
      };

      const rowRefToEntityId = new Map<string, string>();

      for (const row of preview.rows.cameras) {
        if (row.status === 'rejected' || !row.draft) continue;
        const draft = row.draft;
        const choice = resolveChoice(row);
        if (choice === 'update') {
          throw new Error(t?.('excel.reasonUpdateNotSupported') ?? 'Updating matched items is not supported yet.');
        }
        const existing = choice === 'import-as-new' ? undefined : await findCameraByNameForUser(draft.name, userId);
        if (existing?.id) {
          rowRefToEntityId.set(row.rowRef, existing.id);
          skippedCounts.camera += 1;
          continue;
        }
        const id = crypto.randomUUID();
        const record = {
          id, userId, name: draft.name, type: draft.type, format: draft.format,
          purchasePrice: draft.purchasePrice, addedAt: Date.now(),
        };
        await db.cameras.add(record);
        await enqueueRecordSync('cameras', id, record);
        rowRefToEntityId.set(row.rowRef, id);
        createdCounts.camera += 1;
      }

      for (const row of preview.rows.lenses) {
        if (row.status === 'rejected' || !row.draft) continue;
        const draft = row.draft;
        const choice = resolveChoice(row);
        if (choice === 'update') {
          throw new Error(t?.('excel.reasonUpdateNotSupported') ?? 'Updating matched items is not supported yet.');
        }
        const existing = choice === 'import-as-new' ? undefined : await findLensByNameForUser(draft.name, userId);
        if (existing?.id) {
          rowRefToEntityId.set(row.rowRef, existing.id);
          skippedCounts.lens += 1;
          continue;
        }
        const id = crypto.randomUUID();
        const record = {
          id, userId, name: draft.name, focalLength: draft.focalLength, maxAperture: draft.maxAperture,
          type: draft.type, purchasePrice: draft.purchasePrice, addedAt: Date.now(),
        };
        await db.lenses.add(record);
        await enqueueRecordSync('lenses', id, record);
        rowRefToEntityId.set(row.rowRef, id);
        createdCounts.lens += 1;
      }

      for (const row of preview.rows.filmStocks) {
        if (row.status === 'rejected' || !row.draft) continue;
        const draft = row.draft;
        const choice = resolveChoice(row);
        if (choice === 'update') {
          throw new Error(t?.('excel.reasonUpdateNotSupported') ?? 'Updating matched items is not supported yet.');
        }
        const existing = choice === 'import-as-new' ? undefined : await findFilmByBrandNameForUser(draft.brand, draft.name, userId);
        if (existing?.id) {
          rowRefToEntityId.set(row.rowRef, existing.id);
          skippedCounts.filmStock += 1;
          continue;
        }
        const id = crypto.randomUUID();
        const record = {
          id, userId, brand: draft.brand, name: draft.name, iso: draft.iso, colorType: draft.colorType,
          format: draft.format, stockCount: 0, pricePerRoll: draft.pricePerRoll, isSystem: 0, addedAt: Date.now(),
        };
        await db.filmStocks.add(record);
        await enqueueRecordSync('filmStocks', id, record);
        rowRefToEntityId.set(row.rowRef, id);
        createdCounts.filmStock += 1;

        if (draft.stockCount > 0) {
          await writeFilmStockAdjustment({ id, userId }, draft.stockCount);
          wroteAnything = true;
        }
        if ((draft.pricePerRoll ?? 0) > 0 && draft.stockCount > 0) {
          const ledger: LedgerTransaction = {
            id: crypto.randomUUID(), userId, amount: -(draft.pricePerRoll! * draft.stockCount), date: Date.now(),
            type: 'expense', category: 'film', relatedEntityId: id,
            notes: t?.('excel.ledgerStockNote', { film: `${draft.brand} ${draft.name}`, count: draft.stockCount })
              ?? `Batch imported stock: ${draft.brand} ${draft.name} (${draft.stockCount} rolls)`,
            addedAt: Date.now(),
          };
          await db.ledgerTransactions.add(ledger);
          await enqueueRecordSync('ledgerTransactions', ledger.id!, ledger as unknown as Record<string, unknown>);
        }
      }

      const resolveEntityRef = async (
        ref: EntityReference | undefined,
        reResolve: (id: string) => Promise<boolean>,
      ): Promise<string | undefined> => {
        if (!ref) return undefined;
        if (ref.kind === 'draft') return rowRefToEntityId.get(ref.rowRef);
        // 'existing' refs are re-confirmed live rather than trusting the preview snapshot.
        return (await reResolve(ref.entityId)) ? ref.entityId : undefined;
      };

      for (const row of preview.rows.rolls) {
        if (row.status === 'rejected' || !row.draft) continue;
        const draft = row.draft;

        const cameraId = await resolveEntityRef(draft.cameraRef, async id => {
          const camera = await db.cameras.get(id);
          return Boolean(camera && camera.userId === userId);
        });
        if (!cameraId) {
          failedCounts.roll += 1;
          continue;
        }

        let filmStockId: string | undefined;
        if (draft.filmRef) {
          filmStockId = await resolveEntityRef(draft.filmRef, async id => {
            const film = await db.filmStocks.get(id);
            return Boolean(film && film.userId === userId);
          });
          if (!filmStockId) {
            failedCounts.roll += 1;
            continue;
          }
        }

        const id = crypto.randomUUID();
        const roll: Roll = {
          id, userId, name: draft.name, currentCameraId: cameraId, cameraIds: [cameraId],
          filmStockId: filmStockId || 'digital-placeholder', status: 'active', startDate: Date.now(),
          location: draft.location,
        };
        const ledger: LedgerTransaction | undefined = (draft.developmentCost ?? 0) > 0 ? {
          id: crypto.randomUUID(), userId, amount: -draft.developmentCost!, date: Date.now(),
          type: 'expense', category: 'develop', relatedEntityId: id,
          notes: t?.('excel.ledgerDevelopNote', { roll: draft.name }) ?? `Imported roll development cost: ${draft.name}`,
          addedAt: Date.now(),
        } : undefined;

        await writeRollWithInventory({ roll, ledger });
        wroteAnything = true;
        // The film branch inside writeRollWithInventory self-suppresses and
        // carries roll+ledger inside its own operation queue entry. The
        // digital branch does neither (matching its pre-existing, unchanged
        // behavior outside this transaction), so — now that the ordinary
        // hook is suppressed for this whole transaction — we enqueue its
        // record sync entries ourselves.
        if (!filmStockId) {
          await enqueueRecordSync('rolls', id, roll as unknown as Record<string, unknown>);
          if (ledger) await enqueueRecordSync('ledgerTransactions', ledger.id!, ledger as unknown as Record<string, unknown>);
        }

        createdRollIds.push(id);
        createdCounts.roll += 1;
      }
    },
  );

  if (wroteAnything) {
    requestImmediateSync('excel-import');
  }

  const instantArchive = await buildInstantArchiveSummary(createdRollIds, userId);
  const representativeCameraId = instantArchive.topCamera?.cameraId
    ?? (createdRollIds.length > 0 ? (await db.rolls.get(createdRollIds[0]))?.currentCameraId : undefined);

  return {
    createdCounts, updatedCounts, skippedCounts, failedCounts, createdRollIds, representativeCameraId, instantArchive,
  };
};
