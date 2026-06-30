import { db } from '../db/schema';
import * as XLSX from 'xlsx';

export interface ImportExcelSummary {
  camerasAdded: number;
  lensesAdded: number;
  filmsAdded: number;
  rollsAdded: number;
  errors: string[];
}

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
  // 1. Define Example Entries
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

  // 2. Create Worksheets
  const wsCameras = XLSX.utils.json_to_sheet(camerasData);
  const wsLenses = XLSX.utils.json_to_sheet(lensesData);
  const wsFilms = XLSX.utils.json_to_sheet(filmsData);
  const wsRolls = XLSX.utils.json_to_sheet(rollsData);

  // Set column widths for better readability
  const colWidths = [{ wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  wsCameras['!cols'] = colWidths;
  wsLenses['!cols'] = colWidths;
  wsFilms['!cols'] = colWidths;
  wsRolls['!cols'] = colWidths;

  // 3. Build Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsCameras, '相机机身');
  XLSX.utils.book_append_sheet(wb, wsLenses, '镜头');
  XLSX.utils.book_append_sheet(wb, wsFilms, '胶卷库存');
  XLSX.utils.book_append_sheet(wb, wsRolls, '拍摄任务');

  // 4. Trigger Download
  XLSX.writeFile(wb, 'Filmory_Import_Template.xlsx');
};

export const importExcelDataFromFile = async (file: File, userId: string): Promise<ImportExcelSummary> => {
  if (!userId) {
    throw new Error('Excel 导入需要有效用户身份，已阻止跨账号导入。');
  }

  return new Promise<ImportExcelSummary>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        const summary: ImportExcelSummary = {
          camerasAdded: 0,
          lensesAdded: 0,
          filmsAdded: 0,
          rollsAdded: 0,
          errors: [] as string[]
        };

        await db.transaction('rw', [db.cameras, db.lenses, db.filmStocks, db.rolls, db.ledgerTransactions], async () => {
          
          // --- 1. Parse Cameras ---
          const wsCameras = wb.Sheets['相机机身'];
          if (wsCameras) {
            const cameras = XLSX.utils.sheet_to_json<any>(wsCameras);
            for (const [, row] of cameras.entries()) {
              const name = String(row['相机名称 (必填)'] || '').trim();
              if (!name) continue;

              const exists = await findCameraByNameForUser(name, userId);
              if (!exists) {
                await db.cameras.add({
                  id: crypto.randomUUID(),
                  userId,
                  name,
                  type: (row['类型 (film/digital)'] === 'digital' ? 'digital' : 'film') as any,
                  format: String(row['画幅 (135/120/digital)'] || '135'),
                  purchasePrice: Number(row['购入价格 (选填)']) || undefined,
                  addedAt: Date.now()
                });
                summary.camerasAdded++;
              }
            }
          }

          // --- 2. Parse Lenses ---
          const wsLenses = wb.Sheets['镜头'];
          if (wsLenses) {
            const lenses = XLSX.utils.sheet_to_json<any>(wsLenses);
            for (const [, row] of lenses.entries()) {
              const name = String(row['镜头名称 (必填)'] || '').trim();
              if (!name) continue;

              const exists = await findLensByNameForUser(name, userId);
              if (!exists) {
                await db.lenses.add({
                  id: crypto.randomUUID(),
                  userId,
                  name,
                  focalLength: Number(row['焦段mm']) || 50,
                  maxAperture: String(row['最大光圈 (例如 f/2)'] || 'f/2'),
                  type: (row['类型 (prime/zoom)'] === 'zoom' ? 'zoom' : 'prime') as any,
                  purchasePrice: Number(row['购入价格 (选填)']) || undefined,
                  addedAt: Date.now()
                });
                summary.lensesAdded++;
              }
            }
          }

          // --- 3. Parse Films ---
          const wsFilms = wb.Sheets['胶卷库存'];
          if (wsFilms) {
            const films = XLSX.utils.sheet_to_json<any>(wsFilms);
            for (const [, row] of films.entries()) {
              const brand = String(row['品牌 (必填)'] || '').trim();
              const name = String(row['型号名称 (必填)'] || '').trim();
              if (!brand || !name) continue;

              const exists = await findFilmByBrandNameForUser(brand, name, userId);
              if (!exists) {
                const id = crypto.randomUUID();
                const stockCount = Number(row['初始库存数量']) || 0;
                const price = Number(row['单卷均价 (选填)']) || 0;
                
                await db.filmStocks.add({
                  id,
                  userId,
                  brand,
                  name,
                  iso: Number(row['ISO (必填)']) || 400,
                  colorType: (row['类型 (color/bw)'] === 'bw' ? 'bw' : 'color') as any,
                  format: String(row['画幅 (135/120)'] || '135'),
                  stockCount: stockCount,
                  pricePerRoll: price > 0 ? price : undefined,
                  isSystem: 0,
                  addedAt: Date.now()
                });
                summary.filmsAdded++;

                // Add ledger if bought
                if (price > 0 && stockCount > 0) {
                  await db.ledgerTransactions.add({
                    id: crypto.randomUUID(),
                    userId,
                    amount: -(price * stockCount),
                    date: Date.now(),
                    type: 'expense',
                    category: 'film',
                    relatedEntityId: id,
                    notes: `批量导入库存: ${brand} ${name} (${stockCount}卷)`,
                    addedAt: Date.now()
                  });
                }
              }
            }
          }

          // --- 4. Parse Rolls (Relational Linkage) ---
          const wsRolls = wb.Sheets['拍摄任务'];
          if (wsRolls) {
            const rolls = XLSX.utils.sheet_to_json<any>(wsRolls);
            for (const [, row] of rolls.entries()) {
              const name = String(row['拍摄主题名称 (必填)'] || '').trim();
              const cameraName = String(row['相机名称 (必填)'] || '').trim();
              if (!name || !cameraName) continue;

              // Link Camera
              let camera = await findCameraByNameForUser(cameraName, userId);
              if (!camera) {
                // Auto-create missing camera
                const newCamId = crypto.randomUUID();
                await db.cameras.add({
                  id: newCamId,
                  userId,
                  name: cameraName,
                  type: 'film', // Assume film by default
                  format: '135',
                  addedAt: Date.now()
                });
                camera = await db.cameras.get(newCamId);
                summary.camerasAdded++;
                summary.errors.push(`ℹ️ 自动补全: 在解析任务 "${name}" 时为您创建了缺失的相机 "${cameraName}"。`);
              }

              // Link Film (Optional for digital)
              let filmId: string | undefined = undefined;
                            if (camera!.type === 'film') {
                const fBrand = String(row['胶卷品牌 (仅胶片)'] || '').trim();
                const fName = String(row['胶卷型号 (仅胶片)'] || '').trim();
                if (fBrand || fName) {
                  const film = await findFilmByBrandNameForUser(fBrand, fName, userId);
                  if (film) {
                    filmId = film.id;
                                      } else {
                    // Auto-create missing film
                    const newFilmId = crypto.randomUUID();
                    await db.filmStocks.add({
                      id: newFilmId,
                      userId,
                      brand: fBrand || '未知品牌',
                      name: fName || '未知型号',
                      iso: 400,
                      colorType: 'color',
                      format: '135',
                      stockCount: 0, // No stock initially
                      isSystem: 0,
                      addedAt: Date.now()
                    });
                    filmId = newFilmId;
                    summary.filmsAdded++;
                    summary.errors.push(`ℹ️ 自动补全: 在解析任务 "${name}" 时为您创建了缺失的胶卷 "${fBrand} ${fName}"。`);
                  }
                }
              }

              const id = crypto.randomUUID();
              const devCost = Number(row['冲洗花费 (选填)']) || 0;

              await db.rolls.add({
                id,
                userId,
                name,
                cameraIds: camera?.id ? [camera.id] : [],
                filmStockId: filmId || 'digital-placeholder',
                status: 'active', // Assume newly imported rolls are active
                startDate: Date.now(),
                location: String(row['拍摄地点 (选填)'] || '').trim()
              });
              summary.rollsAdded++;

              // Deduct film stock count if film found
              if (filmId) {
                const film = await db.filmStocks.get(filmId);
                if (film) {
                  await db.filmStocks.update(filmId, { stockCount: Math.max(0, (film.stockCount || 0) - 1) });
                }
              }

              // Record ledger for development if specified
              if (devCost > 0) {
                await db.ledgerTransactions.add({
                  id: crypto.randomUUID(),
                  userId,
                  amount: -devCost,
                  date: Date.now(),
                  type: 'expense',
                  category: 'develop',
                  relatedEntityId: id,
                  notes: `导入任务冲洗花费: ${name}`,
                  addedAt: Date.now()
                });
              }
            }
          }
        });

        resolve(summary);

      } catch (err: any) {
        reject(new Error("Excel 解析失败: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsArrayBuffer(file);
  });
};
