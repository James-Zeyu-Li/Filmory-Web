import { describe, expect, it } from 'vitest';
import type { ImportColumnMapping } from '../../services/importExcelData';
import { mergeColumnMappingEdits } from './mergeColumnMapping';

const baseMapping = (overrides: Partial<ImportColumnMapping> = {}): ImportColumnMapping => ({
  sheet: '相机机身',
  expectedField: 'name',
  expectedLabel: '相机名称',
  matchedHeader: null,
  required: true,
  status: 'needs-user-choice',
  ...overrides,
});

describe('mergeColumnMappingEdits', () => {
  it('leaves a mapping unchanged when no edit targets it', () => {
    const mapping = baseMapping({ matchedHeader: '相机名称 (必填)', status: 'auto-matched' });
    const result = mergeColumnMappingEdits([mapping], []);
    expect(result).toEqual([mapping]);
  });

  it('resolves a required field to auto-matched once a header is chosen', () => {
    const mapping = baseMapping();
    const result = mergeColumnMappingEdits([mapping], [
      { sheet: '相机机身', expectedField: 'name', matchedHeader: 'Camera Name' },
    ]);
    expect(result[0]).toMatchObject({ matchedHeader: 'Camera Name', status: 'auto-matched' });
  });

  it('marks a non-required field skipped when the user explicitly chooses to skip it', () => {
    const mapping = baseMapping({ expectedField: 'format', required: false, status: 'needs-user-choice' });
    const result = mergeColumnMappingEdits([mapping], [
      { sheet: '相机机身', expectedField: 'format', matchedHeader: null },
    ]);
    expect(result[0]).toMatchObject({ matchedHeader: null, status: 'skipped' });
  });

  it('keeps a required field at needs-user-choice if the user "skips" it (required fields cannot be skipped)', () => {
    const mapping = baseMapping();
    const result = mergeColumnMappingEdits([mapping], [
      { sheet: '相机机身', expectedField: 'name', matchedHeader: null },
    ]);
    expect(result[0]).toMatchObject({ matchedHeader: null, status: 'needs-user-choice' });
  });
});
