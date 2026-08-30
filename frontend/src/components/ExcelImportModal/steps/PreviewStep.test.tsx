import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PreviewStep } from './PreviewStep';
import type { ImportPreview } from '../../../services/importExcelData';

const t = (key: string, values?: Record<string, unknown>) => (
  key + (values ? `:${JSON.stringify(values)}` : '')
);

const basePreview = (overrides: Partial<ImportPreview> = {}): ImportPreview => ({
  fileName: 'test.xlsx',
  mappings: [],
  actualHeadersBySheet: { '相机机身': [], '镜头': [], '胶卷库存': [], '拍摄任务': [] },
  rows: {
    cameras: [{
      sheet: '相机机身', rowNumber: 2, rowRef: '相机机身:2', status: 'rejected',
      issues: [{ field: '相机名称', reasonKey: 'excel.reasonRequired', severity: 'error' }],
    }],
    lenses: [],
    filmStocks: [],
    rolls: [],
  },
  duplicateGroups: [],
  counts: { valid: 1, warning: 0, rejected: 1 },
  ...overrides,
});

describe('PreviewStep', () => {
  it('renders rejected row issues with sheet, row, field, and reason', () => {
    render(
      <PreviewStep t={t} preview={basePreview()} hasVisitedMapping={false} onBackToMapping={vi.fn()} onContinue={vi.fn()} />,
    );
    expect(screen.getByText(/excel\.rowError/)).toHaveTextContent('相机机身');
    expect(screen.getByText(/excel\.rowError/)).toHaveTextContent('"row":2');
  });

  it('blocks continuing when there are zero valid rows', () => {
    render(
      <PreviewStep
        t={t}
        preview={basePreview({ counts: { valid: 0, warning: 0, rejected: 1 } })}
        hasVisitedMapping={false}
        onBackToMapping={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText('excel.previewContinueButton')).toBeDisabled();
    expect(screen.getByText('excel.previewNoValidRows')).toBeInTheDocument();
  });

  it('allows continuing when at least one row is valid, even with rejected rows present', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <PreviewStep t={t} preview={basePreview()} hasVisitedMapping={false} onBackToMapping={vi.fn()} onContinue={onContinue} />,
    );
    const continueButton = screen.getByText('excel.previewContinueButton');
    expect(continueButton).not.toBeDisabled();
    await user.click(continueButton);
    expect(onContinue).toHaveBeenCalled();
  });

  it('only shows "back to mapping" when the mapping step was actually visited', () => {
    const { rerender } = render(
      <PreviewStep t={t} preview={basePreview()} hasVisitedMapping={false} onBackToMapping={vi.fn()} onContinue={vi.fn()} />,
    );
    expect(screen.queryByText('excel.previewBackToMapping')).not.toBeInTheDocument();

    rerender(
      <PreviewStep t={t} preview={basePreview()} hasVisitedMapping onBackToMapping={vi.fn()} onContinue={vi.fn()} />,
    );
    expect(screen.getByText('excel.previewBackToMapping')).toBeInTheDocument();
  });
});
