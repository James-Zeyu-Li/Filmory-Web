import { describe, expect, it } from 'vitest';
import type { Camera, FilmBack, Roll } from '../db/schema';
import {
  getCompatibleFilmBacks,
  getLoadedFilmBackIds,
  isFilmBackAvailable,
  isInterchangeable120Camera
} from '../services/filmBackService';

describe('120 film back workflow rules', () => {
  const cameras: Camera[] = [
    {
      id: 'cam-500cm',
      userId: 'user-a',
      name: 'Hasselblad 500CM',
      type: 'film',
      format: '120',
      cameraSystemId: 'system-hassy-v',
      backType: 'interchangeable',
      addedAt: 1
    },
    {
      id: 'cam-135',
      userId: 'user-a',
      name: 'Leica M6',
      type: 'film',
      format: '135',
      backType: 'fixed',
      addedAt: 2
    }
  ];

  const backs: FilmBack[] = [
    {
      id: 'back-a12',
      userId: 'user-a',
      cameraSystemId: 'system-hassy-v',
      name: 'A12 Back',
      format: '120',
      status: 'active',
      addedAt: 3
    },
    {
      id: 'back-rb',
      userId: 'user-a',
      cameraSystemId: 'system-rb67',
      name: '6x7 Back',
      format: '120',
      status: 'active',
      addedAt: 4
    }
  ];

  it('requires a back only for 120 interchangeable cameras', () => {
    expect(isInterchangeable120Camera(cameras[0])).toBe(true);
    expect(isInterchangeable120Camera(cameras[1])).toBe(false);
  });

  it('returns backs compatible with the selected camera system only', () => {
    const compatible = getCompatibleFilmBacks(cameras, backs, ['cam-500cm']);

    expect(compatible).toHaveLength(1);
    expect(compatible[0].id).toBe('back-a12');
  });

  it('prevents loading two active rolls into the same back', () => {
    const rolls: Roll[] = [
      {
        id: 'roll-a',
        userId: 'user-a',
        name: 'Portra 400',
        cameraIds: ['cam-500cm'],
        filmBackId: 'back-a12',
        filmStockId: 'film-a',
        status: 'active',
        addedAt: 5
      } as Roll
    ];

    expect(getLoadedFilmBackIds(rolls).has('back-a12')).toBe(true);
    expect(isFilmBackAvailable(rolls, 'back-a12')).toBe(false);
    expect(isFilmBackAvailable(rolls, 'back-a12', 'roll-a')).toBe(true);
  });
});
