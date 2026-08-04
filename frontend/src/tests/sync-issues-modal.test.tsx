import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncIssuesModal } from '../components/SyncIssuesModal';
import { ConfirmContext } from '../contexts/confirmContextCore';
import { FeedbackContext } from '../contexts/feedbackContextCore';
import { LanguageProvider } from '../contexts/LanguageContext';
import { db } from '../db/schema';

const syncIssueServiceMock = vi.hoisted(() => ({
  undoSyncIssue: vi.fn(),
  keepRollWithoutInventory: vi.fn(),
  canKeepRollWithoutInventory: vi.fn(),
}));

vi.mock('../services/syncIssueService', () => syncIssueServiceMock);

const userId = 'mock-user-id';
const notify = vi.fn();
const confirm = vi.fn();

const renderModal = (onClose = vi.fn()) => render(
  <LanguageProvider>
    <ConfirmContext.Provider value={{ confirm }}>
      <FeedbackContext.Provider value={{ notify, dismiss: vi.fn() }}>
        <SyncIssuesModal isOpen={true} onClose={onClose} />
      </FeedbackContext.Provider>
    </ConfirmContext.Provider>
  </LanguageProvider>,
);

describe('SyncIssuesModal', () => {
  beforeEach(async () => {
    await Promise.all([db.filmStocks.clear(), db.syncQueue.clear()]);
    localStorage.clear();
    localStorage.setItem('grainfolio_user_id', userId);
    confirm.mockReset();
    notify.mockReset();
    syncIssueServiceMock.undoSyncIssue.mockReset();
    syncIssueServiceMock.keepRollWithoutInventory.mockReset();
    syncIssueServiceMock.canKeepRollWithoutInventory.mockReset();
    syncIssueServiceMock.undoSyncIssue.mockResolvedValue(undefined);
    syncIssueServiceMock.keepRollWithoutInventory.mockResolvedValue(undefined);
    syncIssueServiceMock.canKeepRollWithoutInventory.mockResolvedValue(false);
  });

  it('shows the affected film and recovery actions for a rejected stock adjustment', async () => {
    await db.filmStocks.add({
      id: 'film-1', userId, brand: 'Kodak', name: 'Gold 200', iso: 200,
      colorType: 'color', format: '135', isSystem: 0, stockCount: 2, addedAt: Date.now(),
    });
    await db.syncQueue.add({
      kind: 'operation', userId, operationId: 'failed-adjustment', operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: 'film-1', delta: -1 }, timestamp: Date.now(),
      failureKind: 'needs_attention', lastErrorCode: '23503',
    });

    renderModal();

    expect(await screen.findByText('Kodak Gold 200')).toBeInTheDocument();
    expect(screen.getByText('关联的胶卷库存已不可用。请撤销本机更改，或调整记录方式。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '撤销本机更改' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '改为未登记库存' })).not.toBeInTheDocument();
  });

  it('requires confirmation before undoing a rejected adjustment', async () => {
    const queueItemId = await db.syncQueue.add({
      kind: 'operation', userId, operationId: 'failed-adjustment', operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: 'film-1', delta: 1 }, timestamp: Date.now(),
      failureKind: 'needs_attention', lastErrorCode: '23503',
    });
    confirm.mockResolvedValue(false);
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(await screen.findByRole('button', { name: '撤销本机更改' }));

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ isDanger: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(syncIssueServiceMock.undoSyncIssue).not.toHaveBeenCalled();
    expect(await db.syncQueue.get(queueItemId)).toBeDefined();
  });

  it('offers the unregistered-inventory path only for an eligible failed roll creation', async () => {
    syncIssueServiceMock.canKeepRollWithoutInventory.mockResolvedValue(true);
    await db.syncQueue.add({
      kind: 'operation', userId, operationId: 'failed-roll', operationType: 'create_roll_with_inventory',
      operationPayload: {
        roll: { id: 'roll-1', userId, name: 'Sunday walk', cameraIds: [], filmStockId: 'film-1', status: 'active', addedAt: Date.now() },
        consumeInventory: true,
      },
      timestamp: Date.now(), failureKind: 'needs_attention', lastErrorCode: '23503',
    });
    renderModal();

    expect(await screen.findByText('Sunday walk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '改为未登记库存' })).toBeInTheDocument();
  });
});
