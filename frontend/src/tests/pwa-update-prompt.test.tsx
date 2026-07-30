import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PwaUpdatePrompt } from '../components/PwaUpdatePrompt';
import { FeedbackProvider } from '../contexts/FeedbackContext';
import { PWA_UPDATE_READY_EVENT } from '../services/pwaUpdateService';

describe('PwaUpdatePrompt', () => {
  it('shows an update prompt and lets the user choose when to refresh', async () => {
    const update = vi.fn();

    render(
      <FeedbackProvider>
        <PwaUpdatePrompt />
      </FeedbackProvider>
    );

    window.dispatchEvent(new CustomEvent(PWA_UPDATE_READY_EVENT, {
      detail: { update },
    }));

    expect(await screen.findByText('发现新版本')).toBeInTheDocument();
    expect(screen.getByText(/避免打断正在录入的内容/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '立即更新' }));

    expect(update).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText('发现新版本')).not.toBeInTheDocument();
    });
  });

  it('dismisses the update prompt when postponed', async () => {
    const update = vi.fn();

    render(
      <FeedbackProvider>
        <PwaUpdatePrompt />
      </FeedbackProvider>
    );

    window.dispatchEvent(new CustomEvent(PWA_UPDATE_READY_EVENT, {
      detail: { update },
    }));

    expect(await screen.findByText('发现新版本')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '稍后' }));

    expect(update).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText('发现新版本')).not.toBeInTheDocument();
    });
  });
});
