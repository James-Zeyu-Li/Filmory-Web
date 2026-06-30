import React, { useState } from 'react';
import { BackupService } from '../../services/backupService';
import { Shield, Download, X, LogOut, UserX, Sun, Moon, Monitor, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useTheme } from '../../contexts/useTheme';
import { supabase } from '../../services/supabaseClient';
import { Modal } from '../../components/Modal';
import { db } from '../../db/schema';
import { seedDatabaseIfNeeded } from '../../services/seedService';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import './SettingsView.css';

interface SettingsViewProps {
  enableFilmMode: boolean;
  setEnableFilmMode: (enabled: boolean) => void;
  onClose: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ enableFilmMode, setEnableFilmMode, onClose }) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleLogout = async () => {
    try {
      await logout();
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationStep === 0) {
      setDeleteConfirmationStep(1);
      setDeleteError('');
      return;
    }
    
    if (deleteConfirmationStep === 1) {
      if (deleteInput !== 'DELETE') {
        setDeleteError('请输入大写的 DELETE 以确认删除。');
        return;
      }
      
      const finalConfirm = await confirm({
        title: '最终确认注销账号',
        message: '最后一次警告：您的所有云端数据、相册、流水将永久消失，且无法恢复。\n\n确认继续销毁账号吗？',
        confirmText: '永久销毁账号',
        cancelText: '取消',
        isDanger: true
      });
      if (!finalConfirm) {
        setDeleteConfirmationStep(0);
        setDeleteInput('');
        setDeleteError('');
        return;
      }
      
      try {
        setIsProcessing(true);
        setProcessMessage('正在彻底销毁您的账号数据...');
        
        // If not using mock user, attempt to call RPC delete
        if (user?.id !== 'mock_uid_123') {
          const { error } = await supabase.rpc('delete_user');
          if (error) throw error;
        }
        
        await logout();
        window.location.reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        notify({
          type: 'error',
          title: '账号注销失败',
          message
        });
        setIsProcessing(false);
        setProcessMessage('');
      }
    }
  };

  const handleExport = async () => {
    try {
      setIsProcessing(true);
      setProcessMessage('正在打包您的照片和数据，请勿关闭页面...');
      await BackupService.exportDatabaseToExcel(user?.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      notify({
        type: 'error',
        title: '导出失败',
        message
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: '重置数据库',
      message: '警告！此操作将清空本地 IndexedDB 数据库并重新载入默认数据。你上传的自定义照片将全部丢失。\n\n确定要重置吗？',
      confirmText: '确认重置',
      isDanger: true
    });
    if (confirmed) {
      try {
        await db.delete();
        await db.open();
        await seedDatabaseIfNeeded();
        notify({
          type: 'success',
          title: '数据库已重置',
          message: '即将刷新页面并载入默认数据。',
          durationMs: 1200
        });
        window.setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        console.error('Failed to reset database', error);
        const message = error instanceof Error ? error.message : '请手动刷新页面后重试。';
        notify({
          type: 'error',
          title: '重置失败',
          message
        });
      }
    }
  };

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      style={{ maxWidth: '600px', width: '90%', padding: 0, overflow: 'hidden' }}
      overlayStyle={{ zIndex: 9999 }}
    >
      <header className="view-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
        <div className="header-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={24} />
          <h2 style={{ margin: 0 }}>设置与数据保护</h2>
        </div>
        <button className="icon-btn" onClick={onClose} style={{ marginLeft: 'auto' }}><X size={20} /></button>
      </header>

      <div className="view-body settings-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
        {/* UI Preferences Card */}
        <div className="settings-section">
          <div className="section-header">
            <h3>界面偏好设定</h3>
            <p>定制您的工作区外观与核心业务模式。</p>
          </div>
          <div className="settings-cards">
            {/* Theme Toggle */}
            <div className="settings-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
              <div className="card-content">
                <h4>色彩主题 (Color Theme)</h4>
                <p>选择您喜欢的工作区主题外观，或使其跟随系统偏好自动切换。</p>
              </div>
              <div className="theme-toggle-group" style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
                <button 
                  className={`theme-btn ${theme === 'light' ? 'active' : ''}`} 
                  onClick={() => setTheme('light')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: theme === 'light' ? 'var(--bg-secondary)' : 'transparent', color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none', transition: 'var(--transition-fast)' }}
                >
                  <Sun size={16} /> 浅色
                </button>
                <button 
                  className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} 
                  onClick={() => setTheme('dark')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: theme === 'dark' ? 'var(--bg-secondary)' : 'transparent', color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none', transition: 'var(--transition-fast)' }}
                >
                  <Moon size={16} /> 深色
                </button>
                <button 
                  className={`theme-btn ${theme === 'system' ? 'active' : ''}`} 
                  onClick={() => setTheme('system')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: theme === 'system' ? 'var(--bg-secondary)' : 'transparent', color: theme === 'system' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', boxShadow: theme === 'system' ? 'var(--shadow-sm)' : 'none', transition: 'var(--transition-fast)' }}
                >
                  <Monitor size={16} /> 跟随系统
                </button>
              </div>
            </div>

            <div className="settings-card" style={{ alignItems: 'center' }}>
              <div className="card-content">
                <h4>专业胶片模式 (Film Mode)</h4>
                <p>开启后将启用胶卷库存、冲洗配方等纯粹的胶片摄影模块。关闭则退化为普通的数码照片管理器。</p>
              </div>
              <div className="toggle-switch">
                <input 
                  type="checkbox" 
                  id="filmModeToggle" 
                  checked={enableFilmMode}
                  onChange={(e) => setEnableFilmMode(e.target.checked)}
                />
                <label htmlFor="filmModeToggle"></label>
              </div>
            </div>
          </div>
        </div>

        {/* Data Export Card */}
        <div className="settings-section">
          <div className="section-header">
            <h3>数据主权与导出 (Data Export)</h3>
            <p>您的所有照片和记录已安全加密同步至云端。为了保障您的数据主权，您可以随时以标准格式导出您的所有胶卷、器材与流水账单记录。</p>
          </div>

          <div className="settings-cards">
            {/* Export Card */}
            <div className="settings-card">
              <div className="card-icon safe">
                <Download size={28} />
              </div>
              <div className="card-content">
                <h4>导出元数据 (Excel)</h4>
                <p>将您的相机、镜头、胶卷库存、拍摄任务与其他附件记录导出为标准 Excel 文件。不会打包原图（避免文件过大），适合记录归档与表格整理。</p>
                <button 
                  className="primary" 
                  onClick={handleExport}
                  disabled={isProcessing}
                >
                  {isProcessing ? '正在生成...' : '立即导出记录'}
                </button>
              </div>
            </div>

            {/* Reset DB Card */}
            <div className="settings-card">
              <div className="card-icon warning">
                <RefreshCw size={28} />
              </div>
              <div className="card-content">
                <h4>重置本地数据库</h4>
                <p>清空本地所有自定义器材、胶卷及导入的图像文件，重新生成系统示例卡片与胶卷数据。</p>
                <button 
                  className="danger" 
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  重置数据库
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Management Card */}
        <div className="settings-section">
          <div className="section-header">
            <h3>账号与安全 (Account Management)</h3>
            <p>管理您的登录状态或永久删除您的账号及所有云端数据。</p>
          </div>
          
          <div className="settings-cards">
            {/* Logout Card */}
            <div className="settings-card">
              <div className="card-icon" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white' }}>
                <LogOut size={28} />
              </div>
              <div className="card-content">
                <h4>安全退出 (Logout)</h4>
                <p>退出当前设备的登录状态，但这不会删除您本地 IndexedDB 的离线数据。</p>
                <button className="secondary" onClick={handleLogout} style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                  退出登录
                </button>
              </div>
            </div>

            {/* Delete Account Card */}
            <div className="settings-card danger-zone">
              <div className="card-icon danger">
                <UserX size={28} />
              </div>
              <div className="card-content">
                <h4>永久注销账号 (Delete Account)</h4>
                {deleteConfirmationStep === 0 ? (
                  <>
                    <p style={{ color: 'var(--danger)' }}>
                      ⚠️ 危险：彻底销毁您在 Filmory 的账号。云端数据将被永久删除且无法恢复。
                    </p>
                    <button className="danger" onClick={handleDeleteAccount}>
                      注销我的账号
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                      如果确认注销，请在下方输入大写的 DELETE
                    </p>
                    {deleteError && (
                      <p style={{ color: 'var(--danger)', margin: 0, fontSize: '13px' }}>
                        {deleteError}
                      </p>
                    )}
                    <input 
                      type="text" 
                      placeholder="DELETE"
                      value={deleteInput}
                      onChange={(e) => {
                        setDeleteInput(e.target.value);
                        if (deleteError) setDeleteError('');
                      }}
                      style={{ 
                        padding: '10px', 
                        background: 'rgba(0,0,0,0.3)', 
                        border: '1px solid var(--danger)',
                        color: 'white',
                        borderRadius: '6px'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="danger" onClick={handleDeleteAccount}>
                        确认永久销毁
                      </button>
                      <button className="secondary" onClick={() => {
                        setDeleteConfirmationStep(0);
                        setDeleteInput('');
                        setDeleteError('');
                      }}>
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="processing-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '16px', color: 'white' }}>{processMessage}</p>
        </div>
      )}
    </Modal>
  );
};
