import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, X, CloudUpload } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import './TrialBanner.css';

const TRIAL_BANNER_DISMISSED_KEY = 'filmory_trial_banner_dismissed';

export const TrialBanner: React.FC = () => {
  const { isTrial } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(TRIAL_BANNER_DISMISSED_KEY) === 'true';
  });

  const handleDismiss = () => {
    window.sessionStorage.setItem(TRIAL_BANNER_DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  if (!isTrial || dismissed) {
    return null;
  }

  return (
    <div className="trial-banner">
      <div className="trial-banner-content">
        <Info className="trial-banner-icon" size={16} />
        <span className="trial-banner-text">
          当前处于<strong>本地试用模式</strong>，数据仅保存在当前设备。
        </span>
      </div>
      <div className="trial-banner-actions">
        <Link to="/login?mode=signup&trial=1" className="trial-banner-btn">
          <CloudUpload size={14} />
          <span>免费注册并开启云同步</span>
        </Link>
        <button 
          type="button" 
          className="trial-banner-close" 
          onClick={handleDismiss}
          title="关闭提示"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
