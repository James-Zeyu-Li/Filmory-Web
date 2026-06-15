import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { BarChart3, TrendingUp, DollarSign, Camera, Film, Layers } from 'lucide-react';
import './StatsView.css';

interface StatsViewProps {
  enableFilmMode: boolean;
}

export const StatsView: React.FC<StatsViewProps> = ({ enableFilmMode }) => {
  // Live queries
  const rolls = useLiveQuery(() => db.rolls.toArray()) || [];
  const cameras = useLiveQuery(() => db.cameras.toArray()) || [];
  const filmStocks = useLiveQuery(() => db.filmStocks.toArray()) || [];
  const photoAssets = useLiveQuery(() => db.photoAssets.toArray()) || [];

  // 1. Core KPIs
  const totalRolls = rolls.length;
  const activeRolls = rolls.filter(r => r.status === 'active').length;
  const archivedRolls = rolls.filter(r => r.status === 'archived').length;
  const totalPhotos = photoAssets.length;

  // 2. Cost calculations
  const totalFilmCost = rolls.reduce((acc, r) => acc + (r.filmPrice || 0), 0);
  const totalDevelopCost = rolls.reduce((acc, r) => acc + (acc = r.developPrice || 0), 0);
  const totalCost = totalFilmCost + totalDevelopCost;

  // 3. Film Color Types ratio (Color vs B&W)
  const filmRolls = rolls.filter(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    return film && film.isSystem === 0;
  });
  const colorRolls = filmRolls.filter(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    return film && film.colorType === 'color';
  }).length;
  const bwRolls = filmRolls.filter(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    return film && film.colorType === 'bw';
  }).length;
  const colorPct = filmRolls.length > 0 ? Math.round((colorRolls / filmRolls.length) * 100) : 0;
  const bwPct = filmRolls.length > 0 ? Math.round((bwRolls / filmRolls.length) * 100) : 0;

  // 4. ISO distribution
  const isoCounts: { [key: number]: number } = {};
  rolls.forEach(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    if (film && film.isSystem === 0) {
      isoCounts[film.iso] = (isoCounts[film.iso] || 0) + 1;
    }
  });

  const sortedIsos = Object.entries(isoCounts)
    .map(([iso, count]) => ({ iso: Number(iso), count }))
    .sort((a, b) => b.count - a.count);

  const maxIsoCount = sortedIsos.length > 0 ? Math.max(...sortedIsos.map(i => i.count)) : 1;

  // 5. Camera usage ranking
  const cameraCounts: { [key: string]: number } = {};
  rolls.forEach(r => {
    const cam = cameras.find(c => c.id === r.cameraId);
    if (cam) {
      cameraCounts[cam.name] = (cameraCounts[cam.name] || 0) + 1;
    }
  });

  const sortedCameras = Object.entries(cameraCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const maxCameraCount = sortedCameras.length > 0 ? Math.max(...sortedCameras.map(c => c.count)) : 1;

  return (
    <div className="main-content">
      <header className="view-header">
        <h1>数据分析</h1>
        <div className="view-header-actions" />
      </header>

      <div className="view-body">
        {/* KPI Cards Grid */}
        <div className="stats-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon"><Film size={24} /></div>
            <div className="kpi-content">
              <span>总拍摄卷数</span>
              <h2>{totalRolls} 卷</h2>
              <p>{activeRolls} 进行中 · {archivedRolls} 已归档</p>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon"><BarChart3 size={24} /></div>
            <div className="kpi-content">
              <span>总片数</span>
              <h2>{totalPhotos} 张</h2>
              <p>平均每卷 {totalRolls > 0 ? Math.round(totalPhotos / totalRolls) : 0} 张照片</p>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon"><DollarSign size={24} /></div>
            <div className="kpi-content">
              <span>总投入费用</span>
              <h2>¥{totalCost}</h2>
              <p>胶卷: ¥{totalFilmCost} · 冲洗: ¥{totalDevelopCost}</p>
            </div>
          </div>
        </div>

        {/* Visual Charts Layout */}
        <div className="stats-charts-row">
          {/* Camera Usage Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <Camera size={18} />
              <h3>相机出勤排行</h3>
            </div>
            <div className="chart-content">
              {sortedCameras.length === 0 ? (
                <p className="no-data">暂无相机出勤记录</p>
              ) : (
                <div className="bar-list">
                  {sortedCameras.map(item => {
                    const widthPct = (item.count / maxCameraCount) * 100;
                    return (
                      <div key={item.name} className="bar-list-row">
                        <div className="bar-row-label">{item.name}</div>
                        <div className="bar-row-track">
                          <div className="bar-row-fill fill-accent" style={{ width: `${widthPct}%` }} />
                        </div>
                        <div className="bar-row-value">{item.count} 卷</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ISO Distribution Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <TrendingUp size={18} />
              <h3>常用感光度 (ISO)</h3>
            </div>
            <div className="chart-content">
              {sortedIsos.length === 0 ? (
                <p className="no-data">暂无胶卷感光度记录</p>
              ) : (
                <div className="bar-list">
                  {sortedIsos.map(item => {
                    const widthPct = (item.count / maxIsoCount) * 100;
                    return (
                      <div key={item.iso} className="bar-list-row">
                        <div className="bar-row-label">ISO {item.iso}</div>
                        <div className="bar-row-track">
                          <div className="bar-row-fill fill-gold" style={{ width: `${widthPct}%` }} />
                        </div>
                        <div className="bar-row-value">{item.count} 卷</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: Color ratio and inventory */}
        {enableFilmMode && (
          <div className="stats-charts-row" style={{ marginTop: '24px' }}>
            {/* Color vs B&W Ratio */}
            <div className="chart-card flex-1">
              <div className="chart-header">
                <Layers size={18} />
                <h3>彩色 vs 黑白胶片比例</h3>
              </div>
              <div className="chart-content center-content">
                {filmRolls.length === 0 ? (
                  <p className="no-data">暂无胶片冲洗数据</p>
                ) : (
                  <div className="donut-chart-container">
                    <svg viewBox="0 0 100 100" width="160" height="160">
                      {/* Color Segment */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="var(--accent)"
                        strokeWidth="12"
                        strokeDasharray={`${colorPct * 2.51} 251`}
                        strokeDashoffset="0"
                        transform="rotate(-90 50 50)"
                      />
                      {/* B&W Segment */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#9ca3af"
                        strokeWidth="12"
                        strokeDasharray={`${bwPct * 2.51} 251`}
                        strokeDashoffset={`-${colorPct * 2.51}`}
                        transform="rotate(-90 50 50)"
                      />
                      <circle cx="50" cy="50" r="30" fill="var(--bg-secondary)" />
                    </svg>
                    <div className="donut-legend">
                      <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: 'var(--accent)' }} />
                        <span>彩色 ({colorPct}%)</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#9ca3af' }} />
                        <span>黑白 ({bwPct}%)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
