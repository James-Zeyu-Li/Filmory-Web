import { Camera as CameraIcon, ChevronRight } from 'lucide-react';
import type { ArchiveHighlight } from '../../services/archiveHighlightService';
import { useLanguage } from '../../contexts/useLanguage';

interface ShootingHighlightCardProps {
  highlight: ArchiveHighlight;
  onViewInsights: () => void;
}

export const ShootingHighlightCard: React.FC<ShootingHighlightCardProps> = ({ highlight, onViewInsights }) => {
  const { t } = useLanguage();

  if (highlight.kind === 'empty') return null;

  let text: string;
  switch (highlight.kind) {
    case 'comparison':
      text = t('dashboard.highlightComparison', {
        camera: highlight.camera.name,
        delta: highlight.currentCount - highlight.previousCount,
      });
      break;
    case 'currentMonthFact':
      text = t('dashboard.highlightCurrentMonthFact', { camera: highlight.camera.name, count: highlight.currentCount });
      break;
    case 'currentMonthGeneric':
      text = t('dashboard.highlightCurrentMonthGeneric', { count: highlight.currentCount });
      break;
    case 'recentShoot':
      text = t('dashboard.highlightRecentShoot', { camera: highlight.camera.name, days: highlight.daysSince });
      break;
    case 'recentShootGeneric':
      text = t('dashboard.highlightRecentShootGeneric', { days: highlight.daysSince });
      break;
    case 'allTime':
      text = t('dashboard.highlightAllTime', { camera: highlight.camera.name, count: highlight.totalCount });
      break;
    case 'allTimeGeneric':
      text = t('dashboard.highlightAllTimeGeneric', { count: highlight.totalCount });
      break;
  }

  return (
    <button type="button" className="shooting-highlight-card" onClick={onViewInsights}>
      <div className="shooting-highlight-icon"><CameraIcon size={20} /></div>
      <div className="shooting-highlight-body">
        <p className="shooting-highlight-text">{text}</p>
        <span className="shooting-highlight-cta">{t('dashboard.highlightViewInsights')}</span>
      </div>
      <ChevronRight size={20} className="shooting-highlight-chevron" aria-hidden="true" />
    </button>
  );
};
