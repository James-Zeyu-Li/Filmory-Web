import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getSignedPhotoUrl } from '../services/storageService';
import { usePhotoUrlMap } from '../hooks/usePhotoUrlMap';
import { supabase } from '../services/supabaseClient';

const repoRoot = resolve(__dirname, '../../..');
const readRepoFile = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

describe('P0 Supabase storage security contract', () => {
  it('keeps filmory-assets private and removes public read access in migrations', () => {
    const initMigration = readRepoFile('supabase/migrations/20260619204530_init_schema.sql');
    const privateMigration = readRepoFile('supabase/migrations/20260629000000_private_storage_signed_urls.sql');

    expect(initMigration).toMatch(/VALUES\s*\(\s*'filmory-assets'\s*,\s*'filmory-assets'\s*,\s*false\s*\)/);
    expect(initMigration).not.toContain('CREATE POLICY "Public Read Access"');
    expect(initMigration).toContain('CREATE POLICY "Owner Read Access"');
    expect(initMigration).toContain('auth.uid() = owner');
    expect(initMigration).toContain("(storage.foldername(name))[1] = auth.uid()::text");

    expect(privateMigration).toContain('SET public = false');
    expect(privateMigration).toContain('DROP POLICY IF EXISTS "Public Read Access"');
    expect(privateMigration).toContain('CREATE POLICY "Owner Read Access"');
  });

  it('generates signed URLs instead of public URLs for private bucket reads', async () => {
    const storage = supabase.storage.from('filmory-assets');
    const createSignedUrl = vi.mocked(storage.createSignedUrl);

    createSignedUrl.mockClear();

    await expect(getSignedPhotoUrl('user-1/roll-1/photo.webp', 120)).resolves.toBe('mock-signed-url');
    expect(createSignedUrl).toHaveBeenCalledWith('user-1/roll-1/photo.webp', 120);
  });

  it('keeps uploadPhotoToCloud on signed URLs and never calls getPublicUrl', () => {
    const storageService = readRepoFile('frontend/src/services/storageService.ts');

    expect(storageService).toContain('getSignedPhotoUrl(storageKey)');
    expect(storageService).toContain('.createSignedUrl(storageKey, expiresIn)');
    expect(storageService).not.toContain('getPublicUrl');
    expect(storageService).not.toContain('publicUrl');
  });

  it('resolves photo maps from storageKey via signed URL before falling back to stale public previewUrl', async () => {
    const { result } = renderHook(() => usePhotoUrlMap([
      {
        id: 'photo-1',
        userId: 'user-1',
        rollId: 'roll-1',
        originalFileName: 'photo.webp',
        fileSize: 100,
        storageKey: 'user-1/roll-1/photo.webp',
        previewUrl: 'https://public.example.com/old-photo.webp',
        thumbnailUrl: 'data:image/webp;base64,thumb',
        addedAt: Date.now(),
        isPinned: 0
      }
    ], { preferFull: true }));

    await waitFor(() => {
      expect(result.current['photo-1']).toBe('mock-signed-url');
    });
  });

  it('falls back to thumbnailUrl when signed URL generation fails', async () => {
    const storage = supabase.storage.from('filmory-assets');
    const createSignedUrl = vi.mocked(storage.createSignedUrl);

    createSignedUrl.mockResolvedValue({
      data: null,
      error: new Error('forbidden')
    } as never);

    const { result } = renderHook(() => usePhotoUrlMap([
      {
        id: 'photo-2',
        userId: 'user-1',
        rollId: 'roll-1',
        originalFileName: 'photo.webp',
        fileSize: 100,
        storageKey: 'user-1/roll-1/photo.webp',
        thumbnailUrl: 'data:image/webp;base64,thumb',
        addedAt: Date.now(),
        isPinned: 0
      }
    ], { preferFull: true }));

    await waitFor(() => {
      expect(result.current['photo-2']).toBe('data:image/webp;base64,thumb');
    });

    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'mock-signed-url' },
      error: null
    } as never);
  });
});

describe('P0 account deletion RPC security contract', () => {
  it('restricts delete_user execution to authenticated users in migrations', () => {
    const createRpcMigration = readRepoFile('supabase/migrations/20260627000000_account_deletion_rpc.sql');
    const lockRpcMigration = readRepoFile('supabase/migrations/20260629001000_lock_account_delete_rpc.sql');

    expect(createRpcMigration).toContain('CREATE OR REPLACE FUNCTION delete_user()');
    expect(createRpcMigration).toContain('SECURITY DEFINER');
    expect(createRpcMigration).toContain('DELETE FROM auth.users WHERE id = auth.uid()');
    expect(createRpcMigration).toContain('REVOKE EXECUTE ON FUNCTION delete_user() FROM PUBLIC');
    expect(createRpcMigration).toContain('REVOKE EXECUTE ON FUNCTION delete_user() FROM anon');
    expect(createRpcMigration).toContain('GRANT EXECUTE ON FUNCTION delete_user() TO authenticated');

    expect(lockRpcMigration).toContain('REVOKE EXECUTE ON FUNCTION delete_user() FROM PUBLIC');
    expect(lockRpcMigration).toContain('REVOKE EXECUTE ON FUNCTION delete_user() FROM anon');
    expect(lockRpcMigration).toContain('GRANT EXECUTE ON FUNCTION delete_user() TO authenticated');
  });
});
