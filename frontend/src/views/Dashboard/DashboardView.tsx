import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  Camera, Image, Columns, LayoutDashboard, Wallet,
  Play, BarChart2, Calendar, ArrowRight, Film, Package, UploadCloud
} from 'lucide-react';
import { ExcelImportModal } from '../../components/ExcelImportModal';
import './DashboardView.css';
import { useRolls, useCameras, useFilmStocks, usePhotoAssets } from '../../hooks/useData';

interface DashboardViewProps {
  enableFilmMode: boolean;
  onNavigate: (tab: string) => void;
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' as const }
  })
};

export const DashboardView: React.FC<DashboardViewProps> = ({ enableFilmMode, onNavigate }) => {
  const [showExcelModal, setShowExcelModal] = useState(false);
  const rolls = useRolls();
  const cameras = useCameras();
  const filmStocks = useFilmStocks();
  const photoAssets = usePhotoAssets();

  const activeRolls = rolls.filter(r => r.status === 'active');
  const totalPhotos = photoAssets.length;
  const totalRolls = rolls.length;

  // Cost calculations for quick KPI
  const totalFilmCost = rolls.reduce((acc, r) => acc + (r.filmPrice || 0), 0);
  const totalDevelopCost = rolls.reduce((acc, r) => acc + (r.developPrice || 0), 0);
  const totalCost = totalFilmCost + totalDevelopCost;

  // Film Stock Inventory
  const totalFilmStock = filmStocks
    .filter(f => f.isSystem === 0)
    .reduce((acc, f) => acc + (f.stockCount || 0), 0);

  const getCameraName = (id?: string) => {
    return cameras.find(c => c.id === id)?.name || '未知相机';
  };

  const getFilmName = (id?: string) => {
    const film = filmStocks.find(f => f.id === id);
    if (!film) return '未知胶卷';
    return film.isSystem === 1 ? '数码' : `${film.brand} ${film.name}`;
  };

  return (
    <div className="main-content">
      {/* Unified Header */}
      <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon">
            <LayoutDashboard size={20} />
          </div>
          <div className="view-header-text-group">
            <h1>控制中心 (Dashboard)</h1>
            <p className="view-header-subtitle">概览您的摄影资产与核心动态。</p>
          </div>
        </div>
      </header>

      <div className="view-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Row 1: Key Metrics (资产与库存快报) */}
        <div className="dash-section">
          <h3>资产与库存快报 (Metrics)</h3>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon"><Image size={18} /></div>
              <div className="metric-data">
                <span>总片数</span>
                <strong>{totalPhotos} 张</strong>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon"><Film size={18} /></div>
              <div className="metric-data">
                <span>累计拍摄</span>
                <strong>{totalRolls} 卷</strong>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon"><Wallet size={18} /></div>
              <div className="metric-data">
                <span>总花费</span>
                <strong>¥{totalCost.toFixed(0)}</strong>
              </div>
            </div>
            {enableFilmMode && (
              <div className="metric-card" style={{ borderLeft: '2px solid var(--accent)' }}>
                <div className="metric-icon" style={{ color: 'var(--accent)' }}><Package size={18} /></div>
                <div className="metric-data">
                  <span>剩余库存胶片</span>
                  <strong>{totalFilmStock} 卷</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Launchpad (快捷入口) */}
        <div className="dash-section">
          <h3>快捷入口 (Launchpad)</h3>
          <div className="launchpad-row">
            <motion.button 
              className="launchpad-pill portal-blue" 
              custom={0} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('rolls')}
            >
              <Film size={16} /> <span>拍摄卷</span>
            </motion.button>
            <motion.button 
              className="launchpad-pill portal-gold" 
              custom={1} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('gear')}
            >
              <Camera size={16} /> <span>器材库</span>
            </motion.button>
            <motion.button 
              className="launchpad-pill portal-emerald" 
              custom={2} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('insights')}
            >
              <BarChart2 size={16} /> <span>数据与财务</span>
            </motion.button>
            <motion.button 
              className="launchpad-pill portal-purple" 
              custom={3} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('compare')}
            >
              <Columns size={16} /> <span>对比台</span>
            </motion.button>
            <motion.button 
              className="launchpad-pill portal-orange" 
              custom={4} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => setShowExcelModal(true)}
              style={{ backgroundColor: 'rgba(255, 100, 0, 0.1)', color: '#ff7000', border: '1px solid rgba(255, 100, 0, 0.2)' }}
            >
              <UploadCloud size={16} /> <span>批量导入</span>
            </motion.button>
          </div>
        </div>

        {/* Row 3: Ongoing Rolls */}
        <div className="dash-section">
          <h3>进行中的拍摄卷 ({activeRolls.length})</h3>
          <div className="active-rolls-list">
            {activeRolls.length === 0 ? (
              <div className="active-rolls-empty">
                <Play size={24} style={{ color: 'var(--text-muted)' }} />
                <p>当前没有装载胶卷。点击上方“开始拍摄”装入新卷吧！</p>
              </div>
            ) : (
              activeRolls.map((roll, i) => (
                <motion.div 
                  key={roll.id} 
                  className="active-roll-dash-card"
                  custom={i} initial="hidden" animate="visible" variants={cardVariants}
                >
                  <div className="roll-card-left">
                    <div className="roll-camera-badge">
                      <Camera size={16} />
                    </div>
                    <div className="roll-meta-info">
                      <h4>{roll.name}</h4>
                      <span>{(roll.cameraIds || []).map(getCameraName).join(', ')} {enableFilmMode && roll.filmStockId !== 'digital-placeholder' && ` · ${getFilmName(roll.filmStockId)}`}</span>
                    </div>
                  </div>
                  <div className="roll-card-right">
                    {roll.startDate && (
                      <span className="roll-date-display">
                        <Calendar size={12} />
                        {new Date(roll.startDate).toLocaleDateString()}
                      </span>
                    )}
                    <button className="primary btn-sm" onClick={() => onNavigate('rolls')}>
                      记录参数 <ArrowRight size={12} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

      </div>
      {showExcelModal && <ExcelImportModal onClose={() => setShowExcelModal(false)} />}
    </div>
  );
};
