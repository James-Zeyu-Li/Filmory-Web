import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpgradeModal } from '../components/UpgradeModal';
import { FeedbackProvider } from '../contexts/FeedbackContext';
import { db } from '../db/schema';

describe('UpgradeModal manual request flow', () => {
  beforeEach(async () => {
    await db.userProfiles.clear();
    vi.restoreAllMocks();
  });

  it('stores a pending manual VIP request and opens a mail draft', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <FeedbackProvider>
        <UpgradeModal isOpen={true} onClose={vi.fn()} trigger="roll-limit" />
      </FeedbackProvider>
    );

    fireEvent.change(await screen.findByLabelText('联系邮箱'), {
      target: { value: 'member@filmory.app' },
    });
    fireEvent.change(screen.getByLabelText('补充说明（可选）'), {
      target: { value: '希望本周内完成手动开通。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '打开邮件申请' }));

    await waitFor(async () => {
      await expect(db.userProfiles.get('mock-user-id')).resolves.toMatchObject({
        id: 'mock-user-id',
        userId: 'mock-user-id',
        tier: 'regular',
        membershipRequestStatus: 'pending',
        membershipContactEmail: 'member@filmory.app',
        membershipRequestNote: '希望本周内完成手动开通。',
        membershipRequestSource: 'roll-limit',
      });
    });

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('mailto:filmory@example.com'),
      '_blank'
    );

    await waitFor(() => {
      expect(screen.getByText('当前设备已记录为申请中')).toBeInTheDocument();
    });
  });
});
