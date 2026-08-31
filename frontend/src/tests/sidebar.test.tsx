import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

vi.mock('../contexts/useLanguage', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'nav.dashboard': '控制中心',
      'nav.rolls': '拍摄记录',
      'nav.gear': '器材库',
      'nav.insights': '洞察',
      'nav.compare': '照片对照',
      'nav.settings': '设置',
      'nav.collapse': '收起侧边栏',
      'nav.expandTitle': '展开侧边栏',
      'nav.collapseTitle': '收起侧边栏',
    })[key] || key,
  }),
}));

const renderSidebar = () => render(
  <MemoryRouter>
    <Sidebar
      onOpenSettings={vi.fn()}
      isOpen={false}
      onClose={vi.fn()}
    />
  </MemoryRouter>
);

describe('Sidebar', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 });
  });

  it('keeps the collapse action semantically aligned with its current state', () => {
    renderSidebar();

    const collapseButton = screen.getByRole('button', { name: '收起侧边栏' });
    expect(collapseButton).toHaveTextContent('收起侧边栏');

    fireEvent.click(collapseButton);

    const expandButton = screen.getByRole('button', { name: '展开侧边栏' });
    expect(expandButton).toHaveTextContent('展开侧边栏');
    expect(document.querySelector('.sidebar')).toHaveClass('collapsed');
  });

  it('starts collapsed in the desktop pre-collapse range', () => {
    window.innerWidth = 1100;
    renderSidebar();

    expect(screen.getByRole('button', { name: '展开侧边栏' })).toBeInTheDocument();
    expect(document.querySelector('.sidebar')).toHaveClass('collapsed');
  });

  it('closes the mobile drawer when resized back above the desktop breakpoint', () => {
    window.innerWidth = 800;
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar
          onOpenSettings={vi.fn()}
          isOpen
          onClose={onClose}
        />
      </MemoryRouter>
    );

    window.innerWidth = 1440;
    fireEvent(window, new Event('resize'));

    expect(onClose).toHaveBeenCalled();
  });
});
