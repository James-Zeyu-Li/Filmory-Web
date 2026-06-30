import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RollsView } from '../RollsView';
import { db } from '../../../db/schema';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmProvider } from '../../../contexts/ConfirmContext';
import { FeedbackProvider } from '../../../contexts/FeedbackContext';

const TEST_USER_ID = 'mock-user-id';

// We need to override the global mock from setupTests.ts just for this suite
// to simulate different user tiers.

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { id: TEST_USER_ID },
    session: null,
    isLoading: false
  })
}));

describe('RollsView VIP Limitations', () => {
  beforeEach(async () => {
    // Clear the ghost DB
    await db.rolls.clear();
    await db.cameras.clear();
    await db.userProfiles.clear();

    // Mock window.alert and clear its history
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(window.alert).mockClear();

    // Add a default camera so we can create rolls
    await db.cameras.add({
      id: 'cam-1',
      userId: TEST_USER_ID,
      name: 'Test Camera',
      type: 'film',
      format: '135',
      addedAt: Date.now()
    });
  });

  it.todo('Regular user should be blocked from creating 6th roll once VIP gating is wired');

  it('VIP user should bypass the 5-roll limitation', async () => {
    // 1. Setup DB with 5 active rolls
    const rolls = Array.from({ length: 5 }).map((_, i) => ({
      id: `roll-${i}`,
      userId: TEST_USER_ID,
      name: `Roll ${i}`,
      cameraIds: ['cam-1'],
      filmStockId: 'digital',
      status: 'active' as const,
      startDate: Date.now()
    }));
    await db.rolls.bulkAdd(rolls);

    // 2. Setup user profile as VIP
    await db.userProfiles.add({
      id: TEST_USER_ID,
      userId: TEST_USER_ID,
      tier: 'vip',
      highResQuotaUsed: 0
    });

    // 3. Render Component
    render(
      <MemoryRouter>
        <ConfirmProvider>
          <FeedbackProvider>
            <RollsView enableFilmMode={false} />
          </FeedbackProvider>
        </ConfirmProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('所有拍摄卷 (The Library)'));

    // Wait for Dexie live queries to resolve
    await waitFor(() => {
      expect(screen.getByText('Roll 0')).toBeInTheDocument();
    });

    // 4. Try to add a 6th roll
    await waitFor(() => {
      expect(screen.getByText('新建独立拍摄卷')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('新建独立拍摄卷'));

    const titleInput = await screen.findByPlaceholderText('例如: 2026春日踏青');
    fireEvent.change(titleInput, { target: { value: '6th Roll VIP' } });

    // Select the camera
    const cameraOptions = screen.getAllByText('Test Camera');
    fireEvent.click(cameraOptions[cameraOptions.length - 1]);

    const submitBtn = screen.getByRole('button', { name: '开始记录' });
    fireEvent.click(submitBtn);

    // 5. Assert alert was NOT called
    await waitFor(() => {
      expect(window.alert).not.toHaveBeenCalled();
    });

    // 6. Assert DB has 6 rolls
    await waitFor(async () => {
      const rollCount = await db.rolls.count();
      expect(rollCount).toBe(6);
    });
  });
});
