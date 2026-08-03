import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
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
