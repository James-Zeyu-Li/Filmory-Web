import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SuccessStep } from './SuccessStep';
import type { ImportResult } from '../../../services/importExcelData';

const t = (key: string, values?: Record<string, unknown>) => (
  key + (values ? `:${JSON.stringify(values)}` : '')
);

const baseResult = (overrides: Partial<ImportResult['instantArchive']> = {}): ImportResult => ({
  createdCounts: { camera: 0, lens: 0, filmStock: 0, roll: 5 },
  updatedCounts: { camera: 0, lens: 0, filmStock: 0, roll: 0 },
  skippedCounts: { camera: 0, lens: 0, filmStock: 0, roll: 0 },
  failedCounts: { camera: 0, lens: 0, filmStock: 0, roll: 0 },
  createdRollIds: ['r1', 'r2', 'r3', 'r4', 'r5'],
  instantArchive: {
    importedRollCount: 5,
    dateRange: { earliest: Date.parse('2024-01-01'), latest: Date.parse('2024-06-01') },
    topCamera: { cameraId: 'cam-1', name: 'Nikon F3', count: 3 },
    topFilmStock: { filmStockId: 'film-1', label: 'Kodak Gold 200', count: 4 },
    isFallbackSummary: false,
    ...overrides,
  },
});

const renderWithRouter = (ui: ReactElement) => render(
  <MemoryRouter initialEntries={['/settings']}>
    <Routes>
      <Route path="/settings" element={ui} />
      <Route path="/rolls" element={<div>rolls-view</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('SuccessStep', () => {
  it('renders roll count, date range, and top camera/film when not a fallback summary', () => {
    renderWithRouter(<SuccessStep t={t} result={baseResult()} onClose={vi.fn()} />);
    expect(screen.getByText(/excel\.successRollCount/)).toHaveTextContent('"count":5');
    expect(screen.getByText(/excel\.successDateRange/)).toBeInTheDocument();
    expect(screen.getByText(/excel\.successTopCamera/)).toHaveTextContent('Nikon F3');
    expect(screen.getByText(/excel\.successTopFilmStock/)).toHaveTextContent('Kodak Gold 200');
  });

  it('shows only the neutral fallback message and no top-camera/top-film stats when isFallbackSummary is true', () => {
    renderWithRouter(
      <SuccessStep
        t={t}
        result={baseResult({ isFallbackSummary: true, topCamera: undefined, topFilmStock: undefined, dateRange: undefined })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('excel.successFallbackMessage')).toBeInTheDocument();
    expect(screen.queryByText(/excel\.successTopCamera/)).not.toBeInTheDocument();
    expect(screen.queryByText(/excel\.successTopFilmStock/)).not.toBeInTheDocument();
    expect(screen.queryByText(/excel\.successDateRange/)).not.toBeInTheDocument();
  });

  it('navigates to /rolls?tab=all and closes when the primary CTA is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithRouter(<SuccessStep t={t} result={baseResult()} onClose={onClose} />);
    await user.click(screen.getByText('excel.successViewRolls'));
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText('rolls-view')).toBeInTheDocument();
  });

  it('just closes when the secondary dismiss action is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithRouter(<SuccessStep t={t} result={baseResult()} onClose={onClose} />);
    await user.click(screen.getByText('excel.successDismiss'));
    expect(onClose).toHaveBeenCalled();
  });
});
