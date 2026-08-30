import type { ImportColumnMapping, ImportSheetName } from './types';

interface FieldDefinition {
  field: string;
  label: string;
  header: string; // exact header text used by downloadExcelTemplate()
  required: boolean;
}

const FIELD_DEFINITIONS: Record<ImportSheetName, FieldDefinition[]> = {
  '相机机身': [
    { field: 'name', label: '相机名称', header: '相机名称 (必填)', required: true },
    { field: 'type', label: '类型', header: '类型 (film/digital)', required: false },
    { field: 'format', label: '画幅', header: '画幅 (135/120/digital)', required: false },
    { field: 'purchasePrice', label: '购入价格', header: '购入价格 (选填)', required: false },
  ],
  '镜头': [
    { field: 'name', label: '镜头名称', header: '镜头名称 (必填)', required: true },
    { field: 'focalLength', label: '焦段mm', header: '焦段mm', required: false },
    { field: 'maxAperture', label: '最大光圈', header: '最大光圈 (例如 f/2)', required: false },
    { field: 'type', label: '类型', header: '类型 (prime/zoom)', required: false },
    { field: 'purchasePrice', label: '购入价格', header: '购入价格 (选填)', required: false },
  ],
  '胶卷库存': [
    { field: 'brand', label: '品牌', header: '品牌 (必填)', required: true },
    { field: 'name', label: '型号名称', header: '型号名称 (必填)', required: true },
    { field: 'iso', label: 'ISO', header: 'ISO (必填)', required: true },
    { field: 'colorType', label: '类型', header: '类型 (color/bw)', required: false },
    { field: 'format', label: '画幅', header: '画幅 (135/120)', required: false },
    { field: 'stockCount', label: '初始库存数量', header: '初始库存数量', required: false },
    { field: 'pricePerRoll', label: '单卷均价', header: '单卷均价 (选填)', required: false },
  ],
  '拍摄任务': [
    { field: 'name', label: '拍摄主题名称', header: '拍摄主题名称 (必填)', required: true },
    { field: 'cameraName', label: '相机名称', header: '相机名称 (必填)', required: true },
    { field: 'filmBrand', label: '胶卷品牌', header: '胶卷品牌 (仅胶片)', required: false },
    { field: 'filmName', label: '胶卷型号', header: '胶卷型号 (仅胶片)', required: false },
    { field: 'location', label: '拍摄地点', header: '拍摄地点 (选填)', required: false },
    { field: 'developmentCost', label: '冲洗花费', header: '冲洗花费 (选填)', required: false },
  ],
};

/**
 * Only exact-header auto-match is supported in Stage A (no fuzzy/AI mapping,
 * per UI-23). A required field with no exact header present is flagged
 * `needs-user-choice` rather than silently defaulted.
 */
export const buildColumnMappings = (
  sheet: ImportSheetName,
  actualHeaders: string[],
): ImportColumnMapping[] => (
  FIELD_DEFINITIONS[sheet].map(def => {
    const matchedHeader = actualHeaders.includes(def.header) ? def.header : null;
    return {
      sheet,
      expectedField: def.field,
      expectedLabel: def.label,
      matchedHeader,
      required: def.required,
      status: matchedHeader ? 'auto-matched' : (def.required ? 'needs-user-choice' : 'skipped'),
    };
  })
);

export const getFieldHeader = (mappings: ImportColumnMapping[], field: string): string | null => (
  mappings.find(mapping => mapping.expectedField === field)?.matchedHeader ?? null
);
