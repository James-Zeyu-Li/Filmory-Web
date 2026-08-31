import { Film, UploadCloud } from 'lucide-react';
import { useLanguage } from '../../contexts/useLanguage';
import { Button } from '../../components/ui/Button';

interface DashboardWelcomeProps {
  onStartFresh: () => void;
  onImportHistory: () => void;
}

export const DashboardWelcome: React.FC<DashboardWelcomeProps> = ({ onStartFresh, onImportHistory }) => {
  const { t } = useLanguage();

  return (
    <div className="dashboard-welcome">
      <h2>{t('dashboard.welcomeTitle')}</h2>
      <p>{t('dashboard.welcomeDesc')}</p>
      <div className="dashboard-welcome-actions">
        <Button variant="primary" icon={<Film size={16} />} onClick={onStartFresh}>
          {t('dashboard.welcomeStartFresh')}
        </Button>
        <Button variant="secondary" icon={<UploadCloud size={16} />} onClick={onImportHistory}>
          {t('dashboard.welcomeImportHistory')}
        </Button>
      </div>
    </div>
  );
};
