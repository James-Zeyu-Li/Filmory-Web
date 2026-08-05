import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmProvider } from '../contexts/ConfirmContext';
import { useConfirm } from '../contexts/useConfirm';
import { LanguageProvider } from '../contexts/LanguageContext';

const ConfirmTrigger = () => {
  const { confirm } = useConfirm();

  return (
    <button type="button" onClick={() => void confirm({ title: 'Confirm change', message: 'Continue?' })}>
      Open confirmation
    </button>
  );
};

describe('ConfirmProvider', () => {
  it('renders confirmations above standard modal overlays', () => {
    render(
      <LanguageProvider>
        <ConfirmProvider>
          <ConfirmTrigger />
        </ConfirmProvider>
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open confirmation' }));

    const overlay = screen.getByRole('heading', { name: 'Confirm change' }).closest('.modal-overlay');
    expect(overlay).toHaveStyle({ zIndex: '10000' });
    expect(overlay?.parentElement).toBe(document.body);
  });
});
