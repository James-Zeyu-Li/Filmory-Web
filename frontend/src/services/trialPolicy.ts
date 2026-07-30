import type { TranslationKey } from '../i18n/translations';

export const TRIAL_USER_ID = 'trial_local_user';
export const TRIAL_USER_EMAIL = 'trial@filmory.local';
export const TRIAL_RESOURCE_LIMIT = 1;

export type TrialResourceKey =
  | 'cameras'
  | 'lenses'
  | 'filmStocks'
  | 'otherEquipments'
  | 'rolls'
  | 'collections'
  | 'albums'
  | 'photos';

export const TRIAL_RESOURCE_LABEL_KEYS: Record<TrialResourceKey, TranslationKey> = {
  cameras: 'trial.resource.cameras',
  lenses: 'trial.resource.lenses',
  filmStocks: 'trial.resource.filmStocks',
  otherEquipments: 'trial.resource.otherEquipments',
  rolls: 'trial.resource.rolls',
  collections: 'trial.resource.collections',
  albums: 'trial.resource.albums',
  photos: 'trial.resource.photos',
};

export const canCreateTrialResource = (currentCount: number) => (
  currentCount < TRIAL_RESOURCE_LIMIT
);

export const getTrialLimitMessage = (
  resource: TrialResourceKey,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
) => (
  t('trial.limitMessage', {
    resource: t(TRIAL_RESOURCE_LABEL_KEYS[resource]),
    limit: TRIAL_RESOURCE_LIMIT,
  })
);
