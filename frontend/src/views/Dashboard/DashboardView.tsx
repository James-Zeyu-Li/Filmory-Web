import { motion } from 'framer-motion';
import {
  Camera, LayoutDashboard,
  Play, Calendar, ArrowRight, Film, Package, Aperture, Layers
} from 'lucide-react';
import './DashboardView.css';
import { useRolls, useCameras, useFilmStocks, useFilmBacks, useLenses } from '../../hooks/useData';
import { useLanguage } from '../../contexts/useLanguage';

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
  const { t } = useLanguage();
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

  const activeCameraIds = Array.from(new Set(
    activeRolls.flatMap(r => r.cameraIds || []).filter((id): id is string => Boolean(id))
  ));
  const activeCameraSummaries = activeCameraIds.map(id => {
    const camera = cameras.find(c => c.id === id);
    const loadedRolls = activeRolls.filter(r => (r.cameraIds || []).includes(id));
    return {
      id,
      name: camera?.name || t('common.unknownCamera'),
      rolls: loadedRolls,
    };
  });
  const activeFilmBackIds = Array.from(new Set(
    activeRolls.map(r => r.filmBackId).filter((id): id is string => Boolean(id))
  ));
  const showLoadedBackMetric = (
    cameras.some(camera => camera.format === '120') ||
    usableFilmStocks.some(film => film.format === '120') ||
    filmBacks.some(back => back.format === '120') ||
    rolls.some(roll => Boolean(roll.filmBackId))
  );

  const getCameraName = (id?: string) => {
    return cameras.find(c => c.id === id)?.name || t('common.unknownCamera');
  };

  const getFilmName = (id?: string) => {
    const film = filmStocks.find(f => f.id === id);
    if (!film) return t('common.unknownFilm');
    return film.isSystem === 1 ? t('common.digital') : `${film.brand} ${film.name}`;
  };

  const getFilmBackName = (id?: string) => {
    return filmBacks.find(back => back.id === id)?.name || t('common.notSelectedBack');
  };

  const getLensName = (id?: string) => {
    return lenses.find(lens => lens.id === id)?.name || t('common.unknownLens');
  };

  const getLoadedSetupLabel = (roll: typeof activeRolls[number]) => {
    const cameraLabel = (roll.cameraIds || []).map(getCameraName).join(' / ') || t('dashboard.unboundCamera');
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
            <h1>{t('dashboard.title')}</h1>
            <p className="view-header-subtitle">{t('dashboard.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="view-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Row 1: Key Metrics */}
        <div className="dash-section">
          <h2 className="dash-section-title">{t('dashboard.workspace')}</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon active"><Play size={18} /></div>
              <div className="metric-data">
                <span>{t('dashboard.active')}</span>
                <strong>{activeRolls.length} {t('common.rollUnit')}</strong>
              </div>
            </div>
            <button
              type="button"
              className="metric-card metric-card-button"
              onClick={() => onNavigate('gear?tab=filmStocks')}
            >
              <div className="metric-icon stock"><Package size={18} /></div>
              <div className="metric-data">
                <span>{t('dashboard.filmStock')}</span>
                <strong>{totalFilmStock} {t('common.rollUnit')}</strong>
              </div>
            </button>
            <div className="metric-card">
              <div className="metric-icon camera"><Camera size={18} /></div>
              <div className="metric-data">
                <span>{t('dashboard.activeCameras')}</span>
                <strong>{activeCameraSummaries.length} {t('common.cameraUnit')}</strong>
              </div>
            </div>
            {showLoadedBackMetric && (
              <div className="metric-card">
                <div className="metric-icon back"><Package size={18} /></div>
                <div className="metric-data">
                  <span>{t('dashboard.loadedBacks')}</span>
                  <strong>{activeFilmBackIds.length} {t('common.backUnit')}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Launchpad (快捷入口) */}
        <div className="dash-section">
          <h2 className="dash-section-title">{t('dashboard.launchpad')}</h2>
          <div className="launchpad-row">
            <motion.button
              className="launchpad-pill portal-blue"
              custom={0} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('rolls?newRoll=1', { skipPageTransition: true })}
            >
              <Film size={16} /> <span>{t('dashboard.newRoll')}</span>
            </motion.button>
            {enableFilmMode && (
              <motion.button
                className="launchpad-pill"
                custom={1} initial="hidden" animate="visible" variants={cardVariants}
                onClick={() => onNavigate('gear?tab=filmStocks&newFilm=1', { skipPageTransition: true })}
              >
                <Package size={16} /> <span>{t('dashboard.addFilmStock')}</span>
              </motion.button>
            )}
            <motion.button
              className="launchpad-pill portal-gold"
              custom={2} initial="hidden" animate="visible" variants={cardVariants}
              onClick={() => onNavigate('gear?tab=cameras&newCamera=1', { skipPageTransition: true })}
            >
              <Camera size={16} /> <span>{t('dashboard.addCamera')}</span>
            </motion.button>
          </div>
        </div>

        {/* Row 3: Ongoing Rolls */}
        <div className="dash-section">
          <h2 className="dash-section-title">{t('dashboard.activeRollsTitle', { count: activeRolls.length })}</h2>
          <div className="active-rolls-list">
            {activeRolls.length === 0 ? (
              <div className="active-rolls-empty">
                <Play size={24} style={{ color: 'var(--text-muted)' }} />
                <p>{t('dashboard.noActiveRolls')}</p>
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
                        {t('dashboard.loadedSetup', { setup: getLoadedSetupLabel(roll) })}
                      </span>
                      {(roll.lensIds || []).length > 0 && (
                        <span className="loaded-lens-line">
                          <Aperture size={12} />
                          {t('dashboard.lenses', { lenses: (roll.lensIds || []).map(getLensName).join(', ') })}
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
                      {t('dashboard.continue')} <ArrowRight size={12} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
            {activeRolls.length > activeRollsPreview.length && (
              <button className="dashboard-list-row active-rolls-more" onClick={() => onNavigate('rolls')}>
                <span>{t('dashboard.moreActiveRolls', { count: activeRolls.length - activeRollsPreview.length })}</span>
                <strong>{t('common.viewAll')}</strong>
              </button>
            )}
          </div>
        </div>

        {activeCameraSummaries.length > 0 && (
          <div className="dash-section">
            <h2 className="dash-section-title">{t('dashboard.activeCamerasTitle', { count: activeCameraSummaries.length })}</h2>
            <div className="dashboard-mini-list">
              {activeCameraSummaries.map(item => (
                <button key={item.id} className="dashboard-list-row" onClick={() => onNavigate('gear?tab=cameras')}>
                  <span>{item.name}</span>
                  <strong>{t('dashboard.cameraActiveRollCount', { count: item.rolls.length })}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
