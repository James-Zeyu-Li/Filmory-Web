import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageTabs } from './PageTabs';

type TabId = 'shooting' | 'spending' | 'film';

const tabs = [
  { id: 'shooting', label: 'Shooting' },
  { id: 'spending', label: 'Spending' },
  { id: 'film', label: 'Film' },
] as const;

function TestPageTabs() {
  const [activeId, setActiveId] = useState<TabId>('shooting');
  return (
    <>
      <PageTabs
        tabs={tabs}
        activeId={activeId}
        onChange={setActiveId}
        ariaLabel="Insights"
        idPrefix="test-tabs"
      />
      <div id={`test-tabs-${activeId}-panel`} role="tabpanel" aria-labelledby={`test-tabs-${activeId}-tab`}>
        {activeId}
      </div>
    </>
  );
}

describe('PageTabs', () => {
  it('uses roving focus and selects the next tab with arrow keys', () => {
    render(<TestPageTabs />);

    const shootingTab = screen.getByRole('tab', { name: 'Shooting' });
    const spendingTab = screen.getByRole('tab', { name: 'Spending' });
    shootingTab.focus();
    fireEvent.keyDown(shootingTab, { key: 'ArrowRight' });

    expect(spendingTab).toHaveFocus();
    expect(spendingTab).toHaveAttribute('aria-selected', 'true');
    expect(spendingTab).toHaveAttribute('aria-controls', 'test-tabs-spending-panel');
  });

  it('supports Home and End navigation', () => {
    render(<TestPageTabs />);

    const shootingTab = screen.getByRole('tab', { name: 'Shooting' });
    const filmTab = screen.getByRole('tab', { name: 'Film' });
    shootingTab.focus();
    fireEvent.keyDown(shootingTab, { key: 'End' });
    expect(filmTab).toHaveFocus();

    fireEvent.keyDown(filmTab, { key: 'Home' });
    expect(shootingTab).toHaveFocus();
  });
});
