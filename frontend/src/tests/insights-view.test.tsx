import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InsightsView } from '../views/Insights/InsightsView';

vi.mock('../views/Finance/FinanceView', () => ({
  FinanceView: () => <div data-testid="finance-view">finance content</div>,
}));

describe('InsightsView', () => {
  it('renders the spending page only after stats moved back into dashboard', () => {
    render(<InsightsView />);

    expect(screen.getByRole('heading', { name: '花费' })).toBeInTheDocument();
    expect(screen.getByTestId('finance-view')).toBeInTheDocument();
    expect(screen.queryByText('拍摄统计')).not.toBeInTheDocument();
  });
});
