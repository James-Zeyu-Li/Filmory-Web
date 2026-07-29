import type { Camera, CameraSystem, FilmBack, Roll } from '../db/schema';

export const isInterchangeable120Camera = (camera?: Camera) => {
  return camera?.format === '120' && camera.backType === 'interchangeable' && Boolean(camera.cameraSystemId);
};

export const getCompatibleFilmBacks = (
  cameras: Camera[],
  filmBacks: FilmBack[],
  selectedCameraIds: string[]
) => {
  const selectedSystems = new Set(
    selectedCameraIds
      .map(id => cameras.find(camera => camera.id === id))
      .filter((camera): camera is Camera => isInterchangeable120Camera(camera))
      .map(camera => camera.cameraSystemId)
      .filter((id): id is string => Boolean(id))
  );

  return filmBacks.filter(back => back.status !== 'archived' && selectedSystems.has(back.cameraSystemId));
};

export const getLoadedFilmBackIds = (rolls: Roll[], excludeRollId?: string) => {
  return new Set(
    rolls
      .filter(roll => roll.status === 'active' && roll.id !== excludeRollId && Boolean(roll.filmBackId))
      .map(roll => roll.filmBackId as string)
  );
};

export const isFilmBackAvailable = (rolls: Roll[], filmBackId: string, excludeRollId?: string) => {
  return !getLoadedFilmBackIds(rolls, excludeRollId).has(filmBackId);
};

export const getCameraSystemName = (cameraSystems: CameraSystem[], systemId?: string) => {
  return cameraSystems.find(system => system.id === systemId)?.name || '未命名系统';
};
