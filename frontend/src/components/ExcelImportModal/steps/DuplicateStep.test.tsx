import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DuplicateStep } from './DuplicateStep';
import type { DuplicateChoiceMap, ImportPreview } from '../../../services/importExcelData';

const t = (key: string, values?: Record<string, unknown>) => (
  key + (values ? `:${JSON.stringify(values)}` : '')
);

const basePreview = (): ImportPreview => ({
  fileName: 'test.xlsx',
  mappings: [],
  actualHeadersBySheet: { '相机机身': [], '镜头': [], '胶卷库存': [], '拍摄任务': [] },
  rows: { cameras: [], lenses: [], filmStocks: [], rolls: [] },
  duplicateGroups: [{
    id: 'camera:existing-1', entityKind: 'camera', matchField: 'name',
    existing: { id: 'existing-1', label: 'Nikon F3' }, incomingRowRefs: ['相机机身:2'], choice: 'skip',
  }],
  counts: { valid: 1, warning: 0, rejected: 0 },
});

describe('DuplicateStep', () => {
  it('defaults to skip and disables the update option with the not-supported tooltip', () => {
    const choices: DuplicateChoiceMap = {};
    render(
      <DuplicateStep t={t} preview={basePreview()} duplicateChoices={choices} isBusy={false} onChoose={vi.fn()} onConfirm={vi.fn()} />,
    );

    const skipRadio = screen.getByRole('radio', { name: 'excel.duplicateChoiceSkip' });
    const updateRadio = screen.getByRole('radio', { name: 'excel.duplicateChoiceUpdate' });
    expect(skipRadio).toBeChecked();
    expect(updateRadio).toBeDisabled();
    expect(updateRadio.closest('label')).toHaveAttribute('title', 'excel.reasonUpdateNotSupported');
  });

  it('lets the user select import-as-new, and never lets update be chosen', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <DuplicateStep t={t} preview={basePreview()} duplicateChoices={{}} isBusy={false} onChoose={onChoose} onConfirm={vi.fn()} />,
    );

    await user.click(screen.getByRole('radio', { name: 'excel.duplicateChoiceImportAsNew' }));
    expect(onChoose).toHaveBeenCalledWith('camera:existing-1', 'import-as-new');

    // The disabled update radio cannot be clicked/checked at all.
    await user.click(screen.getByRole('radio', { name: 'excel.duplicateChoiceUpdate' }));
    expect(onChoose).not.toHaveBeenCalledWith('camera:existing-1', 'update');
  });

  it('submits via onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DuplicateStep t={t} preview={basePreview()} duplicateChoices={{}} isBusy={false} onChoose={vi.fn()} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByText('excel.duplicateConfirmButton'));
    expect(onConfirm).toHaveBeenCalled();
  });
});
