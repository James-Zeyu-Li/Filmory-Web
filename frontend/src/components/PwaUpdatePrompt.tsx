import { useEffect } from 'react';
import { useFeedback } from '../contexts/useFeedback';
import { useLanguage } from '../contexts/useLanguage';
import { PWA_UPDATE_READY_EVENT, type PwaUpdateReadyDetail } from '../services/pwaUpdateService';

export const PwaUpdatePrompt = () => {
  const { notify } = useFeedback();
  const { t } = useLanguage();

  useEffect(() => {
    const handleUpdateReady = (event: Event) => {
      const update = (event as CustomEvent<PwaUpdateReadyDetail>).detail?.update;
      if (!update) return;

      notify({
        type: 'info',
        title: t('pwa.updateTitle'),
        message: t('pwa.updateMessage'),
        durationMs: 0,
        actions: [
          {
            label: t('pwa.updateNow'),
            variant: 'primary',
            onClick: update,
          },
          {
            label: t('pwa.updateLater'),
            variant: 'secondary',
            onClick: () => undefined,
          },
        ],
      });
    };

    window.addEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady);
    return () => {
      window.removeEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady);
    };
  }, [notify, t]);

  return null;
};
