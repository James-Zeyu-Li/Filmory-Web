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

export const TRIAL_RESOURCE_LABELS: Record<TrialResourceKey, string> = {
  cameras: '相机',
  lenses: '镜头',
  filmStocks: '胶卷库存',
  otherEquipments: '其他器材',
  rolls: '拍摄卷',
  collections: '项目集',
  albums: '相册',
  photos: '照片',
};

export const canCreateTrialResource = (currentCount: number) => (
  currentCount < TRIAL_RESOURCE_LIMIT
);

export const getTrialLimitMessage = (resource: TrialResourceKey) => (
  `试用模式下 ${TRIAL_RESOURCE_LABELS[resource]} 最多可以创建 ${TRIAL_RESOURCE_LIMIT} 个。注册后可以继续完整记录。`
);
