import { db } from '../../db/schema';
import type { CameraDraft, DuplicateGroup, FilmStockDraft, ImportRowResult, LensDraft } from './types';

export const findCameraByNameForUser = async (name: string, userId: string) => {
  const matches = await db.cameras.where('name').equals(name).toArray();
  return matches.find(camera => camera.userId === userId);
};

export const findLensByNameForUser = async (name: string, userId: string) => {
  const matches = await db.lenses.where('name').equals(name).toArray();
  return matches.find(lens => lens.userId === userId);
};

export const findFilmByBrandNameForUser = async (brand: string, name: string, userId: string) => {
  const matches = await db.filmStocks.where('brand').equals(brand).toArray();
  return matches.find(film => film.name === name && film.userId === userId);
};

/**
 * Groups valid draft rows by the existing record they exactly match (by
 * name, or by brand+name for film stock), scoped to the current user only.
 * Multiple incoming rows that match the same existing record share one
 * group (and therefore one user choice). Mutates each row's
 * `duplicateGroupId` in place. Defaults every group's choice to 'skip' —
 * never auto-selects 'update' or fuzzy-matches on partial name similarity.
 */
export const detectDuplicateGroups = async (
  cameraResults: ImportRowResult<CameraDraft>[],
  lensResults: ImportRowResult<LensDraft>[],
  filmStockResults: ImportRowResult<FilmStockDraft>[],
  userId: string,
): Promise<DuplicateGroup[]> => {
  const groups = new Map<string, DuplicateGroup>();

  for (const result of cameraResults) {
    if (result.status === 'rejected' || !result.draft) continue;
    const existing = await findCameraByNameForUser(result.draft.name, userId);
    if (!existing?.id) continue;
    const groupId = `camera:${existing.id}`;
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId, entityKind: 'camera', matchField: 'name',
        existing: { id: existing.id, label: existing.name }, incomingRowRefs: [], choice: 'skip',
      });
    }
    groups.get(groupId)!.incomingRowRefs.push(result.rowRef);
    result.duplicateGroupId = groupId;
  }

  for (const result of lensResults) {
    if (result.status === 'rejected' || !result.draft) continue;
    const existing = await findLensByNameForUser(result.draft.name, userId);
    if (!existing?.id) continue;
    const groupId = `lens:${existing.id}`;
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId, entityKind: 'lens', matchField: 'name',
        existing: { id: existing.id, label: existing.name }, incomingRowRefs: [], choice: 'skip',
      });
    }
    groups.get(groupId)!.incomingRowRefs.push(result.rowRef);
    result.duplicateGroupId = groupId;
  }

  for (const result of filmStockResults) {
    if (result.status === 'rejected' || !result.draft) continue;
    const existing = await findFilmByBrandNameForUser(result.draft.brand, result.draft.name, userId);
    if (!existing?.id) continue;
    const groupId = `filmStock:${existing.id}`;
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId, entityKind: 'filmStock', matchField: 'brandName',
        existing: { id: existing.id, label: `${existing.brand} ${existing.name}` }, incomingRowRefs: [], choice: 'skip',
      });
    }
    groups.get(groupId)!.incomingRowRefs.push(result.rowRef);
    result.duplicateGroupId = groupId;
  }

  return [...groups.values()];
};
