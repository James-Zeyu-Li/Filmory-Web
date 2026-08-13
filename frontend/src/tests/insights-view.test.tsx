import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { InsightsView } from '../views/Insights/InsightsView';

vi.mock('../views/Finance/FinanceView', () => ({
  FinanceView: () => <div data-testid="finance-view">finance content</div>,
}));

vi.mock('../views/Stats/StatsView', () => ({
  StatsView: () => <div data-testid="stats-view">stats content</div>,
}));

vi.mock('../views/FilmInsights/FilmInsightsView', () => ({
  FilmInsightsView: () => <div data-testid="film-insights-view">film content</div>,
}));

const renderInsights = (initialEntry = '/insights') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <InsightsView enableFilmMode={true} />
  </MemoryRouter>
);

describe('InsightsView', () => {
  it('defaults to shooting insights and keeps spending in a sibling tab', () => {
    renderInsights();

    expect(screen.getByRole('heading', { name: '洞察' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '拍摄' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stats-view')).toBeInTheDocument();
    expect(screen.queryByTestId('finance-view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '花费' }));

    expect(screen.getByRole('tab', { name: '花费' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('finance-view')).toBeInTheDocument();
  });

  it('opens the spending tab from a direct URL', () => {
    renderInsights('/insights?tab=spending');

    expect(screen.getByRole('tab', { name: '花费' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('finance-view')).toBeInTheDocument();
  });

  it('opens film reporting from the third insights tab', () => {
    renderInsights();

    fireEvent.click(screen.getByRole('tab', { name: '胶卷' }));
    expect(screen.getByRole('tab', { name: '胶卷' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('film-insights-view')).toBeInTheDocument();
  });

  it('opens the film tab from a direct URL', () => {
    renderInsights('/insights?tab=film');

    expect(screen.getByRole('tab', { name: '胶卷' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('film-insights-view')).toBeInTheDocument();
  });

  it('uses roving tab focus and switches panels with arrow keys', () => {
    renderInsights();

    const shootingTab = screen.getByRole('tab', { name: '拍摄' });
    const spendingTab = screen.getByRole('tab', { name: '花费' });
    expect(shootingTab).toHaveAttribute('tabindex', '0');
    expect(spendingTab).toHaveAttribute('tabindex', '-1');

    shootingTab.focus();
    fireEvent.keyDown(shootingTab, { key: 'ArrowRight' });

    expect(spendingTab).toHaveFocus();
    expect(spendingTab).toHaveAttribute('aria-selected', 'true');
    expect(spendingTab).toHaveAttribute('aria-controls', 'insights-spending-panel');
  });

  it('wraps keyboard navigation from film back to shooting', () => {
    renderInsights('/insights?tab=film');

    const filmTab = screen.getByRole('tab', { name: '胶卷' });
    const shootingTab = screen.getByRole('tab', { name: '拍摄' });
    filmTab.focus();
    fireEvent.keyDown(filmTab, { key: 'ArrowRight' });

    expect(shootingTab).toHaveFocus();
    expect(shootingTab).toHaveAttribute('aria-selected', 'true');
  });
});
