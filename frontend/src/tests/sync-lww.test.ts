import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../db/schema';
import { SyncService } from '../services/syncService';

// Mock Supabase
const mockSupabaseData = { data: [], error: null };
vi.mock('../services/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockResolvedValue(mockSupabaseData),
        order: vi.fn().mockResolvedValue(mockSupabaseData)
      }))
    }
  };
});

describe('SyncService LWW (Last-Write-Wins) Resolution', () => {
  beforeEach(async () => {
    // Reset database
    await db.cameras.clear();
    await db.syncQueue.clear();
    await db.filmStocks.clear();
    localStorage.clear();
    // Simulate logged in user
    localStorage.setItem('grainfolio_user_id', 'test_user');
    // Set a very old lastSync so pull() will trigger
    localStorage.setItem('grainfolio_last_sync', new Date(0).toISOString());
    // Seed some data so it doesn't return early
    await db.filmStocks.add({ id: 'dummy', userId: 'test', isSystem: 0, stockCount: 1, createdAt: Date.now() } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Edge Case: Should reject cloud overwrite if local pending syncQueue is newer', async () => {
    const cameraId = 'cam-123';
    
    // 1. Local Dexie has an OLD camera
    await db.cameras.add({
      id: cameraId,
      userId: 'test_user',
      name: 'Local Old Camera',
      brand: 'Leica',
      format: '135',
      updatedAt: new Date('2026-01-01T10:00:00.000Z').getTime() // VERY old
    });

    // 2. User made a local edit OFFLINE today!
    // But Dexie hook only puts it in syncQueue, local object updatedAt remains old.
    const today = new Date('2099-06-25T12:00:00.000Z').getTime();
    await db.syncQueue.add({
      userId: 'test_user',
      tableName: 'cameras',
      action: 'upsert',
      recordId: cameraId,
      payload: { name: 'Local NEW Camera Edit' },
      timestamp: today
    });

    // 3. The Cloud returns an intermediate update from yesterday (someone else edited)
    // Cloud Time is newer than Dexie's old updatedAt, but older than syncQueue pending time.
    mockSupabaseData.data = [
      { 
        id: cameraId, 
        name: 'Cloud Edit', 
        updated_at: '2099-06-24T12:00:00.000Z' // Older than the pending local edit.
      }
    ] as any;

    // 4. Fire Pull!
    await SyncService.pull();

    // 5. Assert that local camera was NOT overwritten by the cloud!
    const localCamera = await db.cameras.get(cameraId);
    expect(localCamera?.name).toBe('Local Old Camera'); // Because we rejected the cloud pull!
  });

  it('Normal Case: Should overwrite local if cloud is newer and no pending syncs', async () => {
    const cameraId = 'cam-456';
    
    await db.cameras.add({
      id: cameraId,
      userId: 'test_user',
      name: 'Local Old Camera',
      brand: 'Sony',
      format: '135',
      updatedAt: new Date('2026-01-01T10:00:00.000Z').getTime()
    });

    // Cloud is newer, and there are NO pending sync queue items.
    mockSupabaseData.data = [
      { 
        id: cameraId, 
        name: 'Cloud New Edit', 
        updated_at: '2099-06-25T12:00:00.000Z',
        brand: 'Sony',
        format: '135'
      }
    ] as any;

    await SyncService.pull();

    // 5. Assert that local camera WAS overwritten!
    const localCamera = await db.cameras.get(cameraId);
    expect(localCamera?.name).toBe('Cloud New Edit');
  });
});
