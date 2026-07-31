import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, ComposedChart, Legend
} from 'recharts';
import { BarChart3, TrendingUp, DollarSign, Camera, Film, Layers, Star, Package } from 'lucide-react';
import './StatsView.css';
import { useRolls, useCameras, useFilmStocks, usePhotoAssets, useCollections } from '../../hooks/useData';
import { usePhotoUrlMap } from '../../hooks/usePhotoUrlMap';
import { useCurrency } from '../../contexts/useCurrency';
import { useLanguage } from '../../contexts/useLanguage';

interface StatsViewProps {
  enableFilmMode: boolean;
  isEmbedded?: boolean;
}

export const StatsView: React.FC<StatsViewProps> = ({ enableFilmMode, isEmbedded }) => {
  // Live queries
  const rolls = useRolls();
  const cameras = useCameras();
  const filmStocks = useFilmStocks();
  const collections = useCollections();
  const photoAssets = usePhotoAssets();
  const photoUrlMap = usePhotoUrlMap(photoAssets);
  const { currencySymbol, formatCurrency } = useCurrency();
  const { t } = useLanguage();

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
    { name: t('stats.color'), value: colorRolls, fill: '#e2b028' },
    { name: t('stats.bw'), value: bwRolls, fill: '#6b7280' }
  ];

  // ===== Camera Usage Ranking =====
  const cameraCounts: { [key: string]: number } = {};
  rolls.forEach(r => {
    const cam = cameras.find(c => (r.cameraIds || []).includes(c.id!));
    if (cam) cameraCounts[cam.name] = (cameraCounts[cam.name] || 0) + 1;
  });
  const cameraChartData = Object.entries(cameraCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const barColors = ['#e2b028', '#f59e0b', '#d97706', '#b45309', '#92400e'];

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

  rolls.filter(r => r.status === 'archived').forEach(r => {
    if (r.endDate) {
      const d = new Date(r.endDate);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${d.getFullYear()}-${mm}`;
      if (monthlyDataMap[key]) {
        monthlyDataMap[key].spend += (Number(r.filmPrice) || 0) + (Number(r.developPrice) || 0);
        monthlyDataMap[key].rollsShot += 1;
      }
    }
  });
  const monthlyTrendData = Object.values(monthlyDataMap);

  // B. Film Cost Split (Historical Average Strategy)
  let totalUsedValue = 0;
  let estimatedInventoryValue = 0;

  filmStocks.forEach(film => {
    if (film.isSystem === 1) return;
    const usedRolls = rolls.filter(r => r.filmStockId === film.id);
    let filmUsedSpend = 0;
    let knownPriceRolls = 0;
    
    usedRolls.forEach(r => {
      const price = Number(r.filmPrice);
      if (price && price > 0) {
        filmUsedSpend += price;
        knownPriceRolls += 1;
      }
    });

    totalUsedValue += filmUsedSpend;
    const avgPrice = knownPriceRolls > 0 ? (filmUsedSpend / knownPriceRolls) : 0;
    estimatedInventoryValue += (film.stockCount || 0) * avgPrice;
  });

  const costSplitData = [
    { name: t('stats.usedFilmCost'), value: Math.round(totalUsedValue), fill: '#ef4444' },
    { name: t('stats.inventoryValue'), value: Math.round(estimatedInventoryValue), fill: '#3b82f6' }
  ];

  // C. Camera Value & Usage Ranking (ROI)
  const cameraRoiData = cameras.filter(c => c.type === 'film').map(c => {
    const usedRolls = rolls.filter(r => (r.cameraIds || []).includes(c.id!));
    const price = Number(c.purchasePrice) || 0;
    return {
      name: c.name,
      price: price,
      rolls: usedRolls.length,
      roi: price > 0 ? (usedRolls.length / price) : 0
    };
  }).filter(c => c.rolls > 0 || c.price > 0)
    .sort((a, b) => b.rolls - a.rolls)
    .slice(0, 8);

  // D. High-Rated Rolls Top 5
  const topRolls = rolls
    .filter(r => r.rating && r.rating >= 4)
    .map(r => {
      const pCount = photoAssets.filter(p => p.rollId === r.id).length;
      return { ...r, photosCount: pCount };
    })
    .sort((a, b) => {
      if (b.rating !== a.rating) return (b.rating || 0) - (a.rating || 0);
      return b.photosCount - a.photosCount;
    })
    .slice(0, 5);

  return (
    <div className={isEmbedded ? "" : "main-content"}>
      {!isEmbedded && (
        <header className="view-header">
          <h1>{t('stats.title')}</h1>
          <div className="view-header-actions" />
        </header>
      )}

      <div className={`view-body stats-workspace-body ${isEmbedded ? 'embedded-mode' : ''}`} style={isEmbedded ? { padding: 0 } : {}}>
        {/* KPI Cards Grid */}
        <div className="stats-kpi-grid">
          <div className="kpi-card stats-kpi-gold">
            <div className="kpi-icon"><Film size={22} /></div>
            <div className="kpi-content">
              <span>{t('stats.totalRolls')}</span>
              <h2>{t('stats.rollsValue', { count: totalRolls })}</h2>
              <p>{t('stats.activeArchived', { active: activeRolls, archived: archivedRolls })}</p>
            </div>
          </div>

          <div className="kpi-card stats-kpi-sky">
            <div className="kpi-icon"><Layers size={22} /></div>
            <div className="kpi-content">
              <span>{t('stats.totalCollections')}</span>
              <h2>{t('stats.collectionsValue', { count: totalCollections })}</h2>
              <p>{t('stats.collectionsDesc')}</p>
            </div>
          </div>

          <div className="kpi-card stats-kpi-emerald">
            <div className="kpi-icon"><Camera size={22} /></div>
            <div className="kpi-content">
              <span>{t('stats.cameraCount')}</span>
              <h2>{t('stats.camerasValue', { count: totalCameras })}</h2>
              <p>{t('stats.camerasDesc')}</p>
            </div>
          </div>

          <div className="kpi-card stats-kpi-gold">
            <div className="kpi-icon"><Package size={22} /></div>
            <div className="kpi-content">
              <span>{t('stats.inventoryRolls')}</span>
              <h2>{t('stats.rollsValue', { count: inventoryRolls })}</h2>
              <p>{t('stats.inventoryDesc')}</p>
            </div>
          </div>

          <div className="kpi-card stats-kpi-sky">
            <div className="kpi-icon"><BarChart3 size={22} /></div>
            <div className="kpi-content">
              <span>{t('stats.shotRolls')}</span>
              <h2>{t('stats.rollsValue', { count: archivedRolls })}</h2>
              <p>{t('stats.savedSamples', { count: savedSamplePhotos })}</p>
            </div>
          </div>
        </div>

        {/* Visual Charts Layout - Grid */}
        <div className="stats-charts-grid">
          {/* 1. Camera Attendance Chart */}
          <div className="chart-card">
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
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#20222a', border: '1px solid #272930', borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: 'rgba(226,176,40,0.05)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={24} name={t('stats.rollUsage')}>
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
          <div className="chart-card">
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
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#20222a', border: '1px solid #272930', borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: 'rgba(245,158,11,0.05)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={24} name={t('stats.rollUsage')} fill="#f59e0b">
                      {isoChartData.map((_, i) => (
                        <Cell key={i} fill={barColors[i % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 3. Rating Distribution Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <Star size={18} />
              <h3>{t('stats.ratingTitle')}</h3>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ratingChartData} margin={{ left: -20, right: 10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#20222a', border: '1px solid #272930', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32} fill="rgba(56, 189, 248, 0.7)" name={t('stats.rollCount')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Color vs B&W Ratio (Pie) */}
          {enableFilmMode && (
            <div className="chart-card">
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

          {/* 5. Monthly Spend Trend (AreaChart) */}
          <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
            <div className="chart-header">
              <DollarSign size={18} />
              <h3>{t('stats.monthlySpend')}</h3>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyTrendData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#20222a', border: '1px solid #272930', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Area type="monotone" dataKey="spend" name={t('stats.totalSpend', { symbol: currencySymbol })} stroke="#10b981" fillOpacity={1} fill="url(#colorSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. Monthly Shooting Trend (ComposedChart) */}
          <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
            <div className="chart-header">
              <Camera size={18} />
              <h3>{t('stats.monthlyCompleted')}</h3>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={monthlyTrendData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#20222a', border: '1px solid #272930', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="rollsShot" name={t('stats.archivedRolls')} barSize={32} fill="rgba(56, 189, 248, 0.7)" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 7. Film Cost Split */}
          {enableFilmMode && (
            <div className="chart-card">
              <div className="chart-header">
                <DollarSign size={18} />
                <h3>{t('stats.filmCostSplit')}</h3>
              </div>
              <div className="chart-content flex-center-donut">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={costSplitData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {costSplitData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#20222a', border: '1px solid #272930', borderRadius: 8, fontSize: 12 }}
                      formatter={(value: any) => formatCurrency(Number(value))}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 8. Camera Value & ROI */}
          <div className="chart-card">
            <div className="chart-header">
              <Camera size={18} />
              <h3>{t('stats.cameraEfficiency')}</h3>
            </div>
            <div className="chart-content">
              {cameraRoiData.length === 0 ? (
                <p className="no-data">{t('stats.noCameraValue')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', padding: '10px 0', overflowY: 'auto' }}>
                  {cameraRoiData.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('stats.purchasePrice', { price: c.price > 0 ? formatCurrency(c.price) : t('stats.priceMissing') })}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', color: '#e2b028', fontWeight: 600 }}>{t('stats.rollsValue', { count: c.rolls })}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{t('stats.rollsPerCurrency', { symbol: currencySymbol, value: c.roi > 0 ? c.roi.toFixed(2) : '-' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 9. Top 5 Rolls */}
          <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
            <div className="chart-header">
              <Star size={18} fill="#e2b028" color="#e2b028" />
              <h3>{t('stats.topRolls')}</h3>
            </div>
            <div className="chart-content" style={{ padding: '0 16px 16px 16px' }}>
              {topRolls.length === 0 ? (
                <p className="no-data">{t('stats.noTopRolls')}</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
                  {topRolls.map((r, i) => {
                    const cover = photoAssets.find(p => p.id === r.coverPhotoId);
                    const coverUrl = cover?.id ? photoUrlMap[cover.id] : undefined;
                    return (
                      <div key={r.id} style={{
                        position: 'relative',
                        height: '140px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        background: '#1f2937'
                      }}>
                        {coverUrl && (
                          <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundImage: `url(${coverUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            opacity: 0.5
                          }} />
                        )}
                        <div style={{
                          position: 'relative',
                          zIndex: 1,
                          padding: '12px',
                          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                              <div style={{ color: '#e2b028', fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                #{i + 1} <Star size={14} fill="#e2b028" /> {r.rating}
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                {r.name}
                              </div>
                            </div>
                            <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600 }}>
                              {t('stats.samplePhotos', { count: r.photosCount })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
