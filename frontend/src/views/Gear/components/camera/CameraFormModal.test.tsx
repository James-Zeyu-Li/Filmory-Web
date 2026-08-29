import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmContext } from '../../../../contexts/confirmContextCore';
import { CurrencyContext } from '../../../../contexts/currencyContextCore';
import { FeedbackContext } from '../../../../contexts/feedbackContextCore';
import { db } from '../../../../db/schema';
import { GearView } from '../../GearView';

const renderGearView = () => render(
  <MemoryRouter initialEntries={['/gear?tab=cameras']}>
    <ConfirmContext.Provider value={{ confirm: vi.fn().mockResolvedValue(true) }}>
      <FeedbackContext.Provider value={{ notify: vi.fn(), dismiss: vi.fn() }}>
        <CurrencyContext.Provider value={{
          currency: 'USD',
          setCurrency: vi.fn(),
          currencySymbol: '$',
          formatCurrency: amount => `$${amount}`,
        }}>
          <GearView enableFilmMode />
        </CurrencyContext.Provider>
      </FeedbackContext.Provider>
    </ConfirmContext.Provider>
  </MemoryRouter>,
);

describe('CameraFormModal migration', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([
      db.cameras.clear(),
      db.cameraSystems.clear(),
      db.filmBacks.clear(),
      db.ledgerTransactions.clear(),
      db.syncQueue.clear(),
    ]);
  });

  it('preserves the stepped 120 preset flow and editing workflow', async () => {
    const user = userEvent.setup();
    renderGearView();

    await user.click((await screen.findAllByRole('button', { name: '添加相机' }))[0]);
    await user.click(screen.getByRole('button', { name: '胶片相机' }));
    await user.click(screen.getByRole('button', { name: '120' }));
    await user.click(screen.getByRole('button', { name: 'Hasselblad' }));
    await user.click(screen.getByRole('button', { name: /500CM/ }));

    expect(screen.getByPlaceholderText('例如: Minolta X-700')).toHaveValue('Hasselblad 500CM');
    expect(screen.getByPlaceholderText('例如: Hasselblad V / Mamiya RB67')).toHaveValue('Hasselblad V');
    expect(screen.getByText('A12 Back')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^添加$/ }));
    await waitFor(async () => {
      expect(await db.cameras.where('name').equals('Hasselblad 500CM').count()).toBe(1);
    });

    const camera = await db.cameras.where('name').equals('Hasselblad 500CM').first();
    expect(camera?.cameraSystemId).toBeTruthy();
    expect(await db.filmBacks.where('cameraSystemId').equals(camera!.cameraSystemId!).count()).toBe(4);

    await screen.findByText('Hasselblad 500CM');
    await user.click(screen.getByTitle('编辑相机'));
    expect(screen.getByRole('heading', { name: '编辑相机' })).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('例如: Minolta X-700');
    await user.clear(nameInput);
    await user.type(nameInput, 'Hasselblad 500CM Updated');
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(async () => {
      expect((await db.cameras.get(camera!.id!))?.name).toBe('Hasselblad 500CM Updated');
    });
  });
});
