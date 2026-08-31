import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, ComposedChart, Legend
} from 'recharts';
import { BarChart3, Camera, Aperture, Film, Layers, ChevronDown, Star } from 'lucide-react';
import './StatsView.css';
import { StatCard } from '../../components/ui/StatCard';
import { useRolls, useCameras, useLenses, useFilmStocks, usePhotoAssets, useCollections } from '../../hooks/useData';
import type { CameraTransfer } from '../../db/schema';
import { resolveLensUsageRanking } from '../../services/lensUsageRankingService';
import { resolveBestFrames } from '../../services/bestFramesService';
import { useLanguage } from '../../contexts/useLanguage';

interface StatsViewProps {
  enableFilmMode: boolean;
  isEmbedded?: boolean;
}

const chartAxisTick = { fill: 'var(--chart-axis)', fontSize: 11 };
const chartTooltipStyle = {
  background: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: 8,
  color: 'var(--chart-tooltip-text)',
  fontSize: 12,
};

export const StatsView: React.FC<StatsViewProps> = ({ enableFilmMode, isEmbedded }) => {
  const navigate = useNavigate();
  // Live queries
  const rolls = useRolls();
  const cameras = useCameras();
  const lenses = useLenses();
  const filmStocks = useFilmStocks();
  const collections = useCollections();
  const photoAssets = usePhotoAssets();
  const { t } = useLanguage();
  const [isMoreInsightsOpen, setIsMoreInsightsOpen] = useState(false);

  // ===== KPI Calculations =====
  const totalRolls = rolls.length;
  const activeRolls = rolls.filter(r => r.status === 'active').length;
  const archivedRolls = rolls.filter(r => r.status === 'archived').length;
  const totalCollections = collections.length;
  const savedSamplePhotos = photoAssets.length;
  const bestFrames = resolveBestFrames(photoAssets);

  // ===== Color vs B&W Ratio =====
  const filmRolls = rolls.filter(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    return film && film.isSystem === 0;
  });
  const colorRolls = filmRolls.filter(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    return film && film.colorType === 'color';
  }).length;
  const bwRolls = filmRolls.length - colorRolls;

  const donutData = [
    { name: t('stats.color'), value: colorRolls, fill: 'var(--chart-series-gold)' },
    { name: t('stats.bw'), value: bwRolls, fill: 'var(--chart-series-gray)' }
  ];

  // ===== Camera Usage Ranking =====
  const cameraCounts: { [key: string]: number } = {};
  rolls.forEach(r => {
    const transfers: CameraTransfer[] = r.cameraTransfers || [];
    const participatingCameraIds = transfers.length > 0
      ? [transfers[0].fromCameraId, ...transfers.map((transfer: CameraTransfer) => transfer.toCameraId)]
      : [r.currentCameraId || r.cameraIds?.[0]].filter((cameraId): cameraId is string => Boolean(cameraId));
    new Set(participatingCameraIds).forEach(cameraId => {
      const camera = cameras.find(c => c.id === cameraId);
      if (camera) cameraCounts[camera.name] = (cameraCounts[camera.name] || 0) + 1;
    });
  });
  const cameraChartData = Object.entries(cameraCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ===== Lens Usage Ranking =====
  const lensChartData = resolveLensUsageRanking(rolls, lenses);

  const barColors = ['var(--chart-series-gold)', 'var(--chart-series-gold-soft)', 'var(--chart-series-gold-deep)', 'var(--chart-series-gold-dark)', 'var(--chart-series-gold-muted)'];

  // A. Time-Series Aggregations (Last 12 Months)
  const last12Months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    last12Months.push(`${d.getFullYear()}-${mm}`);
  }

  const monthlyDataMap: Record<string, { month: string, rollsShot: number }> = {};
  last12Months.forEach(m => {
    monthlyDataMap[m] = { month: m, rollsShot: 0 };
  });

  rolls.filter(r => r.status === 'archived' && r.endDate).forEach(r => {
    const d = new Date(r.endDate!);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${d.getFullYear()}-${mm}`;
    if (monthlyDataMap[key]) monthlyDataMap[key].rollsShot += 1;
  });
  const monthlyTrendData = Object.values(monthlyDataMap);

  return (
    <div className={isEmbedded ? "" : "main-content"}>
      {!isEmbedded && (
        <header className="view-header">
          <h1>{t('stats.title')}</h1>
          <div className="view-header-actions" />
        </header>
      )}

      <div className={`view-body stats-workspace-body ${isEmbedded ? 'embedded-mode' : ''}`}>
        {/* KPI Cards Grid */}
        <div className="stat-card-grid">
          <StatCard
            tone="gold"
            icon={Film}
            label={t('stats.totalRolls')}
            value={t('stats.rollsValue', { count: totalRolls })}
            description={t('stats.activeArchived', { active: activeRolls, archived: archivedRolls })}
          />

          <StatCard
            tone="sky"
            icon={Layers}
            label={t('stats.totalCollections')}
            value={t('stats.collectionsValue', { count: totalCollections })}
            description={t('stats.collectionsDesc')}
          />

          <StatCard
            tone="sky"
            icon={BarChart3}
            label={t('stats.shotRolls')}
            value={t('stats.rollsValue', { count: archivedRolls })}
            description={t('stats.savedSamples', { count: savedSamplePhotos })}
          />
        </div>

        {/* Visual Charts Layout - Grid */}
        <div className="stats-charts-grid">
          {/* 1. Camera Attendance Chart */}
          <div className="chart-card stats-chart-priority">
            <div className="chart-header">
              <Camera size={18} />
              <h3>{t('stats.cameraRanking')}</h3>
            </div>
            <div className="chart-content">
              {cameraChartData.length === 0 ? (
                <p className="no-data">{t('stats.noCameraUsage')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cameraChartData} layout="vertical" margin={{ left: -10, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={chartAxisTick} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      cursor={{ fill: 'var(--chart-hover-fill)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={24} name={t('stats.cameraRecordUsage')}>
                      {cameraChartData.map((_, i) => (
                        <Cell key={i} fill={barColors[i % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 2. Lens Usage Chart */}
          <div className="chart-card stats-chart-priority">
            <div className="chart-header">
              <Aperture size={18} />
              <h3>{t('stats.lensRanking')}</h3>
            </div>
            <div className="chart-content">
              {lensChartData.length === 0 ? (
                <p className="no-data">{t('stats.noLensUsage')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={lensChartData} layout="vertical" margin={{ left: -10, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={chartAxisTick} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      cursor={{ fill: 'var(--chart-hover-fill)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={24} name={t('stats.lensRecordUsage')}>
                      {lensChartData.map((_, i) => (
                        <Cell key={i} fill={barColors[i % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Color/B&W is the only remaining secondary analysis (film-mode only),
              so the whole toggle disappears rather than expanding to nothing. */}
          {enableFilmMode && (
            <>
              <div className="stats-more-insights-toggle">
                <button
                  type="button"
                  className="secondary stats-more-insights-button"
                  onClick={() => setIsMoreInsightsOpen(current => !current)}
                  aria-expanded={isMoreInsightsOpen}
                  aria-controls="stats-more-insights"
                >
                  {isMoreInsightsOpen ? t('stats.hideMoreInsights') : t('stats.showMoreInsights')}
                  <ChevronDown size={16} className={isMoreInsightsOpen ? 'is-open' : ''} aria-hidden="true" />
                </button>
              </div>

              {isMoreInsightsOpen && (
                <div className="chart-card stats-chart-advanced">
                  <div className="chart-header">
                    <Layers size={18} />
                    <h3>{t('stats.colorBwTitle')}</h3>
                  </div>
                  <div className="chart-content flex-center-donut">
                    {filmRolls.length === 0 ? (
                      <p className="no-data">{t('stats.noColorData')}</p>
                    ) : (
                      <div className="donut-layout-stats">
                        <ResponsiveContainer width={150} height={150}>
                          <PieChart>
                            <Pie
                              data={donutData}
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="none"
                            >
                              {donutData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <text x="50%" y="46%" textAnchor="middle" className="donut-label-value">{filmRolls.length}</text>
                            <text x="50%" y="62%" textAnchor="middle" className="donut-label-sub">{t('stats.totalRollsShort')}</text>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-legend-stats">
                          <div className="donut-legend-row">
                            <div className="donut-swatch swatch-color" />
                            <span>{t('stats.colorLegend', { count: colorRolls, percent: colorRolls + bwRolls > 0 ? Math.round((colorRolls / (colorRolls + bwRolls)) * 100) : 0 })}</span>
                          </div>
                          <div className="donut-legend-row">
                            <div className="donut-swatch swatch-bw" />
                            <span>{t('stats.bwLegend', { count: bwRolls, percent: colorRolls + bwRolls > 0 ? Math.round((bwRolls / (colorRolls + bwRolls)) * 100) : 0 })}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 5. Monthly Shooting Trend (ComposedChart) */}
          <div className="chart-card stats-chart-priority stats-chart-wide">
            <div className="chart-header">
              <Camera size={18} />
              <h3>{t('stats.monthlyCompleted')}</h3>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={monthlyTrendData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="rollsShot" name={t('stats.archivedRolls')} barSize={32} fill="var(--chart-series-blue)" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. Best Frames — actual rated photos, not another distribution chart. */}
          {bestFrames.totalCount > 0 && (
            <div className="chart-card stats-chart-priority stats-chart-wide">
              <div className="chart-header">
                <Star size={18} />
                <h3>{t('stats.bestFramesTitle')}</h3>
              </div>
              <div className="chart-content">
                <p className="stats-best-frames-count">{t('stats.bestFramesCount', { count: bestFrames.totalCount })}</p>
                <div className="stats-best-frames-grid">
                  {bestFrames.photos.map(photo => (
                    <button
                      key={photo.id}
                      type="button"
                      className="stats-best-frames-tile"
                      onClick={() => navigate(`/rolls?tab=all&openRoll=${photo.rollId}&rollView=contactSheet`)}
                      aria-label={t('stats.bestFramesOpenRoll')}
                    >
                      {(photo.thumbnailUrl || photo.previewUrl) && (
                        <img src={photo.thumbnailUrl || photo.previewUrl} alt="" decoding="async" />
                      )}
                      <span className="stats-best-frames-rating">
                        <Star size={12} fill="var(--accent)" color="var(--accent)" />
                        {photo.rating}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
