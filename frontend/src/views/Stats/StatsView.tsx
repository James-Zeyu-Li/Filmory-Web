import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, ComposedChart, Legend
} from 'recharts';
import { BarChart3, TrendingUp, DollarSign, Camera, Film, Layers, Star, Package, ChevronDown } from 'lucide-react';
import './StatsView.css';
import { StatCard } from '../../components/ui/StatCard';
import { useRolls, useCameras, useFilmStocks, usePhotoAssets, useCollections } from '../../hooks/useData';
import { db, type CameraTransfer, type LedgerTransaction } from '../../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../contexts/useAuth';
import { useCurrency } from '../../contexts/useCurrency';
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
  // Live queries
  const { user } = useAuth();
  const rolls = useRolls();
  const cameras = useCameras();
  const filmStocks = useFilmStocks();
  const collections = useCollections();
  const photoAssets = usePhotoAssets();
  const transactions = useLiveQuery(
    () => user?.id
      ? db.ledgerTransactions.where('userId').equals(user.id).toArray()
      : Promise.resolve([] as LedgerTransaction[]),
    [user?.id],
  ) ?? [];
  const { currencySymbol } = useCurrency();
  const { t } = useLanguage();
  const [isMoreInsightsOpen, setIsMoreInsightsOpen] = useState(false);

  // ===== KPI Calculations =====
  const totalRolls = rolls.length;
  const activeRolls = rolls.filter(r => r.status === 'active').length;
  const archivedRolls = rolls.filter(r => r.status === 'archived').length;
  const totalCollections = collections.length;
  const totalCameras = cameras.length;
  const inventoryRolls = filmStocks
    .filter(f => f.isSystem === 0)
    .reduce((acc, film) => acc + (film.stockCount || 0), 0);
  const savedSamplePhotos = photoAssets.length;

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

  const barColors = ['var(--chart-series-gold)', 'var(--chart-series-gold-soft)', 'var(--chart-series-gold-deep)', 'var(--chart-series-gold-dark)', 'var(--chart-series-gold-muted)'];

  // ===== ISO Distribution =====
  const isoCounts: { [key: number]: number } = {};
  rolls.forEach(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    if (film && film.isSystem === 0) {
      isoCounts[film.iso] = (isoCounts[film.iso] || 0) + 1;
    }
  });
  const isoChartData = Object.entries(isoCounts)
    .map(([iso, count]) => ({ name: `ISO ${iso}`, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ===== Rating Distribution =====
  const ratingCounts: { [key: string]: number } = {
    [t('stats.ratingOne')]: 0,
    [t('stats.ratingTwo')]: 0,
    [t('stats.ratingThree')]: 0,
    [t('stats.ratingFour')]: 0,
    [t('stats.ratingFive')]: 0
  };
  rolls.forEach(r => {
    if (r.rating && r.rating >= 1 && r.rating <= 5) {
      const ratingKeyMap: Record<number, string> = {
        1: t('stats.ratingOne'),
        2: t('stats.ratingTwo'),
        3: t('stats.ratingThree'),
        4: t('stats.ratingFour'),
        5: t('stats.ratingFive'),
      };
      ratingCounts[ratingKeyMap[r.rating]] = (ratingCounts[ratingKeyMap[r.rating]] || 0) + 1;
    }
  });
  const ratingChartData = Object.entries(ratingCounts)
    .map(([name, count]) => ({ name, count }));

  // ===== NEW ADVANCED ALGORITHMS =====

  // A. Time-Series Aggregations (Last 12 Months)
  const last12Months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    last12Months.push(`${d.getFullYear()}-${mm}`);
  }

  const monthlyDataMap: Record<string, { month: string, spend: number, rollsShot: number }> = {};
  last12Months.forEach(m => {
    monthlyDataMap[m] = { month: m, spend: 0, rollsShot: 0 };
  });

  transactions.filter(transaction => transaction.type === 'expense').forEach(transaction => {
    if (transaction.date) {
      const d = new Date(transaction.date);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${d.getFullYear()}-${mm}`;
      if (monthlyDataMap[key]) {
        monthlyDataMap[key].spend += Math.abs(Number(transaction.amount) || 0);
      }
    }
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
            tone="emerald"
            icon={Camera}
            label={t('stats.cameraCount')}
            value={t('stats.camerasValue', { count: totalCameras })}
            description={t('stats.camerasDesc')}
          />

          <StatCard
            tone="gold"
            icon={Package}
            label={t('stats.inventoryRolls')}
            value={t('stats.rollsValue', { count: inventoryRolls })}
            description={t('stats.inventoryDesc')}
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

          {/* 2. ISO Distribution Chart */}
          <div className="chart-card stats-chart-priority">
            <div className="chart-header">
              <TrendingUp size={18} />
              <h3>{t('stats.isoTitle')}</h3>
            </div>
            <div className="chart-content">
              {isoChartData.length === 0 ? (
                <p className="no-data">{t('stats.noIso')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={isoChartData} layout="vertical" margin={{ left: -10, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} tick={chartAxisTick} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      cursor={{ fill: 'var(--chart-hover-fill)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={24} name={t('stats.rollUsage')} fill="var(--chart-series-gold-soft)">
                      {isoChartData.map((_, i) => (
                        <Cell key={i} fill={barColors[i % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

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

          {/* Secondary analyses are intentionally deferred until requested. */}
          {isMoreInsightsOpen && <>
          {/* 3. Rating Distribution Chart */}
          <div className="chart-card stats-chart-advanced">
            <div className="chart-header">
              <Star size={18} />
              <h3>{t('stats.ratingTitle')}</h3>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ratingChartData} margin={{ left: -20, right: 10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    cursor={{ fill: 'var(--chart-surface-subtle)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32} fill="var(--chart-series-blue)" name={t('stats.rollCount')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Color vs B&W Ratio (Pie) */}
          {enableFilmMode && (
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
          </>}

          {/* 5. Monthly Spend Trend (AreaChart) */}
          <div className="chart-card stats-chart-priority stats-chart-wide">
            <div className="chart-header">
              <DollarSign size={18} />
              <h3>{t('stats.monthlySpend')}</h3>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyTrendData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-series-green)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--chart-series-green)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: 'var(--chart-series-green)' }}
                  />
                  <Area type="monotone" dataKey="spend" name={t('stats.totalSpend', { symbol: currencySymbol })} stroke="var(--chart-series-green)" fillOpacity={1} fill="url(#colorSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. Monthly Shooting Trend (ComposedChart) */}
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

        </div>
      </div>
    </div>
  );
};
