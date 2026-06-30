import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useAuth } from '../contexts/useAuth';

const EMPTY_ARRAY: any[] = [];

/**
 * 核心数据访问层 Hooks (Data Access Layer)
 * 在工业级架构中，将数据库查询逻辑从视图组件中剥离，集中管理。
 * 防止内存泄漏，支持离线-First的响应式更新，以及多租户数据隔离隔离。
 */

export const useCameras = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.cameras.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const useLenses = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.lenses.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const useFilmStocks = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.filmStocks.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const useRolls = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.rolls.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const usePhotoAssets = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.photoAssets.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const useOtherEquipments = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.otherEquipments.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const useAlbums = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.albums.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const useAlbumPhotos = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.albumPhotos.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const useTagConfigs = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.tagConfigs.where('userId').equals(user.id).toArray() : [], [user]) ?? EMPTY_ARRAY;
};

export const useUserProfile = () => {
  const { user } = useAuth();
  return useLiveQuery(() => user ? db.userProfiles.get(user.id) : undefined, [user]);
};

export const useCollections = () => {
  const { user } = useAuth();
  return useLiveQuery(() => db.collections.where('userId').equals(user?.id || 'offline').reverse().sortBy('addedAt'), [user?.id]) || [];
};
