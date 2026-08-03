import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCurrentAccount } from '../services/accountService';

const supabaseMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: { getSession: supabaseMock.getSession },
    rpc: supabaseMock.rpc,
  },
}));

describe('deleteCurrentAccount', () => {
  beforeEach(() => {
    supabaseMock.getSession.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('calls the deletion RPC for an authenticated user', async () => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

    await expect(deleteCurrentAccount()).resolves.toBeUndefined();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_user');
  });

  it('rejects before invoking the RPC without an authenticated session', async () => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(deleteCurrentAccount()).rejects.toThrow('authenticated session');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('propagates an RPC failure', async () => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    supabaseMock.rpc.mockResolvedValue({ data: null, error: new Error('forbidden') });

    await expect(deleteCurrentAccount()).rejects.toThrow('forbidden');
  });
});
