import { saveAs } from 'file-saver';
import { db } from '../db/schema';
import * as XLSX from 'xlsx';

/**
 * 核心备份与灾难恢复引擎
 * 将当前用户的核心记录导出为 Excel，避免原图 Blob 撑爆内存。
 */
export const BackupService = {
  /**
   * 将当前数据库元数据导出为 Excel 文件，丢弃原图 Blob 防止撑爆内存。
   */
  exportDatabaseToExcel: async (userId?: string): Promise<void> => {
    if (!userId) {
      throw new Error('导出需要有效用户身份，已阻止全库导出。');
    }

    const cameras = await db.cameras.where('userId').equals(userId).toArray();
    const lenses = await db.lenses.where('userId').equals(userId).toArray();
    const filmStocks = await db.filmStocks.where('userId').equals(userId).toArray();
    const rolls = await db.rolls.where('userId').equals(userId).toArray();
    const otherEquipments = await db.otherEquipments.where('userId').equals(userId).toArray();

    // Mapping arrays to Excel Worksheets
    const wb = XLSX.utils.book_new();

    const ws_cameras = XLSX.utils.json_to_sheet(cameras.map(c => ({ 
      '名称': c.name, 
      '类型': c.type === 'film' ? '胶片' : '数码', 
      '画幅': c.format, 
      '购入价格': c.purchasePrice || '', 
      '状态': c.status === 'active' ? '正常' : '已归档',
      '备注': c.notes || ''
    })));
    XLSX.utils.book_append_sheet(wb, ws_cameras, "相机机身");

    const ws_lenses = XLSX.utils.json_to_sheet(lenses.map(l => ({ 
      '名称': l.name, 
      '焦段(mm)': l.focalLength, 
      '最大光圈': l.maxAperture, 
      '类型': l.type === 'prime' ? '定焦' : '变焦',
      '购入价格': l.purchasePrice || '', 
      '状态': l.status === 'active' ? '正常' : '已归档'
    })));
    XLSX.utils.book_append_sheet(wb, ws_lenses, "镜头");

    const ws_films = XLSX.utils.json_to_sheet(filmStocks.map(f => ({ 
      '品牌': f.brand, 
      '型号': f.name, 
      'ISO': f.iso, 
      '类型': f.colorType === 'color' ? '彩色' : '黑白', 
      '单卷价格': f.pricePerRoll || '', 
      '库存数量': f.stockCount || 0 
    })));
    XLSX.utils.book_append_sheet(wb, ws_films, "胶卷库存");

    const ws_rolls = XLSX.utils.json_to_sheet(rolls.map(r => {
      const film = filmStocks.find(f => f.id === r.filmStockId);
      const participatingCameras = (r.cameraIds || []).map(id => cameras.find(c => c.id === id)?.name || id).join(', ');
      
      let startDateStr = '';
      let endDateStr = '';
      try { if (r.startDate) startDateStr = new Date(r.startDate).toLocaleDateString(); } catch { startDateStr = ''; }
      try { if (r.endDate) endDateStr = new Date(r.endDate).toLocaleDateString(); } catch { endDateStr = ''; }
      
      return { 
        '拍摄卷名称': r.name, 
        '胶卷型号': film ? `${film.brand} ${film.name}` : r.filmStockId, 
        '参与机身': participatingCameras,
        '状态': r.status === 'active' ? '拍摄中' : '已归档',
        '开始日期': startDateStr,
        '结束日期': endDateStr,
        '评级': r.rating || '',
        '地点': r.location || '',
        '胶卷成本': r.filmPrice || '',
        '冲洗成本': r.developPrice || '',
        '备注': r.notes || ''
      };
    }));
    XLSX.utils.book_append_sheet(wb, ws_rolls, "拍摄任务");

    const ws_others = XLSX.utils.json_to_sheet(otherEquipments.map(e => {
      let purchaseDateStr = '';
      let expiryDateStr = '';
      try { if (e.purchaseDate) purchaseDateStr = new Date(e.purchaseDate).toLocaleDateString(); } catch { purchaseDateStr = ''; }
      try { if (e.expiryDate) expiryDateStr = new Date(e.expiryDate).toLocaleDateString(); } catch { expiryDateStr = ''; }
      return { 
        '名称': e.name, 
        '分类': e.type, 
        '购入价格': e.purchasePrice || '', 
        '购入日期': purchaseDateStr,
        '过期日期': expiryDateStr,
        '备注': e.notes || ''
      };
    }));
    XLSX.utils.book_append_sheet(wb, ws_others, "其他附件");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    saveAs(data, `Grainfolio_Data_Export_${dateStr}.xlsx`);
  }
};
