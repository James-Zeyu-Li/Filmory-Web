import React from 'react';
import { db } from '../../db/schema';
import { seedDatabaseIfNeeded } from '../../services/seedService';
import { RefreshCw } from 'lucide-react';
import './SettingsView.css';

interface SettingsViewProps {
  enableFilmMode: boolean;
  setEnableFilmMode: (enabled: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ enableFilmMode, setEnableFilmMode }) => {
  const handleReset = async () => {
    if (confirm('警告！此操作将清空本地 IndexedDB 数据库并重新载入默认数据。你上传的自定义照片将全部丢失。确定要重置吗？')) {
      try {
        await db.delete();
        await db.open();
        await seedDatabaseIfNeeded();
        alert('数据库已成功重置为默认数据！');
        window.location.reload();
      } catch (error) {
        console.error('Failed to reset database', error);
        alert('重置失败，请手动刷新页面试一下。');
      }
    }
  };

  return (
    <div className="main-content">
      <header className="view-header">
        <h1>设置</h1>
        <div className="view-header-actions" />
      </header>

      <div className="view-body">
        <div className="settings-container">
          <div className="settings-section">
            <h3>偏好设置</h3>
            <div className="setting-row">
              <div className="setting-info">
                <strong>启用胶片相机模式</strong>
                <p>关闭后将隐藏胶卷管理，并在新建拍摄时屏蔽胶卷选择。适合以数码相机为主的用户。</p>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={enableFilmMode}
                  onChange={e => setEnableFilmMode(e.target.checked)}
                />
                <span className="slider-round" />
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>数据维护</h3>
            <div className="setting-row">
              <div className="setting-info">
                <strong>重置本地数据库</strong>
                <p>清空本地所有自定义器材、胶卷及导入的图像文件，重新生成系统示例卡片与胶卷数据。</p>
              </div>
              <button className="danger" onClick={handleReset}>
                <RefreshCw size={16} />
                <span>重置数据库</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
