import React, { useEffect, useState } from 'react';
import { BarChart2, Wallet } from 'lucide-react';
import { StatsView } from '../Stats/StatsView';
import { FinanceView } from '../Finance/FinanceView';
import { INSIGHTS_TAB_KEY } from '../../services/workspacePreferences';
import './InsightsView.css';

type InsightsTab = 'stats' | 'finance';

const isInsightsTab = (value: string | null): value is InsightsTab => {
  return value === 'stats' || value === 'finance';
};

export const InsightsView: React.FC<{ enableFilmMode: boolean }> = ({ enableFilmMode }) => {
  const [activeTab, setActiveTab] = useState<InsightsTab>(() => {
    const savedTab = localStorage.getItem(INSIGHTS_TAB_KEY);
    return isInsightsTab(savedTab) ? savedTab : 'stats';
  });

  useEffect(() => {
    localStorage.setItem(INSIGHTS_TAB_KEY, activeTab);
  }, [activeTab]);

  return (
    <div className="main-content">
      {/* Unified Header */}
      <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon">
            <BarChart2 size={20} />
          </div>
          <div className="view-header-text-group">
            <h1>统计与花费</h1>
            <p className="view-header-subtitle">从拍摄数量到日常开支，把摄影相关的数据放在一起查看。</p>
          </div>
        </div>
        <div className="view-header-actions">
          <div className="tab-navigation insights-tab-navigation">
            <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
              <BarChart2 size={16} />
              拍摄统计
            </button>
            <button className={`tab-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
              <Wallet size={16} />
              摄影账本
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'stats' && <StatsView enableFilmMode={enableFilmMode} isEmbedded />}
      {activeTab === 'finance' && <FinanceView isEmbedded />}
    </div>
  );
};
