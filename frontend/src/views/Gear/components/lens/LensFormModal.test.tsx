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
  <MemoryRouter initialEntries={['/gear?tab=lenses']}>
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

describe('LensFormModal migration', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([
      db.lenses.clear(),
      db.ledgerTransactions.clear(),
      db.syncQueue.clear(),
    ]);
  });

  it('preserves mount-to-brand catalog selection and editing', async () => {
    const user = userEvent.setup();
    renderGearView();

    await user.click((await screen.findAllByRole('button', { name: '添加镜头' }))[0]);
    await user.click(screen.getByRole('button', { name: 'hasselblad-v' }));
    await user.click(screen.getByRole('button', { name: /^Hasselblad$/ }));
    await user.click(screen.getByRole('button', { name: 'Carl Zeiss Planar 80mm f/2.8 C · 80mm' }));

    expect(screen.getByPlaceholderText('例如: MD 50mm f/1.7')).toHaveValue(
      'Hasselblad Carl Zeiss Planar 80mm f/2.8 C',
    );
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(80);

    await user.click(screen.getByRole('button', { name: /^添加$/ }));
    await waitFor(async () => {
      expect(await db.lenses.where('name').equals('Hasselblad Carl Zeiss Planar 80mm f/2.8 C').count()).toBe(1);
    });

    const lens = await db.lenses.where('name').equals('Hasselblad Carl Zeiss Planar 80mm f/2.8 C').first();
    expect(lens).toEqual(expect.objectContaining({
      focalLength: 80,
      maxAperture: 'f/2.8',
      mountKey: 'hasselblad-v',
    }));

    await screen.findByText('Hasselblad Carl Zeiss Planar 80mm f/2.8 C');
    await user.click(screen.getByTitle('编辑镜头'));
    expect(screen.getByRole('heading', { name: '编辑镜头' })).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('例如: MD 50mm f/1.7');
    await user.clear(nameInput);
    await user.type(nameInput, 'Hasselblad Planar 80 Updated');
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(async () => {
      expect((await db.lenses.get(lens!.id!))?.name).toBe('Hasselblad Planar 80 Updated');
    });
  });
});
