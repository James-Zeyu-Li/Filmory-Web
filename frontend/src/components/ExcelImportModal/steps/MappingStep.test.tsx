import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MappingStep } from './MappingStep';
import type { ImportPreview } from '../../../services/importExcelData';

const t = (key: string, values?: Record<string, unknown>) => (
  key + (values ? `:${JSON.stringify(values)}` : '')
);

const basePreview = (): ImportPreview => ({
  fileName: 'test.xlsx',
  mappings: [
    {
      sheet: '相机机身', expectedField: 'name', expectedLabel: '相机名称',
      matchedHeader: null, required: true, status: 'needs-user-choice',
    },
    {
      sheet: '相机机身', expectedField: 'type', expectedLabel: '类型',
      matchedHeader: '类型 (film/digital)', required: false, status: 'auto-matched',
    },
  ],
  actualHeadersBySheet: { '相机机身': ['Camera Name', 'Camera Type'], '镜头': [], '胶卷库存': [], '拍摄任务': [] },
  rows: { cameras: [], lenses: [], filmStocks: [], rolls: [] },
  duplicateGroups: [],
  counts: { valid: 0, warning: 0, rejected: 0 },
});

describe('MappingStep', () => {
  it('only lists needs-user-choice mappings, with dropdown options from actualHeadersBySheet', () => {
    render(
      <MappingStep
        t={t}
        preview={basePreview()}
        pendingEdits={[]}
        isBusy={false}
        onChoose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/相机名称/)).toBeInTheDocument();
    expect(screen.queryByText(/类型/)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Camera Name' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Camera Type' })).toBeInTheDocument();
  });

  it('disables confirm until every required field has a chosen header', () => {
    const { rerender } = render(
      <MappingStep t={t} preview={basePreview()} pendingEdits={[]} isBusy={false} onChoose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText('excel.mappingConfirmButton')).toBeDisabled();

    rerender(
      <MappingStep
        t={t}
        preview={basePreview()}
        pendingEdits={[{ sheet: '相机机身', expectedField: 'name', matchedHeader: 'Camera Name' }]}
        isBusy={false}
        onChoose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('excel.mappingConfirmButton')).not.toBeDisabled();
  });

  it('calls onChoose with the selected header', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <MappingStep t={t} preview={basePreview()} pendingEdits={[]} isBusy={false} onChoose={onChoose} onConfirm={vi.fn()} />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'Camera Name');
    expect(onChoose).toHaveBeenCalledWith('相机机身', 'name', 'Camera Name');
  });
});
