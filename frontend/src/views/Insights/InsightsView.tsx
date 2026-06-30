import React, { useState } from 'react';
import { BarChart2, Wallet } from 'lucide-react';
import { StatsView } from '../Stats/StatsView';
import { FinanceView } from '../Finance/FinanceView';

export const InsightsView: React.FC<{ enableFilmMode: boolean }> = ({ enableFilmMode }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'finance'>('stats');

  return (
    <div className="main-content">
      {/* Unified Header */}
      <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon">
            <BarChart2 size={20} />
          </div>
          <div className="view-header-text-group">
            <h1>数据与财务 (Insights)</h1>
            <p className="view-header-subtitle">全方位分析您的摄影数据与开销情况。</p>
          </div>
        </div>
        <div className="view-header-actions">
          <div className="tab-navigation" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
              <BarChart2 size={16} />
              数据分析
            </button>
            <button className={`tab-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
              <Wallet size={16} />
              财务看板
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'stats' && <StatsView enableFilmMode={enableFilmMode} isEmbedded />}
      {activeTab === 'finance' && <FinanceView isEmbedded />}
    </div>
  );
};
