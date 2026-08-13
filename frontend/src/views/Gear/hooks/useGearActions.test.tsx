import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmContext } from '../../../contexts/confirmContextCore';
import { FeedbackContext } from '../../../contexts/feedbackContextCore';
import { db, type Camera, type FilmStock, type Lens, type OtherEquipment } from '../../../db/schema';
import { useGearActions } from './useGearActions';

const testDoubles = vi.hoisted(() => ({
  confirm: vi.fn(),
  guardTrialResource: vi.fn(),
  notify: vi.fn(),
  requestImmediateSync: vi.fn(),
  requestSyncIntent: vi.fn(),
}));

vi.mock('../../../contexts/useTrialGate', () => ({
  useTrialGate: () => ({
    guardTrialResource: testDoubles.guardTrialResource,
    requireRegistration: vi.fn(),
  }),
}));

vi.mock('../../../services/syncEvents', () => ({
  requestImmediateSync: testDoubles.requestImmediateSync,
  requestSyncIntent: testDoubles.requestSyncIntent,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <ConfirmContext.Provider value={{ confirm: testDoubles.confirm }}>
    <FeedbackContext.Provider value={{ notify: testDoubles.notify, dismiss: vi.fn() }}>
      {children}
    </FeedbackContext.Provider>
  </ConfirmContext.Provider>
);

const cameraDraft: Partial<Camera> = {
  name: 'Hasselblad 500CM',
  type: 'film',
  format: '120',
  backType: 'fixed',
  purchasePrice: 1200,
};

const lensDraft: Partial<Lens> = {
  name: 'Planar 80mm f/2.8',
  focalLength: 80,
  maxAperture: 'f/2.8',
  type: 'prime',
  mountKey: 'hasselblad-v',
};

const filmDraft: Partial<FilmStock> = {
  brand: 'Kodak',
  name: 'Portra 400',
  iso: 400,
  colorType: 'color',
  format: '120',
  stockCount: 3,
  pricePerRoll: 18,
};

const equipmentDraft: Partial<OtherEquipment> = {
  name: 'Gitzo Tripod',
  type: 'tripod',
  purchasePrice: 300,
};

describe('useGearActions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    testDoubles.confirm.mockResolvedValue(true);
    testDoubles.guardTrialResource.mockReturnValue(true);
    window.__grainfolio_is_pulling = false;
    await Promise.all([
      db.cameras.clear(),
      db.cameraSystems.clear(),
      db.filmBacks.clear(),
      db.lenses.clear(),
      db.filmStocks.clear(),
      db.otherEquipments.clear(),
      db.ledgerTransactions.clear(),
      db.syncQueue.clear(),
    ]);
  });

  it('saves a fixed-back 120 camera atomically and wakes immediate sync', async () => {
    const { result } = renderHook(() => useGearActions(), { wrapper });

    let saveResult: Awaited<ReturnType<typeof result.current.saveCamera>> | undefined;
    await act(async () => {
      saveResult = await result.current.saveCamera({
        draft: cameraDraft,
        editingId: null,
        existingCameras: [],
        cameraSystemMode: 'new',
        selectedExistingCameraSystemId: '',
        cameraSystemName: '',
        cameraBackNames: ['Back 1'],
        timestamp: 1000,
      });
    });

    const camera = await db.cameras.where('name').equals('Hasselblad 500CM').first();
    const cameraSystem = camera?.cameraSystemId
      ? await db.cameraSystems.get(camera.cameraSystemId)
      : undefined;
    const filmBack = camera?.cameraSystemId
      ? await db.filmBacks.where('cameraSystemId').equals(camera.cameraSystemId).first()
      : undefined;
    const ledger = await db.ledgerTransactions.where('relatedEntityId').equals(camera?.id || '').first();

    expect(saveResult).toBe('saved');
    expect(camera).toEqual(expect.objectContaining({ format: '120', backType: 'fixed' }));
    expect(cameraSystem?.name).toBe('Hasselblad 500CM Fixed Back');
    expect(filmBack?.name).toBe('Hasselblad 500CM Fixed Back');
    expect(ledger?.amount).toBe(-1200);
    expect(testDoubles.requestImmediateSync).toHaveBeenCalledWith('camera-save');
  });

  it('saves lens and other-equipment records through their existing ledger categories', async () => {
    const { result } = renderHook(() => useGearActions(), { wrapper });

    await act(async () => {
      await result.current.saveLens({ draft: lensDraft, editingId: null, existingLenses: [] });
      await result.current.saveOtherEquipment({
        draft: equipmentDraft,
        editingId: null,
        existingEquipment: [],
      });
    });

    const lens = await db.lenses.where('name').equals('Planar 80mm f/2.8').first();
    const equipment = await db.otherEquipments.where('name').equals('Gitzo Tripod').first();
    const equipmentLedger = await db.ledgerTransactions
      .where('relatedEntityId')
      .equals(equipment?.id || '')
      .first();

    expect(lens?.mountKey).toBe('hasselblad-v');
    expect(equipmentLedger).toEqual(expect.objectContaining({ category: 'accessory', amount: -300 }));
    expect(testDoubles.requestImmediateSync).toHaveBeenCalledWith('lens-save');
    expect(testDoubles.requestImmediateSync).toHaveBeenCalledWith('other-equipment-save');
  });

  it('keeps film quantity on the delta-operation path instead of a normal record overwrite', async () => {
    const { result } = renderHook(() => useGearActions(), { wrapper });

    await act(async () => {
      await result.current.saveFilmStock({
        draft: filmDraft,
        editingId: null,
        existingFilmStocks: [],
      });
    });

    const film = await db.filmStocks.where('brand').equals('Kodak').first();
    const operation = (await db.syncQueue.toArray()).find(item => item.kind === 'operation');

    expect(film?.stockCount).toBe(3);
    expect(operation).toEqual(expect.objectContaining({
      kind: 'operation',
      operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: film?.id, delta: 3 },
    }));
    expect(testDoubles.requestImmediateSync).toHaveBeenCalledWith('inventory-stock-adjust');
    expect(testDoubles.requestImmediateSync).not.toHaveBeenCalledWith('film-stock-save');
  });

  it('does not write or sync when duplicate creation is cancelled', async () => {
    const existingLens: Lens = {
      id: 'lens-existing',
      userId: 'mock-user-id',
      name: lensDraft.name!,
      focalLength: 80,
      maxAperture: 'f/2.8',
      type: 'prime',
      addedAt: 1,
    };
    await db.lenses.add(existingLens);
    await db.syncQueue.clear();
    testDoubles.confirm.mockResolvedValueOnce(false);
    testDoubles.requestImmediateSync.mockClear();
    const { result } = renderHook(() => useGearActions(), { wrapper });

    let saveResult: Awaited<ReturnType<typeof result.current.saveLens>> | undefined;
    await act(async () => {
      saveResult = await result.current.saveLens({
        draft: lensDraft,
        editingId: null,
        existingLenses: [existingLens],
      });
    });

    expect(saveResult).toBe('cancelled');
    expect(await db.lenses.count()).toBe(1);
    expect(testDoubles.requestImmediateSync).not.toHaveBeenCalled();
  });

  it('does not delete or sync when a destructive confirmation is cancelled', async () => {
    await db.otherEquipments.add({
      id: 'tripod-1',
      userId: 'mock-user-id',
      name: 'Tripod',
      type: 'tripod',
      addedAt: 1,
    });
    await db.syncQueue.clear();
    testDoubles.confirm.mockResolvedValueOnce(false);
    testDoubles.requestImmediateSync.mockClear();
    const { result } = renderHook(() => useGearActions(), { wrapper });

    let deleted = true;
    await act(async () => {
      deleted = await result.current.deleteOtherEquipment('tripod-1');
    });

    expect(deleted).toBe(false);
    expect(await db.otherEquipments.get('tripod-1')).toBeDefined();
    expect(testDoubles.requestImmediateSync).not.toHaveBeenCalled();
  });

  it('stops trial users before creating a second resource', async () => {
    testDoubles.guardTrialResource.mockReturnValueOnce(false);
    const { result } = renderHook(() => useGearActions(), { wrapper });

    let saveResult: Awaited<ReturnType<typeof result.current.saveOtherEquipment>> | undefined;
    await act(async () => {
      saveResult = await result.current.saveOtherEquipment({
        draft: equipmentDraft,
        editingId: null,
        existingEquipment: [{
          id: 'existing-equipment',
          userId: 'mock-user-id',
          name: 'Existing',
          type: 'other',
          addedAt: 1,
        }],
      });
    });

    expect(saveResult).toBe('trial-blocked');
    expect(await db.otherEquipments.count()).toBe(0);
    expect(testDoubles.requestImmediateSync).not.toHaveBeenCalled();
  });

  it('propagates transaction failures without reporting an immediate sync', async () => {
    const writeError = new Error('write failed');
    const addSpy = vi.spyOn(db.lenses, 'add').mockRejectedValueOnce(writeError);
    const { result } = renderHook(() => useGearActions(), { wrapper });

    await expect(result.current.saveLens({
      draft: lensDraft,
      editingId: null,
      existingLenses: [],
    })).rejects.toThrow('write failed');

    expect(testDoubles.requestImmediateSync).not.toHaveBeenCalledWith('lens-save');
    addSpy.mockRestore();
  });

  it('archives gear with optional sale income and wakes immediate sync', async () => {
    await db.cameras.add({
      id: 'camera-archive',
      userId: 'mock-user-id',
      name: 'Camera to sell',
      type: 'film',
      format: '135',
      addedAt: 1,
    });
    await db.syncQueue.clear();
    testDoubles.requestImmediateSync.mockClear();
    const { result } = renderHook(() => useGearActions(), { wrapper });

    await act(async () => {
      await result.current.archiveGear({
        id: 'camera-archive',
        type: 'camera',
        name: 'Camera to sell',
        salePrice: 500,
      });
    });

    const ledger = await db.ledgerTransactions.where('relatedEntityId').equals('camera-archive').first();
    expect((await db.cameras.get('camera-archive'))?.status).toBe('archived');
    expect(ledger).toEqual(expect.objectContaining({ type: 'income', category: 'camera', amount: 500 }));
    expect(testDoubles.requestImmediateSync).toHaveBeenCalledWith('gear-archive');
  });

  it('creates and archives film backs through the shared camera action boundary', async () => {
    const { result } = renderHook(() => useGearActions(), { wrapper });

    await act(async () => {
      await result.current.addFilmBack({
        cameraSystemId: 'system-1',
        name: 'A12 Back',
        timestamp: 1000,
      });
    });

    const filmBack = await db.filmBacks.where('cameraSystemId').equals('system-1').first();
    expect(filmBack).toEqual(expect.objectContaining({
      userId: 'mock-user-id',
      name: 'A12 Back',
      status: 'active',
    }));
    expect(testDoubles.requestImmediateSync).toHaveBeenCalledWith('film-back-create');

    testDoubles.requestImmediateSync.mockClear();
    await act(async () => {
      await result.current.archiveFilmBack(filmBack!.id!);
    });

    expect((await db.filmBacks.get(filmBack!.id!))?.status).toBe('archived');
    expect(testDoubles.requestImmediateSync).toHaveBeenCalledWith('film-back-archive');
  });
});
