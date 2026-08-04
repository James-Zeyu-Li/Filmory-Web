import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ConfirmContext } from '../contexts/confirmContextCore';
import { FeedbackContext } from '../contexts/feedbackContextCore';
import { db } from '../db/schema';
import { SYNC_STATUS_EVENT, SyncService, type SyncStatusState } from '../services/syncService';

describe('SyncStatusBadge', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows local mode when cloud sync is disabled', () => {
    vi.spyOn(SyncService, 'isAutoSyncEnabled').mockReturnValue(false);

    render(<SyncStatusBadge />);

    expect(screen.getByText('本地模式')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  });

  it('shows syncing while the initial cloud pull has not finished', () => {
    vi.spyOn(SyncService, 'isAutoSyncEnabled').mockReturnValue(true);

    render(<SyncStatusBadge />);

    expect(screen.getByText('同步中')).toBeInTheDocument();
  });

  it('updates visible copy when sync status events arrive', () => {
    vi.spyOn(SyncService, 'isAutoSyncEnabled').mockReturnValue(true);

    render(<SyncStatusBadge />);

    const pushStatus = (status: SyncStatusState) => {
      act(() => {
        window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: status }));
      });
    };

    pushStatus('syncing');
    expect(screen.getByText('同步中')).toBeInTheDocument();

    pushStatus('offline');
    expect(screen.getByText('离线等待')).toBeInTheDocument();

    pushStatus('pending');
    expect(screen.getByText('待同步')).toBeInTheDocument();

    pushStatus('needs_attention');
    expect(screen.getByText('需要处理')).toBeInTheDocument();

    pushStatus('synced');
    expect(screen.getByText('已同步')).toBeInTheDocument();

  });

  it('shows the actionable queue count when sync requires user intervention', async () => {
    vi.spyOn(SyncService, 'isAutoSyncEnabled').mockReturnValue(true);
    await db.syncQueue.add({
      userId: 'mock-user-id',
      tableName: 'cameras',
      action: 'upsert',
      recordId: 'camera-1',
      timestamp: Date.now(),
      failureKind: 'needs_attention',
    });
    expect(await SyncService.getQueueSummary()).toEqual({ pendingCount: 0, needsAttentionCount: 1 });

    render(<SyncStatusBadge />);
    act(() => {
      window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: 'needs_attention' }));
    });

    await waitFor(() => {
      expect(screen.getByText('需要处理 (1)')).toBeInTheDocument();
    });
  });

  it('shows the actionable count for a rejected inventory operation', async () => {
    vi.spyOn(SyncService, 'isAutoSyncEnabled').mockReturnValue(true);
    await db.syncQueue.add({
      kind: 'operation',
      userId: 'mock-user-id',
      operationId: 'rejected-stock-adjustment',
      operationType: 'adjust_film_stock',
      operationPayload: { filmStockId: 'film-1', delta: -1 },
      timestamp: Date.now(),
      failureKind: 'needs_attention',
      lastErrorCode: '23503',
      lastErrorMessage: 'FILM_STOCK_NOT_FOUND',
    });

    render(<SyncStatusBadge />);
    act(() => {
      window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: 'needs_attention' }));
    });

    await waitFor(() => {
      expect(screen.getByText('需要处理 (1)')).toBeInTheDocument();
    });
  });

  it('opens the recovery panel from the actionable badge', async () => {
    vi.spyOn(SyncService, 'isAutoSyncEnabled').mockReturnValue(true);
    await db.syncQueue.add({
      kind: 'operation',
      userId: 'mock-user-id',
      operationId: 'rejected-roll',
      operationType: 'create_roll_with_inventory',
      operationPayload: {
        roll: {
          id: 'roll-1', userId: 'mock-user-id', name: 'Morning walk', cameraIds: [], filmStockId: 'film-1', status: 'active', addedAt: Date.now(),
        },
        consumeInventory: true,
      },
      timestamp: Date.now(),
      failureKind: 'needs_attention',
      lastErrorCode: '23503',
    });
    const notify = vi.fn();
    const confirm = vi.fn();

    render(
      <LanguageProvider>
        <ConfirmContext.Provider value={{ confirm }}>
          <FeedbackContext.Provider value={{ notify, dismiss: vi.fn() }}>
            <SyncStatusBadge />
          </FeedbackContext.Provider>
        </ConfirmContext.Provider>
      </LanguageProvider>,
    );
    act(() => {
      window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: 'needs_attention' }));
    });

    const badge = await screen.findByRole('button', { name: '需要处理 (1)' });
    await act(async () => {
      badge.click();
    });

    const heading = await screen.findByRole('heading', { name: '有同步操作需要处理' });
    expect(heading).toBeInTheDocument();
    expect(heading.closest('.modal-overlay')?.parentElement).toBe(document.body);
  });

  it('updates the visible queue count when a new actionable item is queued', async () => {
    vi.spyOn(SyncService, 'isAutoSyncEnabled').mockReturnValue(true);
    render(<SyncStatusBadge />);

    act(() => {
      window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: 'needs_attention' }));
    });
    expect(screen.getByText('需要处理')).toBeInTheDocument();

    await act(async () => {
      await db.syncQueue.add({
        userId: 'mock-user-id',
        tableName: 'cameras',
        action: 'upsert',
        recordId: 'camera-1',
        timestamp: Date.now(),
        failureKind: 'needs_attention',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('需要处理 (1)')).toBeInTheDocument();
    });
  });
});
