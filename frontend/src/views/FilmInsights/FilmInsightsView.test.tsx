import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../db/schema';
import { FilmInsightsView } from './FilmInsightsView';

const renderFilmInsights = () => render(
  <MemoryRouter initialEntries={['/film-insights']}>
    <FilmInsightsView />
  </MemoryRouter>,
);

describe('FilmInsightsView', () => {
  beforeEach(async () => {
    await Promise.all([db.filmStocks.clear(), db.rolls.clear()]);
  });

  it('shows an empty state until the user has registered film', async () => {
    renderFilmInsights();

    expect(await screen.findByRole('heading', { name: '还没有可分析的胶卷' })).toBeInTheDocument();
  });

  it('separates active and completed rolls and opens film details', async () => {
    await db.filmStocks.add({
      id: 'film-1', userId: 'mock-user-id', brand: 'Kodak', name: 'Tri-X 400', iso: 400,
      colorType: 'bw', format: '135', isSystem: 0, stockCount: 2, addedAt: 1,
    });
    await db.rolls.bulkAdd([
      { id: 'roll-active', userId: 'mock-user-id', name: 'Rainy Walk', cameraIds: [], filmStockId: 'film-1', status: 'active', startDate: 200 },
      { id: 'roll-archived', userId: 'mock-user-id', name: 'Winter Study', cameraIds: [], filmStockId: 'film-1', status: 'archived', endDate: 100 },
    ]);
    const user = userEvent.setup();
    renderFilmInsights();

    expect(await screen.findByText('2 卷')).toBeInTheDocument();
    expect(screen.getAllByText('1 卷')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: '查看 Kodak Tri-X 400 的胶卷详情' }));

    const dialog = await screen.findByRole('dialog', { name: 'Kodak Tri-X 400' });
    expect(dialog).toHaveTextContent('正在使用的卷');
    expect(dialog).toHaveTextContent('Rainy Walk');
    expect(dialog).toHaveTextContent('使用记录');
    expect(dialog).toHaveTextContent('Winter Study');
  });

  it('updates the selected sort without changing the usage data', async () => {
    await db.filmStocks.bulkAdd([
      { id: 'film-1', userId: 'mock-user-id', brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '135', isSystem: 0, stockCount: 1, addedAt: 1 },
      { id: 'film-2', userId: 'mock-user-id', brand: 'Ilford', name: 'HP5 Plus', iso: 400, colorType: 'bw', format: '135', isSystem: 0, stockCount: 5, addedAt: 2 },
    ]);
    const user = userEvent.setup();
    renderFilmInsights();

    const sortControl = await screen.findByRole('combobox', { name: '排序方式' });
    await user.selectOptions(sortControl, 'stock');

    await waitFor(() => expect(sortControl).toHaveValue('stock'));
    expect(screen.getByRole('button', { name: '查看 Ilford HP5 Plus 的胶卷详情' })).toBeInTheDocument();
  });
});
