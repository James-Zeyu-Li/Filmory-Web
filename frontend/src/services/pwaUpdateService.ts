import { registerSW } from 'virtual:pwa-register';

export const PWA_UPDATE_READY_EVENT = 'filmory-pwa-update-ready';
const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface PwaUpdateReadyDetail {
  update: () => void;
}

let hasRegisteredServiceWorker = false;
let updateCheckTimer: number | null = null;

export const registerFilmoryServiceWorker = () => {
  if (hasRegisteredServiceWorker || !('serviceWorker' in navigator)) return;
  hasRegisteredServiceWorker = true;

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent<PwaUpdateReadyDetail>(PWA_UPDATE_READY_EVENT, {
        detail: {
          update: () => {
            void updateServiceWorker(true);
          },
        },
      }));
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration || updateCheckTimer !== null) return;
      updateCheckTimer = window.setInterval(() => {
        if (navigator.onLine) {
          void registration.update();
        }
      }, PWA_UPDATE_CHECK_INTERVAL_MS);
    },
  });
};
