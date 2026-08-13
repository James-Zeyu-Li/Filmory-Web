import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../components/Modal';

describe('Modal backdrop dismissal', () => {
  it('does not close when text selection starts inside the modal and ends on the backdrop', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <input aria-label="Record name" defaultValue="Street walk" />
      </Modal>
    );

    const input = screen.getByRole('textbox', { name: 'Record name' });
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();

    fireEvent.pointerDown(input);
    fireEvent.pointerUp(overlay!);
    fireEvent.click(overlay!);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the pointer starts and ends on the backdrop', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <input aria-label="Record name" />
      </Modal>
    );

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();

    fireEvent.pointerDown(overlay!);
    fireEvent.pointerUp(overlay!);
    fireEvent.click(overlay!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when pressing the Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
