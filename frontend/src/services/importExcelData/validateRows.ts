import type { TranslationKey } from '../../i18n/translations';
import { getFieldHeader } from './columnMapping';
import type {
  CameraDraft,
  EntityReference,
  FilmStockDraft,
  ImportColumnMapping,
  ImportRowIssue,
  ImportRowResult,
  LensDraft,
  RollDraft,
} from './types';

export type ExcelRow = Record<string, unknown>;
type NumberParseResult = { value: number | undefined } | { error: TranslationKey };

const CAMERA_TYPES = new Set(['film', 'digital']);
const CAMERA_FORMATS = new Set(['135', '120', 'digital']);
const LENS_TYPES = new Set(['prime', 'zoom']);
const FILM_TYPES = new Set(['color', 'bw']);
const FILM_FORMATS = new Set(['135', '120']);

const asText = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());

const asOptionalNumber = (value: unknown): NumberParseResult => {
  const text = asText(value);
  if (!text) return { value: undefined };
  const number = Number(text);
  return Number.isFinite(number) ? { value: number } : { error: 'excel.reasonValidNumber' };
};

const asNonNegativeNumber = (value: unknown, integer = false): NumberParseResult => {
  const parsed = asOptionalNumber(value);
  if ('error' in parsed) return parsed;
  if (parsed.value === undefined) return parsed;
  if (parsed.value < 0 || (integer && !Number.isInteger(parsed.value))) {
    return { error: integer ? 'excel.reasonNonNegativeInteger' : 'excel.reasonNonNegativeNumber' };
  }
  return parsed;
};

const field = (row: ExcelRow, mappings: ImportColumnMapping[], name: string): unknown => {
  const header = getFieldHeader(mappings, name);
  return header ? row[header] : undefined;
};

const issue = (
  fieldName: string,
  reasonKey: TranslationKey,
  reasonValues?: Record<string, string | number>,
  severity: ImportRowIssue['severity'] = 'error',
): ImportRowIssue => ({ field: fieldName, reasonKey, reasonValues, severity });

export const validateCameraRows = (
  rows: ExcelRow[],
  mappings: ImportColumnMapping[],
): ImportRowResult<CameraDraft>[] => rows.map((row, index) => {
  const rowNumber = index + 2;
  const rowRef = `相机机身:${rowNumber}`;
  const issues: ImportRowIssue[] = [];

  const name = asText(field(row, mappings, 'name'));
  const rawType = asText(field(row, mappings, 'type')).toLowerCase();
  const rawFormat = asText(field(row, mappings, 'format')).toLowerCase();
  const price = asNonNegativeNumber(field(row, mappings, 'purchasePrice'));

  if (!name) issues.push(issue('相机名称', 'excel.reasonRequired'));
  if (rawType && !CAMERA_TYPES.has(rawType)) issues.push(issue('类型', 'excel.reasonCameraType'));
  if (rawFormat && !CAMERA_FORMATS.has(rawFormat)) issues.push(issue('画幅', 'excel.reasonCameraFormat'));
  if ('error' in price) issues.push(issue('购入价格', price.error));
  if (rawType === 'digital' && rawFormat && rawFormat !== 'digital') issues.push(issue('画幅', 'excel.reasonDigitalFormat'));
  if (rawType !== 'digital' && rawFormat === 'digital') issues.push(issue('画幅', 'excel.reasonFilmCameraFormat'));

  if (issues.length > 0) {
    return { sheet: '相机机身', rowNumber, rowRef, status: 'rejected', issues, matchName: name || undefined };
  }

  return {
    sheet: '相机机身',
    rowNumber,
    rowRef,
    status: 'valid',
    issues: [],
    matchName: name,
    draft: {
      name,
      type: rawType === 'digital' ? 'digital' : 'film',
      format: rawFormat || (rawType === 'digital' ? 'digital' : '135'),
      purchasePrice: 'value' in price ? price.value : undefined,
    },
  };
});

export const validateLensRows = (
  rows: ExcelRow[],
  mappings: ImportColumnMapping[],
): ImportRowResult<LensDraft>[] => rows.map((row, index) => {
  const rowNumber = index + 2;
  const rowRef = `镜头:${rowNumber}`;
  const issues: ImportRowIssue[] = [];

  const name = asText(field(row, mappings, 'name'));
  const focalLength = asNonNegativeNumber(field(row, mappings, 'focalLength'));
  const rawType = asText(field(row, mappings, 'type')).toLowerCase();
  const price = asNonNegativeNumber(field(row, mappings, 'purchasePrice'));

  if (!name) issues.push(issue('镜头名称', 'excel.reasonRequired'));
  if ('error' in focalLength) issues.push(issue('焦段mm', 'excel.reasonPositiveNumber'));
  else if (focalLength.value !== undefined && focalLength.value <= 0) issues.push(issue('焦段mm', 'excel.reasonPositiveNumber'));
  if (rawType && !LENS_TYPES.has(rawType)) issues.push(issue('类型', 'excel.reasonLensType'));
  if ('error' in price) issues.push(issue('购入价格', price.error));

  if (issues.length > 0) {
    return { sheet: '镜头', rowNumber, rowRef, status: 'rejected', issues, matchName: name || undefined };
  }

  return {
    sheet: '镜头',
    rowNumber,
    rowRef,
    status: 'valid',
    issues: [],
    matchName: name,
    draft: {
      name,
      focalLength: 'value' in focalLength ? (focalLength.value ?? 50) : 50,
      maxAperture: asText(field(row, mappings, 'maxAperture')) || 'f/2',
      type: rawType || 'prime',
      purchasePrice: 'value' in price ? price.value : undefined,
    },
  };
});

export const validateFilmStockRows = (
  rows: ExcelRow[],
  mappings: ImportColumnMapping[],
): ImportRowResult<FilmStockDraft>[] => rows.map((row, index) => {
  const rowNumber = index + 2;
  const rowRef = `胶卷库存:${rowNumber}`;
  const issues: ImportRowIssue[] = [];

  const brand = asText(field(row, mappings, 'brand'));
  const name = asText(field(row, mappings, 'name'));
  const matchName = brand || name ? `${brand} ${name}`.trim() : undefined;
  const iso = asNonNegativeNumber(field(row, mappings, 'iso'), true);
  const stockCount = asNonNegativeNumber(field(row, mappings, 'stockCount'), true);
  const price = asNonNegativeNumber(field(row, mappings, 'pricePerRoll'));
  const rawType = asText(field(row, mappings, 'colorType')).toLowerCase();
  const rawFormat = asText(field(row, mappings, 'format')).toLowerCase();

  if (!brand) issues.push(issue('品牌', 'excel.reasonRequired'));
  if (!name) issues.push(issue('型号名称', 'excel.reasonRequired'));
  if ('error' in iso) issues.push(issue('ISO', 'excel.reasonPositiveInteger'));
  else if (iso.value === undefined || iso.value <= 0) issues.push(issue('ISO', 'excel.reasonPositiveInteger'));
  if ('error' in stockCount) issues.push(issue('初始库存数量', stockCount.error));
  if ('error' in price) issues.push(issue('单卷均价', price.error));
  if (rawType && !FILM_TYPES.has(rawType)) issues.push(issue('类型', 'excel.reasonFilmType'));
  if (rawFormat && !FILM_FORMATS.has(rawFormat)) issues.push(issue('画幅', 'excel.reasonFilmFormat'));

  if (issues.length > 0) {
    return { sheet: '胶卷库存', rowNumber, rowRef, status: 'rejected', issues, matchName };
  }

  return {
    sheet: '胶卷库存',
    rowNumber,
    rowRef,
    status: 'valid',
    issues: [],
    matchName,
    draft: {
      brand,
      name,
      iso: 'value' in iso ? (iso.value ?? 0) : 0,
      colorType: rawType === 'bw' ? 'bw' : 'color',
      format: rawFormat || '135',
      stockCount: 'value' in stockCount ? (stockCount.value ?? 0) : 0,
      pricePerRoll: 'value' in price ? price.value : undefined,
    },
  };
});

/**
 * Resolves a name reference against draft rows parsed from the same
 * workbook (matched via `matchName`, which is set regardless of a row's
 * validation status). Ambiguity (2+ same-name rows) and a single match that
 * itself failed validation are both hard failures here — never silently
 * pick one, and never silently fall back to an existing-entity lookup for
 * either case.
 */
const resolveDraftReference = (
  name: string,
  candidates: ImportRowResult[],
): { reference?: EntityReference; issue?: ImportRowIssue } => {
  const nameMatches = candidates.filter(candidate => candidate.matchName === name);
  if (nameMatches.length > 1) {
    return { issue: issue('相机/胶卷', 'excel.reasonAmbiguousDraftReference', { name }) };
  }
  if (nameMatches.length === 1) {
    const match = nameMatches[0];
    if (match.status === 'rejected') {
      return { issue: issue('相机/胶卷', 'excel.reasonDraftReferenceRejected', { name }) };
    }
    return { reference: { kind: 'draft', rowRef: match.rowRef } };
  }
  return {};
};

export const validateRollRows = (
  rows: ExcelRow[],
  mappings: ImportColumnMapping[],
  cameraResults: ImportRowResult<CameraDraft>[],
  filmStockResults: ImportRowResult<FilmStockDraft>[],
  resolveExistingCamera: (name: string) => Promise<{ id: string } | undefined>,
  resolveExistingFilm: (brand: string, name: string) => Promise<{ id: string } | undefined>,
): Promise<ImportRowResult<RollDraft>[]> => Promise.all(rows.map(async (row, index) => {
  const rowNumber = index + 2;
  const rowRef = `拍摄任务:${rowNumber}`;
  const issues: ImportRowIssue[] = [];

  const name = asText(field(row, mappings, 'name'));
  const cameraName = asText(field(row, mappings, 'cameraName'));
  const developmentCost = asNonNegativeNumber(field(row, mappings, 'developmentCost'));

  if (!name) issues.push(issue('拍摄主题名称', 'excel.reasonRequired'));
  if (!cameraName) issues.push(issue('相机名称', 'excel.reasonRequired'));
  if ('error' in developmentCost) issues.push(issue('冲洗花费', developmentCost.error));

  if (issues.length > 0) {
    return { sheet: '拍摄任务', rowNumber, rowRef, status: 'rejected', issues } as ImportRowResult<RollDraft>;
  }

  const cameraDraftResolution = resolveDraftReference(cameraName, cameraResults);
  let cameraRef: EntityReference | undefined = cameraDraftResolution.reference;
  if (cameraDraftResolution.issue) {
    issues.push(cameraDraftResolution.issue);
  } else if (!cameraRef) {
    const existingCamera = await resolveExistingCamera(cameraName);
    if (!existingCamera) {
      issues.push(issue('相机名称', 'excel.reasonMissingCamera', { camera: cameraName }));
    } else {
      cameraRef = { kind: 'existing', entityId: existingCamera.id };
    }
  }

  // Whether this roll needs a film reference depends on the resolved
  // camera's type, which we only know for a 'draft' reference here (an
  // 'existing' camera's type is re-checked live at commit time anyway).
  const referencedCameraDraft = cameraRef?.kind === 'draft'
    ? cameraResults.find(result => result.rowRef === cameraRef!.rowRef)?.draft
    : undefined;
  const isKnownFilmCamera = referencedCameraDraft ? referencedCameraDraft.type === 'film' : undefined;

  let filmRef: EntityReference | undefined;
  const filmBrand = asText(field(row, mappings, 'filmBrand'));
  const filmName = asText(field(row, mappings, 'filmName'));
  const hasFilmColumns = Boolean(filmBrand || filmName);

  if (isKnownFilmCamera !== false && (isKnownFilmCamera === true || hasFilmColumns)) {
    if (!filmBrand || !filmName) {
      issues.push(issue('胶卷', 'excel.reasonFilmRequired'));
    } else {
      const combinedFilmName = `${filmBrand} ${filmName}`;
      const filmDraftResolution = resolveDraftReference(combinedFilmName, filmStockResults);
      filmRef = filmDraftResolution.reference;
      if (filmDraftResolution.issue) {
        issues.push({ ...filmDraftResolution.issue, reasonValues: { name: combinedFilmName } });
      } else if (!filmRef) {
        const existingFilm = await resolveExistingFilm(filmBrand, filmName);
        if (!existingFilm) {
          issues.push(issue('胶卷', 'excel.reasonMissingFilm', { film: combinedFilmName }));
        } else {
          filmRef = { kind: 'existing', entityId: existingFilm.id };
        }
      }
    }
  }

  if (issues.length > 0) {
    return { sheet: '拍摄任务', rowNumber, rowRef, status: 'rejected', issues } as ImportRowResult<RollDraft>;
  }

  return {
    sheet: '拍摄任务',
    rowNumber,
    rowRef,
    status: 'valid',
    issues: [],
    draft: {
      name,
      cameraRef: cameraRef!,
      filmRef,
      location: asText(field(row, mappings, 'location')) || undefined,
      developmentCost: 'value' in developmentCost ? developmentCost.value : undefined,
    },
  } as ImportRowResult<RollDraft>;
}));
