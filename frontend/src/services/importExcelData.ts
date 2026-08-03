import * as XLSX from 'xlsx';
import { db } from '../db/schema';
import { requestImmediateSync } from './syncEvents';
import type { TranslationKey } from '../i18n/translations';

export interface ImportExcelSummary {
  camerasAdded: number;
  lensesAdded: number;
  filmsAdded: number;
  rollsAdded: number;
  errors: string[];
}

type ImportExcelTranslator = (key: TranslationKey, values?: Record<string, string | number>) => string;
type ExcelRow = Record<string, unknown>;
type SheetName = '相机机身' | '镜头' | '胶卷库存' | '拍摄任务';
type NumberParseResult = { value: number | undefined } | { error: TranslationKey };

const CAMERA_TYPES = new Set(['film', 'digital']);
const CAMERA_FORMATS = new Set(['135', '120', 'digital']);
const LENS_TYPES = new Set(['prime', 'zoom']);
const FILM_TYPES = new Set(['color', 'bw']);
const FILM_FORMATS = new Set(['135', '120']);

const importText = (
  t: ImportExcelTranslator | undefined,
  key: TranslationKey,
  fallback: string,
  values?: Record<string, string | number>
) => (
  t ? t(key, values) : fallback.replace(/\{\{(\w+)\}\}/g, (_, valueKey: string) => (
    values?.[valueKey] === undefined ? '' : String(values[valueKey])
  ))
);

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

const addRowError = (
  summary: ImportExcelSummary,
  t: ImportExcelTranslator | undefined,
  sheet: SheetName,
  row: number,
  field: string,
  reasonKey: TranslationKey,
  values?: Record<string, string | number>
) => {
  const reason = importText(t, reasonKey, '', values);
  summary.errors.push(importText(t, 'excel.rowError', '{{sheet}} 第 {{row}} 行，「{{field}}」{{reason}}', { sheet, row, field, reason }));
};

const getRows = (workbook: XLSX.WorkBook, sheetName: SheetName): ExcelRow[] => {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' }) : [];
};

const findCameraByNameForUser = async (name: string, userId: string) => {
  const matches = await db.cameras.where('name').equals(name).toArray();
  return matches.find(camera => camera.userId === userId);
};

const findLensByNameForUser = async (name: string, userId: string) => {
  const matches = await db.lenses.where('name').equals(name).toArray();
  return matches.find(lens => lens.userId === userId);
};

const findFilmByBrandNameForUser = async (brand: string, name: string, userId: string) => {
  const matches = await db.filmStocks.where('brand').equals(brand).toArray();
  return matches.find(film => film.name === name && film.userId === userId);
};

export const downloadExcelTemplate = () => {
  const camerasData = [
    { '相机名称 (必填)': 'Leica M6', '类型 (film/digital)': 'film', '画幅 (135/120/digital)': '135', '购入价格 (选填)': 15000 }
  ];
  const lensesData = [
    { '镜头名称 (必填)': 'Summicron 35mm f/2', '焦段mm': 35, '最大光圈 (例如 f/2)': 'f/2', '类型 (prime/zoom)': 'prime', '购入价格 (选填)': 12000 }
  ];
  const filmsData = [
    { '品牌 (必填)': 'Kodak', '型号名称 (必填)': 'Gold 200', 'ISO (必填)': 200, '类型 (color/bw)': 'color', '画幅 (135/120)': '135', '初始库存数量': 5, '单卷均价 (选填)': 60 }
  ];
  const rollsData = [
    { '拍摄主题名称 (必填)': '春日漫步', '相机名称 (必填)': 'Leica M6', '胶卷品牌 (仅胶片)': 'Kodak', '胶卷型号 (仅胶片)': 'Gold 200', '拍摄地点 (选填)': '朝阳公园', '冲洗花费 (选填)': 35 }
  ];
  const workbook = XLSX.utils.book_new();
  const columnWidths = [{ wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

  ([
    ['相机机身', camerasData],
    ['镜头', lensesData],
    ['胶卷库存', filmsData],
    ['拍摄任务', rollsData],
  ] as const).forEach(([name, rows]) => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = columnWidths;
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  });

  XLSX.writeFile(workbook, 'Grainfolio_Import_Template.xlsx');
};

export const importExcelDataFromFile = async (
  file: File,
  userId: string,
  t?: ImportExcelTranslator
): Promise<ImportExcelSummary> => {
  if (!userId) {
    throw new Error(importText(t, 'excel.serviceMissingUser', 'Excel import needs a valid user identity and blocked cross-account import.'));
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const summary: ImportExcelSummary = { camerasAdded: 0, lensesAdded: 0, filmsAdded: 0, rollsAdded: 0, errors: [] };

  await db.transaction('rw', [db.cameras, db.lenses, db.filmStocks, db.rolls, db.ledgerTransactions], async () => {
    for (const [index, row] of getRows(workbook, '相机机身').entries()) {
      const rowNumber = index + 2;
      const name = asText(row['相机名称 (必填)']);
      const rawType = asText(row['类型 (film/digital)']).toLowerCase();
      const rawFormat = asText(row['画幅 (135/120/digital)']).toLowerCase();
      const price = asNonNegativeNumber(row['购入价格 (选填)']);
      if (!name) { addRowError(summary, t, '相机机身', rowNumber, '相机名称', 'excel.reasonRequired'); continue; }
      if (rawType && !CAMERA_TYPES.has(rawType)) { addRowError(summary, t, '相机机身', rowNumber, '类型', 'excel.reasonCameraType'); continue; }
      if (rawFormat && !CAMERA_FORMATS.has(rawFormat)) { addRowError(summary, t, '相机机身', rowNumber, '画幅', 'excel.reasonCameraFormat'); continue; }
      if ('error' in price) { addRowError(summary, t, '相机机身', rowNumber, '购入价格', price.error); continue; }
      if (rawType === 'digital' && rawFormat && rawFormat !== 'digital') { addRowError(summary, t, '相机机身', rowNumber, '画幅', 'excel.reasonDigitalFormat'); continue; }
      if (rawType !== 'digital' && rawFormat === 'digital') { addRowError(summary, t, '相机机身', rowNumber, '画幅', 'excel.reasonFilmCameraFormat'); continue; }
      if (!await findCameraByNameForUser(name, userId)) {
        await db.cameras.add({ id: crypto.randomUUID(), userId, name, type: rawType === 'digital' ? 'digital' : 'film', format: rawFormat || (rawType === 'digital' ? 'digital' : '135'), purchasePrice: price.value, addedAt: Date.now() });
        summary.camerasAdded++;
      }
    }

    for (const [index, row] of getRows(workbook, '镜头').entries()) {
      const rowNumber = index + 2;
      const name = asText(row['镜头名称 (必填)']);
      const focalLength = asNonNegativeNumber(row['焦段mm']);
      const rawType = asText(row['类型 (prime/zoom)']).toLowerCase();
      const price = asNonNegativeNumber(row['购入价格 (选填)']);
      if (!name) { addRowError(summary, t, '镜头', rowNumber, '镜头名称', 'excel.reasonRequired'); continue; }
      if ('error' in focalLength || (focalLength.value !== undefined && focalLength.value <= 0)) { addRowError(summary, t, '镜头', rowNumber, '焦段mm', 'excel.reasonPositiveNumber'); continue; }
      if (rawType && !LENS_TYPES.has(rawType)) { addRowError(summary, t, '镜头', rowNumber, '类型', 'excel.reasonLensType'); continue; }
      if ('error' in price) { addRowError(summary, t, '镜头', rowNumber, '购入价格', price.error); continue; }
      if (!await findLensByNameForUser(name, userId)) {
        await db.lenses.add({ id: crypto.randomUUID(), userId, name, focalLength: focalLength.value ?? 50, maxAperture: asText(row['最大光圈 (例如 f/2)']) || 'f/2', type: rawType || 'prime', purchasePrice: price.value, addedAt: Date.now() });
        summary.lensesAdded++;
      }
    }

    for (const [index, row] of getRows(workbook, '胶卷库存').entries()) {
      const rowNumber = index + 2;
      const brand = asText(row['品牌 (必填)']);
      const name = asText(row['型号名称 (必填)']);
      const iso = asNonNegativeNumber(row['ISO (必填)'], true);
      const stockCount = asNonNegativeNumber(row['初始库存数量'], true);
      const price = asNonNegativeNumber(row['单卷均价 (选填)']);
      const rawType = asText(row['类型 (color/bw)']).toLowerCase();
      const rawFormat = asText(row['画幅 (135/120)']).toLowerCase();
      if (!brand) { addRowError(summary, t, '胶卷库存', rowNumber, '品牌', 'excel.reasonRequired'); continue; }
      if (!name) { addRowError(summary, t, '胶卷库存', rowNumber, '型号名称', 'excel.reasonRequired'); continue; }
      if ('error' in iso || iso.value === undefined || iso.value <= 0) { addRowError(summary, t, '胶卷库存', rowNumber, 'ISO', 'excel.reasonPositiveInteger'); continue; }
      if ('error' in stockCount) { addRowError(summary, t, '胶卷库存', rowNumber, '初始库存数量', stockCount.error); continue; }
      if ('error' in price) { addRowError(summary, t, '胶卷库存', rowNumber, '单卷均价', price.error); continue; }
      if (rawType && !FILM_TYPES.has(rawType)) { addRowError(summary, t, '胶卷库存', rowNumber, '类型', 'excel.reasonFilmType'); continue; }
      if (rawFormat && !FILM_FORMATS.has(rawFormat)) { addRowError(summary, t, '胶卷库存', rowNumber, '画幅', 'excel.reasonFilmFormat'); continue; }
      if (!await findFilmByBrandNameForUser(brand, name, userId)) {
        const id = crypto.randomUUID();
        await db.filmStocks.add({ id, userId, brand, name, iso: iso.value, colorType: rawType === 'bw' ? 'bw' : 'color', format: rawFormat || '135', stockCount: stockCount.value ?? 0, pricePerRoll: price.value, isSystem: 0, addedAt: Date.now() });
        summary.filmsAdded++;
        if ((price.value ?? 0) > 0 && (stockCount.value ?? 0) > 0) {
          await db.ledgerTransactions.add({ id: crypto.randomUUID(), userId, amount: -(price.value! * stockCount.value!), date: Date.now(), type: 'expense', category: 'film', relatedEntityId: id, notes: importText(t, 'excel.ledgerStockNote', 'Batch imported stock: {{film}} ({{count}} rolls)', { film: `${brand} ${name}`, count: stockCount.value! }), addedAt: Date.now() });
        }
      }
    }

    for (const [index, row] of getRows(workbook, '拍摄任务').entries()) {
      const rowNumber = index + 2;
      const name = asText(row['拍摄主题名称 (必填)']);
      const cameraName = asText(row['相机名称 (必填)']);
      const developmentCost = asNonNegativeNumber(row['冲洗花费 (选填)']);
      if (!name) { addRowError(summary, t, '拍摄任务', rowNumber, '拍摄主题名称', 'excel.reasonRequired'); continue; }
      if (!cameraName) { addRowError(summary, t, '拍摄任务', rowNumber, '相机名称', 'excel.reasonRequired'); continue; }
      if ('error' in developmentCost) { addRowError(summary, t, '拍摄任务', rowNumber, '冲洗花费', developmentCost.error); continue; }
      const camera = await findCameraByNameForUser(cameraName, userId);
      if (!camera?.id) { addRowError(summary, t, '拍摄任务', rowNumber, '相机名称', 'excel.reasonMissingCamera', { camera: cameraName }); continue; }

      let filmId: string | undefined;
      if (camera.type === 'film') {
        const brand = asText(row['胶卷品牌 (仅胶片)']);
        const filmName = asText(row['胶卷型号 (仅胶片)']);
        if (!brand || !filmName) { addRowError(summary, t, '拍摄任务', rowNumber, '胶卷', 'excel.reasonFilmRequired'); continue; }
        const film = await findFilmByBrandNameForUser(brand, filmName, userId);
        if (!film?.id) { addRowError(summary, t, '拍摄任务', rowNumber, '胶卷', 'excel.reasonMissingFilm', { film: `${brand} ${filmName}` }); continue; }
        filmId = film.id;
      }

      const id = crypto.randomUUID();
      await db.rolls.add({ id, userId, name, cameraIds: [camera.id], filmStockId: filmId || 'digital-placeholder', status: 'active', startDate: Date.now(), location: asText(row['拍摄地点 (选填)']) || undefined });
      summary.rollsAdded++;
      if (filmId) {
        const film = await db.filmStocks.get(filmId);
        if (film) await db.filmStocks.update(filmId, { stockCount: Math.max(0, (film.stockCount || 0) - 1) });
      }
      if ((developmentCost.value ?? 0) > 0) {
        await db.ledgerTransactions.add({ id: crypto.randomUUID(), userId, amount: -developmentCost.value!, date: Date.now(), type: 'expense', category: 'develop', relatedEntityId: id, notes: importText(t, 'excel.ledgerDevelopNote', 'Imported roll development cost: {{roll}}', { roll: name }), addedAt: Date.now() });
      }
    }
  });

  requestImmediateSync('excel-import');
  return summary;
};
