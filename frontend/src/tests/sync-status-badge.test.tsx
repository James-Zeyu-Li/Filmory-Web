import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { SYNC_STATUS_EVENT, SyncService, type SyncStatusState } from '../services/syncService';

describe('SyncStatusBadge', () => {
  it('shows local mode when cloud sync is disabled', () => {
    vi.spyOn(SyncService, 'isAutoSyncEnabled').mockReturnValue(false);

    render(<SyncStatusBadge />);

    expect(screen.getByText('本地模式')).toBeInTheDocument();

    vi.restoreAllMocks();
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

    pushStatus('error');
    expect(screen.getByText('稍后重试')).toBeInTheDocument();

    pushStatus('synced');
    expect(screen.getByText('已同步')).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
