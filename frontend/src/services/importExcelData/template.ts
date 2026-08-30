import * as XLSX from 'xlsx';

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
