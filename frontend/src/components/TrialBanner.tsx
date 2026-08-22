import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, X, CloudUpload } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { AUTH_ROUTES } from '../services/authFlow';
import { useLanguage } from '../contexts/useLanguage';
import './TrialBanner.css';

const TRIAL_BANNER_DISMISSED_KEY = 'grainfolio_trial_banner_dismissed';

export const TrialBanner: React.FC = () => {
  const { isTrial } = useAuth();
  const { t } = useLanguage();
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
          {t('trial.bannerPrefix')}<strong>{t('trial.localMode')}</strong>{t('trial.bannerSuffix')}
        </span>
      </div>
      <div className="trial-banner-actions">
        <Link to={`${AUTH_ROUTES.signup}?trial=1`} className="trial-banner-btn">
          <CloudUpload size={14} />
          <span>{t('trial.signupCloud')}</span>
        </Link>
        <button 
          type="button" 
          className="trial-banner-close" 
          onClick={handleDismiss}
          title={t('trial.dismissBanner')}
          aria-label={t('trial.dismissBanner')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
