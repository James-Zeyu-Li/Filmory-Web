import React, { useRef, useState } from 'react';
import { Download, UploadCloud, X, AlertCircle } from 'lucide-react';
import { importExcelDataFromFile, downloadExcelTemplate } from '../services/importExcelData';
import { useAuth } from '../contexts/useAuth';
import { useFeedback } from '../contexts/useFeedback';
import { Modal } from './Modal';

interface ExcelImportModalProps {
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const excelInputRef = useRef<HTMLInputElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [showInstruction, setShowInstruction] = useState(false);

  const handleDownload = () => {
    downloadExcelTemplate();
    setShowInstruction(true);
  };

  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsProcessing(true);
    setProcessMessage('正在读取表格内容...');
    try {
      const summary = await importExcelDataFromFile(file, user.id);
      let msg = `相机: ${summary.camerasAdded}\n镜头: ${summary.lensesAdded}\n胶卷: ${summary.filmsAdded}\n任务: ${summary.rollsAdded}`;
      if (summary.errors.length > 0) {
        msg += `\n\n发现 ${summary.errors.length} 个问题:\n` + summary.errors.slice(0, 5).join('\n');
        if (summary.errors.length > 5) msg += '\n...及更多。';
      }
      notify({
        type: summary.errors.length > 0 ? 'info' : 'success',
        title: '表格导入完成',
        message: msg,
        durationMs: 6000
      });
      onClose();
    } catch (err) {
      notify({
        type: 'error',
        title: '表格导入失败',
        message: err instanceof Error ? err.message : '文件解析失败，请检查 Excel 模板格式。',
        durationMs: 6000
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} overlayStyle={{ zIndex: 10000 }} style={{ maxWidth: '500px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3>批量导入器材与拍摄记录</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {showInstruction && (
          <div style={{ backgroundColor: 'rgba(var(--accent-rgb, 100, 100, 255), 0.1)', border: '1px solid var(--accent)', padding: '16px', borderRadius: '8px', marginBottom: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>模板已下载，请留意：</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  这份表格包含多个工作表，分别对应：<strong>相机机身、镜头、胶卷库存、拍摄任务（胶卷记录）</strong>。请在对应页面填写后保存，再回来导入。
                </p>
              </div>
            </div>
            <button 
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              onClick={() => setShowInstruction(false)}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Step 1 */}
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)' }}>
              <Download size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px 0' }}>第一步：下载导入模板</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>先下载表格模板，把现有器材和胶卷记录整理进去。</p>
              <button className="secondary btn-sm" onClick={handleDownload} disabled={isProcessing}>
                下载模板
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--accent)', padding: '12px', borderRadius: '8px', color: '#fff' }}>
              <UploadCloud size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px 0' }}>第二步：导入已填写的表格</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>上传后会尽量匹配已有器材，减少重复记录。</p>
              <button className="primary btn-sm" onClick={() => excelInputRef.current?.click()} disabled={isProcessing}>
                {isProcessing ? processMessage || '处理中...' : '选择表格并导入'}
              </button>
              <input 
                type="file" 
                ref={excelInputRef} 
                accept=".xlsx, .xls" 
                style={{ display: 'none' }} 
                onChange={handleExcelFileUpload}
              />
            </div>
          </div>
        </div>
    </Modal>
  );
};
