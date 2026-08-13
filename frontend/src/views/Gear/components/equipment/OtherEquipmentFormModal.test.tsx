import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmContext } from '../../../../contexts/confirmContextCore';
import { CurrencyContext } from '../../../../contexts/currencyContextCore';
import { FeedbackContext } from '../../../../contexts/feedbackContextCore';
import { db } from '../../../../db/schema';
import { GearView } from '../../GearView';

const renderGearView = () => render(
  <MemoryRouter initialEntries={['/gear?tab=otherEquipments']}>
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

describe('OtherEquipmentFormModal migration', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([
      db.otherEquipments.clear(),
      db.ledgerTransactions.clear(),
      db.syncQueue.clear(),
    ]);
  });

  it('preserves chemistry creation, purchase ledger, and editing', async () => {
    const user = userEvent.setup();
    renderGearView();

    await user.click((await screen.findAllByRole('button', { name: '添加器材' }))[0]);
    const createModal = screen.getByRole('heading', { name: '添加新器材' }).closest('.modal-content');
    expect(createModal).not.toBeNull();
    const createForm = within(createModal as HTMLElement);

    await user.type(createForm.getByPlaceholderText('例如: D-76 显影粉 / 捷信三脚架'), 'Kodak D-76');
    const dateInputs = createModal!.querySelectorAll<HTMLInputElement>('input[type="date"]');
    await user.type(dateInputs[0], '2026-08-12');
    await user.type(dateInputs[1], '2027-08-12');
    await user.type(createForm.getByPlaceholderText('例如: 350 (选填)'), '25');
    await user.type(createForm.getByPlaceholderText('关于该器材的额外备注...'), 'One gallon mix');
    await user.click(createForm.getByRole('button', { name: /^添加$/ }));

    const createdEquipment = await waitFor(async () => {
      const equipment = await db.otherEquipments.where('name').equals('Kodak D-76').first();
      expect(equipment).toEqual(expect.objectContaining({
        type: 'chemical',
        purchasePrice: 25,
        notes: 'One gallon mix',
      }));
      return equipment;
    });
    expect(await db.ledgerTransactions.where('relatedEntityId').equals(createdEquipment!.id!).first()).toEqual(
      expect.objectContaining({ amount: -25, category: 'chemical' }),
    );

    await act(async () => {
      await db.otherEquipments.update(createdEquipment!.id!, { avatarUrl: 'data:image/webp;base64,cover' });
    });
    await user.click(await screen.findByText('Kodak D-76'));
    const editModal = screen.getByRole('heading', { name: '编辑器材' }).closest('.modal-content');
    expect(editModal).not.toBeNull();
    const editForm = within(editModal as HTMLElement);
    expect(await editForm.findByRole('img', { name: 'Kodak D-76' })).toBeInTheDocument();
    await user.click(editForm.getByRole('button', { name: '移除封面' }));
    await waitFor(() => {
      expect(editForm.queryByRole('img', { name: 'Kodak D-76' })).not.toBeInTheDocument();
      expect(editForm.queryByRole('button', { name: '移除封面' })).not.toBeInTheDocument();
    });
    await user.selectOptions(editForm.getByRole('combobox'), 'tripod');
    const notesInput = editForm.getByPlaceholderText('关于该器材的额外备注...');
    await user.clear(notesInput);
    await user.type(notesInput, 'Repurposed record');
    await user.click(editForm.getByRole('button', { name: '保存更改' }));

    await waitFor(async () => {
      expect(await db.otherEquipments.get(createdEquipment!.id!)).toEqual(expect.objectContaining({
        type: 'tripod',
        notes: 'Repurposed record',
      }));
    });
  });
});
