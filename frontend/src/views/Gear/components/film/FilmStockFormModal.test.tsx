import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmContext } from '../../../../contexts/confirmContextCore';
import { CurrencyContext } from '../../../../contexts/currencyContextCore';
import { FeedbackContext } from '../../../../contexts/feedbackContextCore';
import { db } from '../../../../db/schema';
import { GearView } from '../../GearView';

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

describe('FilmStockFormModal migration', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([
      db.filmStocks.clear(),
      db.ledgerTransactions.clear(),
      db.syncQueue.clear(),
    ]);
  });

  it('preserves catalog creation and converts edited stock totals into delta operations', async () => {
    const user = userEvent.setup();
    renderGearView();

    await user.click((await screen.findAllByRole('button', { name: '添加胶卷' }))[0]);
    await user.click(screen.getByRole('button', { name: 'Kodak' }));
    await user.click(screen.getByRole('button', { name: 'Gold 200 · ISO 200' }));

    const stockInput = screen.getByLabelText('本次加入数量');
    await user.clear(stockInput);
    await user.type(stockInput, '3');
    await user.click(screen.getByRole('button', { name: /^添加$/ }));
    await screen.findByText('Kodak Gold 200');

    const createdFilm = await waitFor(async () => {
      const film = await db.filmStocks.where('name').equals('Gold 200').first();
      expect(film?.stockCount).toBe(3);
      return film;
    });
    expect(await db.syncQueue.toArray()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'operation',
        operationType: 'adjust_film_stock',
        operationPayload: { filmStockId: createdFilm!.id, delta: 3 },
      }),
    ]));

    await act(async () => {
      await db.syncQueue.clear();
    });
    await screen.findByText('Kodak Gold 200');
    await user.click(screen.getByTitle('编辑胶卷库存'));
    const editStockInput = screen.getByLabelText('库存数量');
    await user.clear(editStockInput);
    await user.type(editStockInput, '5');
    await user.click(screen.getByRole('button', { name: '保存更改' }));
    await screen.findByText('5 卷');

    await waitFor(async () => {
      expect((await db.filmStocks.get(createdFilm!.id!))?.stockCount).toBe(5);
    });
    expect(await db.syncQueue.toArray()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'operation',
        operationType: 'adjust_film_stock',
        operationPayload: { filmStockId: createdFilm!.id, delta: 2 },
      }),
    ]));
  });
});
