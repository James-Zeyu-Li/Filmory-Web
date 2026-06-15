import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PhotoAsset } from '../../db/schema';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import {
  Film, Camera, DollarSign, Image, Columns,
  TrendingUp, Layers, ArrowRight
} from 'lucide-react';
import './DashboardView.css';

interface DashboardViewProps {
  enableFilmMode: boolean;
  onNavigate: (tab: string) => void;
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const }
  })
};

export const DashboardView: React.FC<DashboardViewProps> = ({ enableFilmMode, onNavigate }) => {
  const rolls = useLiveQuery(() => db.rolls.toArray()) || [];
  const cameras = useLiveQuery(() => db.cameras.toArray()) || [];
  const filmStocks = useLiveQuery(() => db.filmStocks.toArray()) || [];
  const photoAssets = useLiveQuery(() => db.photoAssets.toArray()) || [];
  const archivedRolls = useLiveQuery(() => db.rolls.where('status').equals('archived').toArray()) || [];

  // ===== KPI Calculations =====
  const totalRolls = rolls.length;
  const activeRolls = rolls.filter(r => r.status === 'active').length;
  const archivedCount = rolls.filter(r => r.status === 'archived').length;
  const totalPhotos = photoAssets.length;
  const totalFilmCost = rolls.reduce((acc, r) => acc + (r.filmPrice || 0), 0);
  const totalDevelopCost = rolls.reduce((acc, r) => acc + (r.developPrice || 0), 0);
  const totalCost = totalFilmCost + totalDevelopCost;

  // ===== Camera Usage =====
  const cameraCounts: { [key: string]: number } = {};
  rolls.forEach(r => {
    const cam = cameras.find(c => c.id === r.cameraId);
    if (cam) cameraCounts[cam.name] = (cameraCounts[cam.name] || 0) + 1;
  });
  const cameraChartData = Object.entries(cameraCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const barColors = ['#e2b028', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'];

  // ===== Color vs B&W Donut =====
  const filmRolls = rolls.filter(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    return film && film.isSystem === 0;
  });
  const colorCount = filmRolls.filter(r => {
    const film = filmStocks.find(f => f.id === r.filmStockId);
    return film && film.colorType === 'color';
  }).length;
  const bwCount = filmRolls.length - colorCount;
  const donutData = [
    { name: '彩色', value: colorCount, fill: '#e2b028' },
    { name: '黑白', value: bwCount, fill: '#6b7280' }
  ];

  // ===== Compare Quick Access =====
  const [rollAId, setRollAId] = useState<number | ''>('');
  const [rollBId, setRollBId] = useState<number | ''>('');

  const photosA = useLiveQuery<PhotoAsset[]>(() =>
    rollAId ? db.photoAssets.where('rollId').equals(Number(rollAId)).toArray() : Promise.resolve([] as PhotoAsset[])
  , [rollAId]) || [];

  const photosB = useLiveQuery<PhotoAsset[]>(() =>
    rollBId ? db.photoAssets.where('rollId').equals(Number(rollBId)).toArray() : Promise.resolve([] as PhotoAsset[])
  , [rollBId]) || [];

  const [urls, setUrls] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    const newUrls: { [key: number]: string } = {};
    const objectUrls: string[] = [];
    [...photosA, ...photosB].forEach(p => {
      if (!p.id) return;
      // Prefer thumbnailUrl (S3 mode), fallback to local blob
      if (p.thumbnailUrl) {
        newUrls[p.id] = p.thumbnailUrl;
      } else if (p.blob) {
        const url = URL.createObjectURL(p.blob);
        objectUrls.push(url);
        newUrls[p.id] = url;
      }
    });
    setUrls(newUrls);
    return () => { objectUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [photosA, photosB]);

  const getRollLabel = (id: number) => {
    const roll = archivedRolls.find(r => r.id === id);
    if (!roll) return '';
    const cam = cameras.find(c => c.id === roll.cameraId)?.name || '';
    const film = filmStocks.find(f => f.id === roll.filmStockId);
    const filmName = film ? (film.isSystem === 1 ? '数码' : `${film.brand} ${film.name}`) : '';
    return `${cam}${filmName ? ` · ${filmName}` : ''}`;
  };

  return (
    <div className="main-content">
      {/* Hero Banner */}
      <div className="dashboard-hero">
        <div className="hero-title-row">
          <Film size={30} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
          <h1>控制中心</h1>
        </div>
        <p className="hero-subtitle">影像资产总览 · 花费分析 · 对比工作台</p>
      </div>

      {/* KPI Strip */}
      <div className="dashboard-kpi-strip">
        <motion.div className="kpi-glass-card kpi-gold" custom={0} initial="hidden" animate="visible" variants={cardVariants}>
          <div className="kpi-glow" />
          <div className="kpi-icon-wrap"><Film size={22} /></div>
          <div className="kpi-label">总拍摄卷</div>
          <div className="kpi-value">{totalRolls}</div>
          <div className="kpi-detail">{activeRolls} 进行中 · {archivedCount} 已归档</div>
        </motion.div>

        <motion.div className="kpi-glass-card kpi-sky" custom={1} initial="hidden" animate="visible" variants={cardVariants}>
          <div className="kpi-glow" />
          <div className="kpi-icon-wrap"><Image size={22} /></div>
          <div className="kpi-label">总照片数</div>
          <div className="kpi-value">{totalPhotos}</div>
          <div className="kpi-detail">平均 {totalRolls > 0 ? Math.round(totalPhotos / totalRolls) : 0} 张/卷</div>
        </motion.div>

        <motion.div className="kpi-glass-card kpi-emerald" custom={2} initial="hidden" animate="visible" variants={cardVariants}>
          <div className="kpi-glow" />
          <div className="kpi-icon-wrap"><DollarSign size={22} /></div>
          <div className="kpi-label">总投入费用</div>
          <div className="kpi-value">¥{totalCost.toFixed(0)}</div>
          <div className="kpi-detail">胶卷 ¥{totalFilmCost.toFixed(0)} · 冲洗 ¥{totalDevelopCost.toFixed(0)}</div>
        </motion.div>

        <motion.div className="kpi-glass-card kpi-rose" custom={3} initial="hidden" animate="visible" variants={cardVariants}>
          <div className="kpi-glow" />
          <div className="kpi-icon-wrap"><Camera size={22} /></div>
          <div className="kpi-label">器材总数</div>
          <div className="kpi-value">{cameras.length}</div>
          <div className="kpi-detail">相机 {cameras.length} 台</div>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-charts-section">
        <motion.div className="dash-chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="dash-chart-header">
            <TrendingUp size={18} />
            <h3>相机出勤排行</h3>
          </div>
          {cameraChartData.length === 0 ? (
            <p className="dash-chart-empty">暂无出勤记录</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cameraChartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#20222a', border: '1px solid #272930', borderRadius: 8, fontSize: 13 }}
                  cursor={{ fill: 'rgba(226,176,40,0.06)' }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20} name="出勤卷数">
                  {cameraChartData.map((_, i) => (
                    <Cell key={i} fill={barColors[i % barColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {enableFilmMode && (
          <motion.div className="dash-chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <div className="dash-chart-header">
              <Layers size={18} />
              <h3>彩色 vs 黑白胶片</h3>
            </div>
            {filmRolls.length === 0 ? (
              <p className="dash-chart-empty">暂无胶片数据</p>
            ) : (
              <div className="donut-layout">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <text x="50%" y="46%" textAnchor="middle" className="donut-center-label">{filmRolls.length}</text>
                    <text x="50%" y="60%" textAnchor="middle" className="donut-center-sub">胶卷总数</text>
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-legend">
                  <div className="donut-legend-item">
                    <div className="donut-swatch donut-swatch-color" />
                    <span>彩色 {colorCount} 卷 ({filmRolls.length > 0 ? Math.round((colorCount / filmRolls.length) * 100) : 0}%)</span>
                  </div>
                  <div className="donut-legend-item">
                    <div className="donut-swatch donut-swatch-bw" />
                    <span>黑白 {bwCount} 卷 ({filmRolls.length > 0 ? Math.round((bwCount / filmRolls.length) * 100) : 0}%)</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Compare Quick Access */}
      <div className="dashboard-compare-section">
        <motion.div className="compare-quick-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <div className="compare-quick-header">
            <div className="compare-quick-header-left">
              <Columns size={18} />
              <h3>对比工作台 · 快速通道</h3>
            </div>
            <button className="primary" onClick={() => onNavigate('compare')}>
              进入完整工作台 <ArrowRight size={14} />
            </button>
          </div>

          <div className="compare-quick-selectors">
            <div className="picker-group">
              <label>A路 拍摄卷</label>
              <select className="form-control" value={rollAId} onChange={e => setRollAId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">-- 选择A路胶卷 --</option>
                {archivedRolls.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({getRollLabel(r.id!)})</option>
                ))}
              </select>
            </div>
            <div className="picker-group">
              <label>B路 拍摄卷</label>
              <select className="form-control" value={rollBId} onChange={e => setRollBId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">-- 选择B路胶卷 --</option>
                {archivedRolls.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({getRollLabel(r.id!)})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="compare-preview-strip">
            <div className="preview-column">
              <div className="preview-column-label">A路 预览</div>
              {photosA.length > 0 ? (
                <div className="preview-thumbs">
                  {photosA.slice(0, 6).map(p => (
                    <img key={p.id} src={urls[p.id!]} alt={p.originalFileName} />
                  ))}
                </div>
              ) : (
                <div className="preview-empty">{rollAId ? '此卷暂无照片' : '请选择 A路 胶卷'}</div>
              )}
            </div>
            <div className="preview-column">
              <div className="preview-column-label">B路 预览</div>
              {photosB.length > 0 ? (
                <div className="preview-thumbs">
                  {photosB.slice(0, 6).map(p => (
                    <img key={p.id} src={urls[p.id!]} alt={p.originalFileName} />
                  ))}
                </div>
              ) : (
                <div className="preview-empty">{rollBId ? '此卷暂无照片' : '请选择 B路 胶卷'}</div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
