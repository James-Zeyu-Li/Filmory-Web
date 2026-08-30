import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcelImportModal } from './ExcelImportModal';
import type { ImportPreview, ImportResult } from '../../services/importExcelData';

const mockParseAndValidate = vi.fn();
const mockCommit = vi.fn();

vi.mock('../../services/importExcelData', async () => {
  const actual = await vi.importActual<typeof import('../../services/importExcelData')>('../../services/importExcelData');
  return {
    ...actual,
    downloadExcelTemplate: vi.fn(),
    parseAndValidateExcelImport: (...args: unknown[]) => mockParseAndValidate(...args),
    commitExcelImport: (...args: unknown[]) => mockCommit(...args),
  };
});

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../contexts/useLanguage', async () => {
  const mod = await import('../../i18n/translations');
  return {
    useLanguage: () => ({
      language: 'zh-CN',
      t: (key: string, values?: Record<string, unknown>) => (
        (mod.translations['zh-CN'][key as keyof typeof mod.translations['zh-CN']] || key)
          .replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? ''))
      ),
    }),
  };
});

const basePreview = (overrides: Partial<ImportPreview> = {}): ImportPreview => ({
  fileName: 'test.xlsx',
  mappings: [],
  actualHeadersBySheet: { '相机机身': [], '镜头': [], '胶卷库存': [], '拍摄任务': [] },
  rows: { cameras: [], lenses: [], filmStocks: [], rolls: [] },
  duplicateGroups: [],
  counts: { valid: 1, warning: 0, rejected: 0 },
  ...overrides,
});

const baseResult = (): ImportResult => ({
  createdCounts: { camera: 0, lens: 0, filmStock: 0, roll: 1 },
  updatedCounts: { camera: 0, lens: 0, filmStock: 0, roll: 0 },
  skippedCounts: { camera: 0, lens: 0, filmStock: 0, roll: 0 },
  failedCounts: { camera: 0, lens: 0, filmStock: 0, roll: 0 },
  createdRollIds: ['r1'],
  instantArchive: { importedRollCount: 1, isFallbackSummary: true },
});

const uploadFile = async () => {
  const user = userEvent.setup();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await user.upload(input, file);
};

const renderModal = () => render(
  <MemoryRouter>
    <ExcelImportModal onClose={vi.fn()} />
  </MemoryRouter>,
);

describe('ExcelImportModal wizard', () => {
  beforeEach(() => {
    mockParseAndValidate.mockReset();
    mockCommit.mockReset();
  });

  it('skips the mapping and duplicate steps and goes straight to the preview, then submits directly on continue', async () => {
    mockParseAndValidate.mockResolvedValue(basePreview());
    mockCommit.mockResolvedValue(baseResult());
    renderModal();

    await uploadFile();

    const continueButton = await screen.findByText('继续');
    expect(screen.queryByText('确认导入')).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(continueButton);

    await waitFor(() => expect(mockCommit).toHaveBeenCalledWith(expect.anything(), {}, 'user-1', expect.any(Function)));
    expect(await screen.findByText('导入完成')).toBeInTheDocument();
  });

  it('goes to the mapping step first when a required field needs a manual header choice', async () => {
    mockParseAndValidate.mockResolvedValue(basePreview({
      mappings: [{
        sheet: '相机机身', expectedField: 'name', expectedLabel: '相机名称',
        matchedHeader: null, required: true, status: 'needs-user-choice',
      }],
    }));
    renderModal();

    await uploadFile();

    expect(await screen.findByText('确认字段对应关系')).toBeInTheDocument();
  });

  it('goes to the duplicates step when the preview has duplicate groups', async () => {
    mockParseAndValidate.mockResolvedValue(basePreview({
      duplicateGroups: [{
        id: 'camera:existing-1', entityKind: 'camera', matchField: 'name',
        existing: { id: 'existing-1', label: 'Nikon F3' }, incomingRowRefs: ['相机机身:2'], choice: 'skip',
      }],
    }));
    renderModal();

    await uploadFile();
    const user = userEvent.setup();
    await user.click(await screen.findByText('继续'));

    expect(await screen.findByText('处理重复项')).toBeInTheDocument();
  });

  it('shows the error step and preserves the wizard state when commit fails', async () => {
    mockParseAndValidate.mockResolvedValue(basePreview());
    mockCommit.mockRejectedValue(new Error('boom'));
    renderModal();

    await uploadFile();
    const user = userEvent.setup();
    await user.click(await screen.findByText('继续'));

    expect(await screen.findByText('导入未能完成')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
