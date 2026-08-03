export const LOCAL_CHANGE_EVENT = 'grainfolio-sync-request';

export type SyncIntent = 'debounced' | 'immediate' | 'background';

type SyncIntentEventDetail = {
  intent?: SyncIntent;
  source?: string;
};

const isSyncIntent = (value: unknown): value is SyncIntent => (
  value === 'debounced' || value === 'immediate' || value === 'background'
);

export const getSyncIntentFromEvent = (event: Event): SyncIntent => {
  const detail = (event as CustomEvent<SyncIntentEventDetail>).detail;
  return isSyncIntent(detail?.intent) ? detail.intent : 'debounced';
};

export const requestSyncIntent = (
  intent: SyncIntent = 'debounced',
  source?: string,
): void => {
  window.dispatchEvent(new CustomEvent<SyncIntentEventDetail>(LOCAL_CHANGE_EVENT, {
    detail: { intent, source },
  }));
};

export const requestImmediateSync = (source?: string): void => {
  requestSyncIntent('immediate', source);
};
