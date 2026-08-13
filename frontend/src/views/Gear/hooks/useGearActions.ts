import {
  db,
  type Camera,
  type FilmStock,
  type LedgerTransaction,
  type Lens,
  type OtherEquipment,
} from '../../../db/schema';
import { useAuth } from '../../../contexts/useAuth';
import { useConfirm } from '../../../contexts/useConfirm';
import { useFeedback } from '../../../contexts/useFeedback';
import { useLanguage } from '../../../contexts/useLanguage';
import { useTrialGate } from '../../../contexts/useTrialGate';
import { adjustFilmStock } from '../../../services/inventoryOperationService';
import { requestImmediateSync } from '../../../services/syncEvents';

export type GearSaveResult = 'saved' | 'cancelled' | 'trial-blocked' | 'invalid';

export interface SaveCameraInput {
  draft: Partial<Camera>;
  editingId: string | null;
  existingCameras: Camera[];
  cameraSystemMode: 'new' | 'existing';
  selectedExistingCameraSystemId: string;
  cameraSystemName: string;
  cameraBackNames: string[];
  timestamp: number;
}

export interface SaveLensInput {
  draft: Partial<Lens>;
  editingId: string | null;
  existingLenses: Lens[];
}

export interface SaveFilmStockInput {
  draft: Partial<FilmStock>;
  editingId: string | null;
  existingFilmStocks: readonly FilmStock[];
}

export interface SaveOtherEquipmentInput {
  draft: Partial<OtherEquipment>;
  editingId: string | null;
  existingEquipment: OtherEquipment[];
}

export interface ArchiveGearInput {
  id: string;
  type: 'camera' | 'lens';
  name: string;
  salePrice: number | '';
}

export interface AddFilmBackInput {
  cameraSystemId: string;
  name: string;
  timestamp: number;
}

const equipmentLedgerCategories: Record<OtherEquipment['type'], LedgerTransaction['category']> = {
  chemical: 'chemical',
  tripod: 'accessory',
  cleaner: 'accessory',
  other: 'other',
};

export const useGearActions = () => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const { t } = useLanguage();
  const { guardTrialResource } = useTrialGate();
  const currentUserId = user?.id || 'offline';

  const saveCamera = async ({
    draft,
    editingId,
    existingCameras,
    cameraSystemMode,
    selectedExistingCameraSystemId,
    cameraSystemName,
    cameraBackNames,
    timestamp,
  }: SaveCameraInput): Promise<GearSaveResult> => {
    if (!draft.name) return 'invalid';
    const cameraName = draft.name;

    if (!editingId && !guardTrialResource({ resource: 'cameras', currentCount: existingCameras.length })) {
      return 'trial-blocked';
    }

    const is120Camera = draft.format === '120';
    const isInterchangeable120 = is120Camera && draft.backType === 'interchangeable';
    if (
      !editingId &&
      isInterchangeable120 &&
      cameraSystemMode === 'existing' &&
      !selectedExistingCameraSystemId
    ) {
      notify({
        type: 'error',
        title: t('gear.chooseCameraSystemTitle'),
        message: t('gear.chooseCameraSystemMessage'),
      });
      return 'invalid';
    }

    if (!editingId && existingCameras.some(camera => camera.name === cameraName)) {
      const confirmed = await confirm({
        title: t('gear.duplicateCameraTitle'),
        message: t('gear.duplicateCameraMessage', { name: cameraName }),
        confirmText: t('gear.continueCreate'),
      });
      if (!confirmed) return 'cancelled';
    }

    await db.transaction('rw', db.cameras, db.cameraSystems, db.filmBacks, db.ledgerTransactions, async () => {
      let cameraSystemId = isInterchangeable120 && !editingId && cameraSystemMode === 'existing'
        ? selectedExistingCameraSystemId
        : draft.cameraSystemId;

      if (is120Camera && !cameraSystemId) {
        cameraSystemId = crypto.randomUUID();
        const generatedSystemName = isInterchangeable120
          ? (cameraSystemName.trim() || `${cameraName} System`)
          : `${cameraName} Fixed Back`;
        await db.cameraSystems.add({
          id: cameraSystemId,
          userId: currentUserId,
          name: generatedSystemName,
          mountKey: generatedSystemName.toLowerCase().replace(/\s+/g, '-'),
          addedAt: timestamp,
        });
      }

      if (editingId) {
        await db.cameras.update(editingId, {
          name: cameraName,
          type: draft.type as 'film' | 'digital',
          format: draft.format || '135',
          cameraSystemId: is120Camera ? cameraSystemId : undefined,
          backType: isInterchangeable120 ? 'interchangeable' : 'fixed',
          purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
        });

        if (is120Camera && cameraSystemId && draft.backType !== 'interchangeable') {
          const existingFixedBack = await db.filmBacks
            .where('cameraSystemId')
            .equals(cameraSystemId)
            .filter(back => back.status !== 'archived')
            .first();
          if (!existingFixedBack) {
            await db.filmBacks.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              cameraSystemId,
              name: `${cameraName} Fixed Back`,
              format: '120',
              status: 'active',
              notes: 'System generated fixed 120 back',
              addedAt: timestamp,
            });
          }
        }

        const existingTransaction = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(editingId)
          .filter(transaction => transaction.category === 'camera')
          .first();

        if (draft.purchasePrice && Number(draft.purchasePrice) > 0) {
          const amount = -Number(draft.purchasePrice);
          const notes = t('gear.ledgerPurchaseCamera', { name: cameraName });
          if (existingTransaction?.id) {
            await db.ledgerTransactions.update(existingTransaction.id, { amount, notes });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount,
              date: Date.now(),
              type: 'expense',
              category: 'camera',
              relatedEntityId: editingId,
              notes,
              addedAt: Date.now(),
            });
          }
        } else if (existingTransaction?.id) {
          await db.ledgerTransactions.delete(existingTransaction.id);
        }
        return;
      }

      const id = crypto.randomUUID();
      await db.cameras.add({
        id,
        userId: currentUserId,
        name: cameraName,
        type: draft.type as 'film' | 'digital',
        format: draft.format || '135',
        cameraSystemId: is120Camera ? cameraSystemId : undefined,
        backType: isInterchangeable120 ? 'interchangeable' : 'fixed',
        purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
        addedAt: Date.now(),
      });

      if (is120Camera && cameraSystemId) {
        const rawBackNames = cameraBackNames.map(name => name.trim()).filter(Boolean);
        const backNames = isInterchangeable120
          ? (cameraSystemMode === 'existing'
              ? rawBackNames.filter(name => name !== 'Back 1')
              : rawBackNames)
          : [];
        const namesToCreate = backNames.length > 0 ? backNames : ['Back 1'];
        const shouldCreateBacks = !isInterchangeable120 || cameraSystemMode !== 'existing' || backNames.length > 0;
        if (shouldCreateBacks) {
          await db.filmBacks.bulkAdd(namesToCreate.map(name => ({
            id: crypto.randomUUID(),
            userId: currentUserId,
            cameraSystemId,
            name: isInterchangeable120 ? name : `${cameraName} Fixed Back`,
            format: '120',
            status: 'active' as const,
            notes: isInterchangeable120 ? undefined : 'System generated fixed 120 back',
            addedAt: timestamp,
          })));
        }
      }

      if (draft.purchasePrice && Number(draft.purchasePrice) > 0) {
        await db.ledgerTransactions.add({
          id: crypto.randomUUID(),
          userId: currentUserId,
          amount: -Number(draft.purchasePrice),
          date: Date.now(),
          type: 'expense',
          category: 'camera',
          relatedEntityId: id,
          notes: t('gear.ledgerPurchaseCamera', { name: cameraName }),
          addedAt: Date.now(),
        });
      }
    });

    requestImmediateSync('camera-save');
    return 'saved';
  };

  const saveLens = async ({ draft, editingId, existingLenses }: SaveLensInput): Promise<GearSaveResult> => {
    if (!draft.name) return 'invalid';
    const lensName = draft.name;

    if (!editingId && !guardTrialResource({ resource: 'lenses', currentCount: existingLenses.length })) {
      return 'trial-blocked';
    }

    if (!editingId && existingLenses.some(lens => lens.name === lensName)) {
      const confirmed = await confirm({
        title: t('gear.duplicateLensTitle'),
        message: t('gear.duplicateLensMessage', { name: lensName }),
        confirmText: t('gear.continueCreate'),
      });
      if (!confirmed) return 'cancelled';
    }

    await db.transaction('rw', db.lenses, db.ledgerTransactions, async () => {
      if (editingId) {
        await db.lenses.update(editingId, {
          name: lensName,
          focalLength: Number(draft.focalLength) || 50,
          maxAperture: draft.maxAperture || 'f/1.8',
          type: draft.type || 'prime',
          mountKey: draft.mountKey,
          purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
        });

        const existingTransaction = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(editingId)
          .filter(transaction => transaction.category === 'lens')
          .first();

        if (draft.purchasePrice && Number(draft.purchasePrice) > 0) {
          const amount = -Number(draft.purchasePrice);
          const notes = t('gear.ledgerPurchaseLens', { name: lensName });
          if (existingTransaction?.id) {
            await db.ledgerTransactions.update(existingTransaction.id, { amount, notes });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount,
              date: Date.now(),
              type: 'expense',
              category: 'lens',
              relatedEntityId: editingId,
              notes,
              addedAt: Date.now(),
            });
          }
        } else if (existingTransaction?.id) {
          await db.ledgerTransactions.delete(existingTransaction.id);
        }
        return;
      }

      const id = crypto.randomUUID();
      await db.lenses.add({
        id,
        userId: currentUserId,
        name: lensName,
        focalLength: Number(draft.focalLength) || 50,
        maxAperture: draft.maxAperture || 'f/1.8',
        type: draft.type || 'prime',
        mountKey: draft.mountKey,
        purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
        addedAt: Date.now(),
      });

      if (draft.purchasePrice && Number(draft.purchasePrice) > 0) {
        await db.ledgerTransactions.add({
          id: crypto.randomUUID(),
          userId: currentUserId,
          amount: -Number(draft.purchasePrice),
          date: Date.now(),
          type: 'expense',
          category: 'lens',
          relatedEntityId: id,
          notes: t('gear.ledgerPurchaseLens', { name: lensName }),
          addedAt: Date.now(),
        });
      }
    });

    requestImmediateSync('lens-save');
    return 'saved';
  };

  const saveFilmStock = async ({
    draft,
    editingId,
    existingFilmStocks,
  }: SaveFilmStockInput): Promise<GearSaveResult> => {
    if (!draft.brand || !draft.name) return 'invalid';
    const filmBrand = draft.brand;
    const filmName = draft.name;

    if (!editingId && !guardTrialResource({ resource: 'filmStocks', currentCount: existingFilmStocks.length })) {
      return 'trial-blocked';
    }

    if (!editingId && existingFilmStocks.some(film => film.brand === filmBrand && film.name === filmName)) {
      const confirmed = await confirm({
        title: t('gear.duplicateFilmTitle'),
        message: t('gear.duplicateFilmMessage', { name: `${filmBrand} ${filmName}` }),
        confirmText: t('gear.continueCreate'),
      });
      if (!confirmed) return 'cancelled';
    }

    const stockAdjustment = await db.transaction(
      'rw',
      db.filmStocks,
      db.ledgerTransactions,
      async (): Promise<{ film: Pick<FilmStock, 'id' | 'userId' | 'stockCount'>; delta: number } | null> => {
        const parsedStockCount = Number(draft.stockCount);
        const stockCount = editingId
          ? (Number.isFinite(parsedStockCount) ? Math.max(0, parsedStockCount) : 0)
          : (Number.isFinite(parsedStockCount) ? Math.max(1, parsedStockCount) : 1);
        const pricePerRoll = draft.pricePerRoll ? Number(draft.pricePerRoll) : undefined;

        if (editingId) {
          const existingFilm = await db.filmStocks.get(editingId);
          if (!existingFilm) return null;
          const currentStock = existingFilm.stockCount || 0;
          await db.filmStocks.update(editingId, {
            brand: filmBrand,
            name: filmName,
            iso: Number(draft.iso) || 400,
            colorType: draft.colorType as 'color' | 'bw',
            format: draft.format || '135',
            pricePerRoll,
          });
          const adjustment = { film: existingFilm, delta: stockCount - currentStock };

          const existingTransaction = await db.ledgerTransactions
            .where('relatedEntityId')
            .equals(editingId)
            .filter(transaction => transaction.category === 'film')
            .first();

          if (stockCount > 0 && pricePerRoll && pricePerRoll > 0) {
            const amount = -(stockCount * pricePerRoll);
            const notes = t('gear.ledgerPurchaseFilm', {
              name: `${filmBrand} ${filmName}`,
              count: stockCount,
            });
            if (existingTransaction?.id) {
              await db.ledgerTransactions.update(existingTransaction.id, { amount, notes });
            } else {
              await db.ledgerTransactions.add({
                id: crypto.randomUUID(),
                userId: currentUserId,
                amount,
                date: Date.now(),
                type: 'expense',
                category: 'film',
                relatedEntityId: editingId,
                notes,
                addedAt: Date.now(),
              });
            }
          } else if (existingTransaction?.id) {
            await db.ledgerTransactions.delete(existingTransaction.id);
          }
          return adjustment;
        }

        const id = crypto.randomUUID();
        await db.filmStocks.add({
          id,
          userId: currentUserId,
          brand: filmBrand,
          name: filmName,
          iso: Number(draft.iso) || 400,
          colorType: draft.colorType as 'color' | 'bw',
          format: draft.format || '135',
          isSystem: 0,
          stockCount: 0,
          pricePerRoll,
          addedAt: Date.now(),
        });

        if (stockCount > 0 && pricePerRoll && pricePerRoll > 0) {
          await db.ledgerTransactions.add({
            id: crypto.randomUUID(),
            userId: currentUserId,
            amount: -(stockCount * pricePerRoll),
            date: Date.now(),
            type: 'expense',
            category: 'film',
            relatedEntityId: id,
            notes: t('gear.ledgerPurchaseFilm', {
              name: `${filmBrand} ${filmName}`,
              count: stockCount,
            }),
            addedAt: Date.now(),
          });
        }
        return {
          film: { id, userId: currentUserId, stockCount: 0 },
          delta: stockCount,
        };
      },
    );

    if (stockAdjustment && stockAdjustment.delta !== 0) {
      await adjustFilmStock(stockAdjustment.film, stockAdjustment.delta);
    } else {
      requestImmediateSync('film-stock-save');
    }
    return 'saved';
  };

  const saveOtherEquipment = async ({
    draft,
    editingId,
    existingEquipment,
  }: SaveOtherEquipmentInput): Promise<GearSaveResult> => {
    if (!draft.name) return 'invalid';
    const equipmentName = draft.name;

    if (!editingId && !guardTrialResource({ resource: 'otherEquipments', currentCount: existingEquipment.length })) {
      return 'trial-blocked';
    }

    if (!editingId && existingEquipment.some(equipment => equipment.name === equipmentName)) {
      const confirmed = await confirm({
        title: t('gear.duplicateGearTitle'),
        message: t('gear.duplicateGearMessage', { name: equipmentName }),
        confirmText: t('gear.continueCreate'),
      });
      if (!confirmed) return 'cancelled';
    }

    await db.transaction('rw', db.otherEquipments, db.ledgerTransactions, async () => {
      const equipmentType = draft.type as OtherEquipment['type'];
      const ledgerCategory = equipmentLedgerCategories[equipmentType] || 'other';

      if (editingId) {
        await db.otherEquipments.update(editingId, {
          name: equipmentName,
          type: equipmentType,
          notes: draft.notes || '',
          purchaseDate: draft.purchaseDate,
          expiryDate: draft.expiryDate,
          purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
        });

        const existingTransaction = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(editingId)
          .first();

        if (draft.purchasePrice && Number(draft.purchasePrice) > 0) {
          const amount = -Number(draft.purchasePrice);
          const notes = t('gear.ledgerPurchaseAccessory', { name: equipmentName });
          if (existingTransaction?.id) {
            await db.ledgerTransactions.update(existingTransaction.id, {
              amount,
              category: ledgerCategory,
              notes,
            });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount,
              date: draft.purchaseDate || Date.now(),
              type: 'expense',
              category: ledgerCategory,
              relatedEntityId: editingId,
              notes,
              addedAt: Date.now(),
            });
          }
        } else if (existingTransaction?.id) {
          await db.ledgerTransactions.delete(existingTransaction.id);
        }
        return;
      }

      const id = crypto.randomUUID();
      await db.otherEquipments.add({
        id,
        userId: currentUserId,
        name: equipmentName,
        type: equipmentType,
        notes: draft.notes || '',
        purchaseDate: draft.purchaseDate,
        expiryDate: draft.expiryDate,
        purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
        addedAt: Date.now(),
      });

      if (draft.purchasePrice && Number(draft.purchasePrice) > 0) {
        await db.ledgerTransactions.add({
          id: crypto.randomUUID(),
          userId: currentUserId,
          amount: -Number(draft.purchasePrice),
          date: draft.purchaseDate || Date.now(),
          type: 'expense',
          category: ledgerCategory,
          relatedEntityId: id,
          notes: t('gear.ledgerPurchaseAccessory', { name: equipmentName }),
          addedAt: Date.now(),
        });
      }
    });

    requestImmediateSync('other-equipment-save');
    return 'saved';
  };

  const deleteCamera = async (id: string): Promise<boolean> => {
    const confirmed = await confirm({
      title: t('gear.deleteCameraTitle'),
      message: t('gear.deleteCameraMessage'),
      confirmText: t('gear.confirmDelete'),
      isDanger: true,
    });
    if (!confirmed) return false;
    await db.cameras.delete(id);
    requestImmediateSync('camera-delete');
    return true;
  };

  const deleteLens = async (id: string): Promise<boolean> => {
    const confirmed = await confirm({
      title: t('gear.deleteLensTitle'),
      message: t('gear.deleteLensMessage'),
      confirmText: t('gear.confirmDelete'),
      isDanger: true,
    });
    if (!confirmed) return false;
    await db.lenses.delete(id);
    requestImmediateSync('lens-delete');
    return true;
  };

  const deleteFilmStock = async (id: string): Promise<boolean> => {
    const confirmed = await confirm({
      title: t('gear.deleteFilmTitle'),
      message: t('gear.deleteFilmMessage'),
      confirmText: t('gear.confirmDelete'),
      isDanger: true,
    });
    if (!confirmed) return false;
    await db.filmStocks.delete(id);
    requestImmediateSync('film-stock-delete');
    return true;
  };

  const deleteOtherEquipment = async (id: string): Promise<boolean> => {
    const confirmed = await confirm({
      title: t('gear.deleteGearTitle'),
      message: t('gear.deleteGearMessage'),
      confirmText: t('gear.confirmDelete'),
      isDanger: true,
    });
    if (!confirmed) return false;
    await db.otherEquipments.delete(id);
    requestImmediateSync('other-equipment-delete');
    return true;
  };

  const archiveGear = async ({ id, type, name, salePrice }: ArchiveGearInput): Promise<void> => {
    await db.transaction('rw', db.cameras, db.lenses, db.ledgerTransactions, async () => {
      if (type === 'camera') {
        await db.cameras.update(id, { status: 'archived' });
      } else {
        await db.lenses.update(id, { status: 'archived' });
      }

      if (salePrice !== '' && Number(salePrice) > 0) {
        await db.ledgerTransactions.add({
          id: crypto.randomUUID(),
          userId: currentUserId,
          amount: Number(salePrice),
          date: Date.now(),
          type: 'income',
          category: type,
          relatedEntityId: id,
          notes: type === 'camera'
            ? t('gear.ledgerSoldCamera', { name })
            : t('gear.ledgerSoldLens', { name }),
          addedAt: Date.now(),
        });
      }
    });
    requestImmediateSync('gear-archive');
  };

  const adjustFilmStockCount = async (film: FilmStock, delta: number): Promise<number> => (
    adjustFilmStock(film, delta)
  );

  const addFilmBack = async ({ cameraSystemId, name, timestamp }: AddFilmBackInput): Promise<void> => {
    await db.filmBacks.add({
      id: crypto.randomUUID(),
      userId: currentUserId,
      cameraSystemId,
      name,
      format: '120',
      status: 'active',
      addedAt: timestamp,
    });
    requestImmediateSync('film-back-create');
  };

  const archiveFilmBack = async (id: string): Promise<void> => {
    await db.filmBacks.update(id, { status: 'archived' });
    requestImmediateSync('film-back-archive');
  };

  return {
    saveCamera,
    saveLens,
    saveFilmStock,
    saveOtherEquipment,
    deleteCamera,
    deleteLens,
    deleteFilmStock,
    deleteOtherEquipment,
    archiveGear,
    adjustFilmStockCount,
    addFilmBack,
    archiveFilmBack,
  };
};
