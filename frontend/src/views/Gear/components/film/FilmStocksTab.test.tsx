import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { FilmStock } from '../../../../db/schema';
import { FilmStocksTab } from './FilmStocksTab';

const film: FilmStock = {
  id: 'film-1', userId: 'mock-user-id', brand: 'Kodak', name: 'Portra 400', iso: 400, colorType: 'color', format: '135', isSystem: 0, stockCount: 3, addedAt: 1,
};

const Harness = (props: {
  onView: (film: FilmStock) => void;
  onEdit: (film: FilmStock) => void;
  onDelete: (id: string) => void;
  onAdjustStock: (id: string, delta: number) => void;
}) => {
  const { t } = useLanguage();
  return (
    <FilmStocksTab
      filmStocks={[film]}
      searchQuery=""
      sortBy="date"
      t={t}
      uploadingEntityId={null}
      onAdd={vi.fn()}
      onUpload={vi.fn()}
      onPreview={vi.fn()}
      {...props}
    />
  );
};

describe('FilmStocksTab', () => {
  it('opens the film history view by default when the card is clicked', async () => {
    const onView = vi.fn();
    const user = userEvent.setup();
    render(<Harness onView={onView} onEdit={vi.fn()} onDelete={vi.fn()} onAdjustStock={vi.fn()} />);

    await user.click(screen.getByText('Kodak Portra 400'));
    expect(onView).toHaveBeenCalledWith(film);
  });

  it('opens history via the invisible full-card action button', async () => {
    const onView = vi.fn();
    const user = userEvent.setup();
    render(<Harness onView={onView} onEdit={vi.fn()} onDelete={vi.fn()} onAdjustStock={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '查看履历：Kodak Portra 400' }));
    expect(onView).toHaveBeenCalledWith(film);
  });

  it('routes edit/delete/stepper clicks to their own handlers without opening history', async () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onAdjustStock = vi.fn();
    const user = userEvent.setup();
    render(<Harness onView={onView} onEdit={onEdit} onDelete={onDelete} onAdjustStock={onAdjustStock} />);

    await user.click(screen.getByRole('button', { name: '编辑胶卷库存' }));
    await user.click(screen.getByRole('button', { name: '彻底删除' }));
    await user.click(screen.getByRole('button', { name: '增加库存' }));
    await user.click(screen.getByRole('button', { name: '减少库存' }));

    expect(onEdit).toHaveBeenCalledWith(film);
    expect(onDelete).toHaveBeenCalledWith('film-1');
    expect(onAdjustStock).toHaveBeenCalledWith('film-1', 1);
    expect(onAdjustStock).toHaveBeenCalledWith('film-1', -1);
    expect(onView).not.toHaveBeenCalled();
  });
});
