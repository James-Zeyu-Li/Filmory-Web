import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  Camera, Columns, LayoutDashboard,
  Play, BarChart2, Calendar, ArrowRight, Film, Package, UploadCloud, Aperture, Layers
} from 'lucide-react';
import { ExcelImportModal } from '../../components/ExcelImportModal';
import './DashboardView.css';
import { useRolls, useCameras, useFilmStocks, useFilmBacks, useLenses } from '../../hooks/useData';
import { useAuth } from '../../contexts/useAuth';
import { useTrialGate } from '../../contexts/useTrialGate';

interface DashboardViewProps {
  enableFilmMode: boolean;
  onNavigate: (tab: string, options?: { skipPageTransition?: boolean }) => void;
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
  const { authMode } = useAuth();
  const { requireRegistration } = useTrialGate();
  const rolls = useRolls();
  const cameras = useCameras();
  const filmBacks = useFilmBacks();
  const lenses = useLenses();
  const filmStocks = useFilmStocks();

  const activeRolls = rolls
    .filter(r => r.status === 'active')
    .sort((a, b) => (b.startDate || 0) - (a.startDate || 0));
  const activeRollsPreview = activeRolls.slice(0, 5);

  const usableFilmStocks = filmStocks
    .filter(f => f.isSystem === 0);
  const totalFilmStock = usableFilmStocks
    .reduce((acc, f) => acc + (f.stockCount || 0), 0);
  const filmStockByFormat = usableFilmStocks.reduce<Record<string, number>>((acc, film) => {
    const format = film.format || '未标注';
    acc[format] = (acc[format] || 0) + (film.stockCount || 0);
    return acc;
  }, {});
  const colorFilmStock = usableFilmStocks
    .filter(f => f.colorType === 'color')
    .reduce((acc, f) => acc + (f.stockCount || 0), 0);
  const bwFilmStock = usableFilmStocks
    .filter(f => f.colorType === 'bw')
    .reduce((acc, f) => acc + (f.stockCount || 0), 0);

  const activeCameraIds = Array.from(new Set(
    activeRolls.flatMap(r => r.cameraIds || []).filter((id): id is string => Boolean(id))
  ));
  const activeCameraSummaries = activeCameraIds.map(id => {
    const camera = cameras.find(c => c.id === id);
    const loadedRolls = activeRolls.filter(r => (r.cameraIds || []).includes(id));
    return {
      id,
      name: camera?.name || '未知相机',
      rolls: loadedRolls,
    };
  });
  const activeFilmBackIds = Array.from(new Set(
    activeRolls.map(r => r.filmBackId).filter((id): id is string => Boolean(id))
  ));
  const activeLensIds = Array.from(new Set(
    activeRolls.flatMap(r => r.lensIds || []).filter((id): id is string => Boolean(id))
  ));

  const getCameraName = (id?: string) => {
    return cameras.find(c => c.id === id)?.name || '未知相机';
  };

  const getFilmName = (id?: string) => {
    const film = filmStocks.find(f => f.id === id);
    if (!film) return '未知胶卷';
    return film.isSystem === 1 ? '数码' : `${film.brand} ${film.name}`;
  };

  const getFilmBackName = (id?: string) => {
    return filmBacks.find(back => back.id === id)?.name || '未选择后背';
  };

  const getLensName = (id?: string) => {
    return lenses.find(lens => lens.id === id)?.name || '未知镜头';
  };

  const getLoadedSetupLabel = (roll: typeof activeRolls[number]) => {
    const cameraLabel = (roll.cameraIds || []).map(getCameraName).join(' / ') || '未绑定相机';
    const backLabel = roll.filmBackId ? getFilmBackName(roll.filmBackId) : '';
    const filmLabel = enableFilmMode && roll.filmStockId !== 'digital-placeholder'
      ? getFilmName(roll.filmStockId)
      : '';

    return [cameraLabel, backLabel, filmLabel].filter(Boolean).join(' + ');
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
            <h1>控制中心</h1>
            <p className="view-header-subtitle">查看正在拍摄的胶卷、库存状态和手上正在使用的器材。</p>
          </div>
        </div>
      </header>

      <div className="view-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Row 1: Key Metrics */}
        <div className="dash-section">
          <h3>今日状态</h3>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon active"><Play size={18} /></div>
              <div className="metric-data">
                <span>进行中</span>
                <strong>{activeRolls.length} 卷</strong>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon stock"><Package size={18} /></div>
              <div className="metric-data">
                <span>库存胶卷</span>
                <strong>{totalFilmStock} 卷</strong>
                <div className="metric-breakdown" aria-label="库存胶卷分组">
                  <span>135 {filmStockByFormat['135'] || 0}</span>
                  <span>120 {filmStockByFormat['120'] || 0}</span>
                  <span>彩色 {colorFilmStock}</span>
                  <span>黑白 {bwFilmStock}</span>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon camera"><Camera size={18} /></div>
              <div className="metric-data">
                <span>使用中机器</span>
                <strong>{activeCameraSummaries.length} 台</strong>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon lens"><Aperture size={18} /></div>
              <div className="metric-data">
                <span>使用中镜头</span>
                <strong>{activeLensIds.length} 支</strong>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon back"><Package size={18} /></div>
              <div className="metric-data">
                <span>装片后背</span>
                <strong>{activeFilmBackIds.length} 个</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Launchpad (快捷入口) */}
        <div className="dash-section">
          <h3>快捷入口</h3>
          <div className="launchpad-row">
            <motion.button
              className="launchpad-pill portal-blue"
              custom={0} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('rolls?newRoll=1', { skipPageTransition: true })}
            >
              <Film size={16} /> <span>新建胶卷记录</span>
            </motion.button>
            {enableFilmMode && (
              <motion.button
                className="launchpad-pill portal-orange"
                custom={1} initial="hidden" animate="visible" variants={cardVariants}
                onClick={() => onNavigate('gear?tab=filmStocks&newFilm=1', { skipPageTransition: true })}
              >
                <Package size={16} /> <span>添加胶卷库存</span>
              </motion.button>
            )}
            <motion.button
              className="launchpad-pill portal-gold"
              custom={2} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('gear?tab=cameras&newCamera=1', { skipPageTransition: true })}
            >
              <Camera size={16} /> <span>添加相机</span>
            </motion.button>
            <motion.button
              className="launchpad-pill portal-emerald"
              custom={3} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('insights')}
            >
              <BarChart2 size={16} /> <span>拍摄统计</span>
            </motion.button>
            <motion.button
              className="launchpad-pill portal-purple"
              custom={4} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('compare')}
            >
              <Columns size={16} /> <span>照片对照</span>
            </motion.button>
            <motion.button
              className="launchpad-pill portal-upload"
              custom={5} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => {
                if (authMode === 'trial') {
                  requireRegistration('rolls');
                  return;
                }
                setShowExcelModal(true);
              }}
            >
              <UploadCloud size={16} /> <span>批量导入</span>
            </motion.button>
          </div>
        </div>

        {/* Row 3: Ongoing Rolls */}
        <div className="dash-section">
          <h3>进行中的胶卷记录 ({activeRolls.length})</h3>
          <div className="active-rolls-list">
            {activeRolls.length === 0 ? (
              <div className="active-rolls-empty">
                <Play size={24} style={{ color: 'var(--text-muted)' }} />
                <p>当前没有进行中的胶卷记录。点击上方“新建胶卷记录”开始记录。</p>
              </div>
            ) : (
              activeRollsPreview.map((roll, i) => (
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
                      <span className="loaded-setup-line">
                        <Layers size={12} />
                        装片组合：{getLoadedSetupLabel(roll)}
                      </span>
                      {(roll.lensIds || []).length > 0 && (
                        <span className="loaded-lens-line">
                          <Aperture size={12} />
                          镜头：{(roll.lensIds || []).map(getLensName).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="roll-card-right">
                    {roll.startDate && (
                      <span className="roll-date-display">
                        <Calendar size={12} />
                        {new Date(roll.startDate).toLocaleDateString()}
                      </span>
                    )}
                    <button className="primary btn-sm" onClick={() => onNavigate(`rolls?openRoll=${roll.id}`, { skipPageTransition: true })}>
                      继续记录 <ArrowRight size={12} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
            {activeRolls.length > activeRollsPreview.length && (
              <button className="dashboard-list-row active-rolls-more" onClick={() => onNavigate('rolls')}>
                <span>还有 {activeRolls.length - activeRollsPreview.length} 卷进行中</span>
                <strong>查看全部</strong>
              </button>
            )}
          </div>
        </div>

        <div className="dash-section">
          <h3>使用中的机器 ({activeCameraSummaries.length})</h3>
          <div className="dashboard-mini-list">
            {activeCameraSummaries.length === 0 ? (
              <div className="dashboard-empty-card">
                <Camera size={22} />
                <p>没有机器正在拍摄中。</p>
              </div>
            ) : (
              activeCameraSummaries.map(item => (
                <button key={item.id} className="dashboard-list-row" onClick={() => onNavigate('gear?tab=cameras')}>
                  <span>{item.name}</span>
                  <strong>{item.rolls.length} 卷进行中</strong>
                </button>
              ))
            )}
          </div>
        </div>

      </div>
      {showExcelModal && <ExcelImportModal onClose={() => setShowExcelModal(false)} />}
    </div>
  );
};
