import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../db/schema';
import { GearView } from '../views/Gear/GearView';
import { ConfirmContext } from '../contexts/confirmContextCore';
import { CurrencyContext } from '../contexts/currencyContextCore';
import { FeedbackContext } from '../contexts/feedbackContextCore';

const renderGearView = () => render(
  <MemoryRouter initialEntries={['/gear?tab=filmStocks']}>
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

describe('Gear film stock controls', () => {
  beforeEach(async () => {
    await Promise.all([
      db.cameras.clear(),
      db.lenses.clear(),
      db.filmStocks.clear(),
      db.otherEquipments.clear(),
      db.syncQueue.clear(),
    ]);
    localStorage.clear();
    await db.filmStocks.add({
      id: 'film-1',
      userId: 'mock-user-id',
      brand: 'Kodak',
      name: 'Gold 200',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 3,
      addedAt: Date.now(),
    });
  });

  it('updates stock without opening the parent film editor', async () => {
    const user = userEvent.setup();
    renderGearView();

    await screen.findByText('Kodak Gold 200');
    await user.click(screen.getByTitle('增加库存'));

    await waitFor(async () => {
      expect((await db.filmStocks.get('film-1'))?.stockCount).toBe(4);
    });
    expect(screen.queryByRole('heading', { name: '编辑胶卷库存' })).not.toBeInTheDocument();
  });

  it('decreases stock without opening the parent film editor', async () => {
    const user = userEvent.setup();
    renderGearView();

    await screen.findByText('Kodak Gold 200');
    await user.click(screen.getByTitle('减少库存'));

    await waitFor(async () => {
      expect((await db.filmStocks.get('film-1'))?.stockCount).toBe(2);
    });
    expect(screen.queryByRole('heading', { name: '编辑胶卷库存' })).not.toBeInTheDocument();
  });

  it('does not let the stock count input change from the mouse wheel', async () => {
    const user = userEvent.setup();
    renderGearView();

    await user.click(await screen.findByText('Kodak Gold 200'));
    const stockCountInput = screen.getByLabelText('库存数量');
    stockCountInput.focus();

    fireEvent.wheel(stockCountInput, { deltaY: -100 });

    expect(stockCountInput).not.toHaveFocus();
    expect(stockCountInput).toHaveValue(3);
  });
});
