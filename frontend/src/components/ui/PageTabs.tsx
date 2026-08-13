import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import './PageTabs.css';

export interface PageTab<T extends string> {
  id: T;
  label: ReactNode;
}

interface PageTabsProps<T extends string> {
  tabs: readonly PageTab<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  idPrefix: string;
  className?: string;
}

/** Shared page-level tabs with roving focus and panel relationships. */
export function PageTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  idPrefix,
  className,
}: PageTabsProps<T>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    onChange(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className={['page-tabs', className].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={ariaLabel}
      data-tab-count={tabs.length}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            className="page-tab"
            role="tab"
            id={`${idPrefix}-${tab.id}-tab`}
            aria-controls={`${idPrefix}-${tab.id}-panel`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            ref={element => { tabRefs.current[index] = element; }}
            onClick={() => onChange(tab.id)}
            onKeyDown={event => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
