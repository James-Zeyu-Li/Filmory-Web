import { describe, expect, it } from 'vitest';
import { buildColumnMappings, getFieldHeader } from './columnMapping';

describe('buildColumnMappings', () => {
  it('auto-matches every field when headers exactly match the template', () => {
    const mappings = buildColumnMappings('相机机身', [
      '相机名称 (必填)', '类型 (film/digital)', '画幅 (135/120/digital)', '购入价格 (选填)',
    ]);
    expect(mappings.every(mapping => mapping.status === 'auto-matched')).toBe(true);
    expect(getFieldHeader(mappings, 'name')).toBe('相机名称 (必填)');
  });

  it('flags a missing required column as needs-user-choice rather than defaulting it', () => {
    const mappings = buildColumnMappings('胶卷库存', [
      '品牌 (必填)', '型号名称 (必填)',
      // 'ISO (必填)' header intentionally absent
    ]);
    const isoMapping = mappings.find(mapping => mapping.expectedField === 'iso');
    expect(isoMapping?.status).toBe('needs-user-choice');
    expect(isoMapping?.matchedHeader).toBeNull();
  });

  it('marks a missing optional column as skipped, not needs-user-choice', () => {
    const mappings = buildColumnMappings('相机机身', ['相机名称 (必填)']);
    const priceMapping = mappings.find(mapping => mapping.expectedField === 'purchasePrice');
    expect(priceMapping?.status).toBe('skipped');
  });

  it('marks every field skipped (not needs-user-choice) when the sheet has no headers at all', () => {
    // Distinguishes "sheet present but missing a required column" (real
    // needs-user-choice) from "sheet entirely absent from this workbook"
    // (nothing to map — the user just isn't importing this entity type).
    const mappings = buildColumnMappings('胶卷库存', []);
    expect(mappings.every(mapping => mapping.status === 'skipped')).toBe(true);
  });

  it('ignores unknown/extra columns instead of silently coercing them', () => {
    const mappings = buildColumnMappings('相机机身', [
      '相机名称 (必填)', '一个未知的列', '备注',
    ]);
    expect(mappings.map(mapping => mapping.expectedField)).toEqual(['name', 'type', 'format', 'purchasePrice']);
    expect(getFieldHeader(mappings, 'name')).toBe('相机名称 (必填)');
  });
});
