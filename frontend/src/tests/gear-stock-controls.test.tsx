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

  it('queues an adjustment after a remote stock update re-renders the card', async () => {
    const user = userEvent.setup();
    renderGearView();

    await screen.findByText('Kodak Gold 200');
    await db.syncQueue.clear();

    // Mirror SyncService pull writes: update Dexie without generating a record queue item.
    window.__grainfolio_is_pulling = true;
    await db.filmStocks.update('film-1', { stockCount: 5 });
    window.__grainfolio_is_pulling = false;

    await screen.findByText('5 卷');
    await user.click(screen.getByTitle('增加库存'));

    await waitFor(async () => {
      expect((await db.filmStocks.get('film-1'))?.stockCount).toBe(6);
    });
    expect(await db.syncQueue.toArray()).toEqual([
      expect.objectContaining({
        kind: 'operation',
        operationType: 'adjust_film_stock',
        operationPayload: { filmStockId: 'film-1', delta: 1 },
      }),
    ]);
  });

  it('does not let the stock count input change from the mouse wheel', async () => {
    const user = userEvent.setup();
    renderGearView();

    await screen.findByText('Kodak Gold 200');
    await user.click(screen.getByTitle('编辑胶卷库存'));
    const stockCountInput = screen.getByLabelText('库存数量');
    stockCountInput.focus();

    fireEvent.wheel(stockCountInput, { deltaY: -100 });

    expect(stockCountInput).not.toHaveFocus();
    expect(stockCountInput).toHaveValue(3);
  });

  it('keeps preset film details collapsed until customize is opened and blocks price wheel changes', async () => {
    const user = userEvent.setup();
    renderGearView();

    await user.click(screen.getAllByRole('button', { name: '添加胶卷' })[0]);
    await user.click(screen.getByRole('button', { name: 'Kodak' }));
    await user.click(screen.getByRole('button', { name: 'Gold 200 · ISO 200' }));

    expect(screen.getByRole('button', { name: '展开自定义' })).toBeInTheDocument();
    expect(screen.queryByLabelText('品牌/厂商')).not.toBeInTheDocument();

    const priceInput = screen.getByPlaceholderText('单卷价格, 例如: 85 (选填)');
    await user.click(priceInput);
    await user.type(priceInput, '85');
    fireEvent.wheel(priceInput, { deltaY: -100 });

    expect(priceInput).not.toHaveFocus();
    expect(priceInput).toHaveValue(85);

    await user.click(screen.getByRole('button', { name: '展开自定义' }));
    expect(screen.getByDisplayValue('Kodak')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Gold 200')).toBeInTheDocument();
  });

  it('renders accessible stock stepper buttons and interactive sort dropdown with backdrop', async () => {
    const user = userEvent.setup();
    const { container } = renderGearView();

    await screen.findByText('Kodak Gold 200');

    // Stepper buttons touch & accessibility verification
    const decBtn = screen.getByRole('button', { name: '减少库存' });
    const incBtn = screen.getByRole('button', { name: '增加库存' });
    expect(decBtn).toHaveClass('stock-stepper-btn');
    expect(incBtn).toHaveClass('stock-stepper-btn');
    expect(decBtn.closest('.stock-stepper-group')).toBeInTheDocument();

    // Sort dropdown verification
    const sortTrigger = screen.getByRole('button', { name: /按时间|按名称/i });
    expect(sortTrigger).toHaveClass('sort-trigger-btn');
    expect(sortTrigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(sortTrigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(sortTrigger);
    expect(sortTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Backdrop dismiss check
    const backdrop = container.querySelector('.sort-menu-backdrop');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(sortTrigger).toHaveAttribute('aria-expanded', 'false');
  });
});
