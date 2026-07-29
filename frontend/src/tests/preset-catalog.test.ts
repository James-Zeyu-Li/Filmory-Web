import { describe, expect, it } from 'vitest';
import { COMMON_CAMERAS, COMMON_FILM_STOCKS, COMMON_LENSES } from '../catalog/gear';

describe('gear preset catalogs', () => {
  it('keeps camera presets aligned with the camera builder schema', () => {
    expect(COMMON_CAMERAS.length).toBeGreaterThan(40);
    expect(COMMON_CAMERAS.every(camera => camera.brand.trim().length > 0)).toBe(true);
    expect(COMMON_CAMERAS.every(camera => camera.model.trim().length > 0)).toBe(true);
    expect(COMMON_CAMERAS.every(camera => camera.type === 'film' || camera.type === 'digital')).toBe(true);
    expect(COMMON_CAMERAS.every(camera => ['135', '120', 'digital'].includes(camera.format))).toBe(true);

    const mediumFormatCameras = COMMON_CAMERAS.filter(camera => camera.format === '120');
    expect(mediumFormatCameras.length).toBeGreaterThan(0);
    expect(mediumFormatCameras.every(camera => camera.backType === 'fixed' || camera.backType === 'interchangeable')).toBe(true);
    expect(mediumFormatCameras
      .filter(camera => camera.backType === 'interchangeable')
      .every(camera => Boolean(camera.cameraSystemName?.trim()) && Array.isArray(camera.backs) && camera.backs.length > 0)
    ).toBe(true);
  });

  it('keeps film stock presets aligned with the film stock schema', () => {
    expect(COMMON_FILM_STOCKS.length).toBeGreaterThan(40);
    expect(COMMON_FILM_STOCKS.every(stock => stock.brand.trim().length > 0)).toBe(true);
    expect(COMMON_FILM_STOCKS.every(stock => stock.name.trim().length > 0)).toBe(true);
    expect(COMMON_FILM_STOCKS.every(stock => Number.isFinite(stock.iso) && stock.iso > 0)).toBe(true);
    expect(COMMON_FILM_STOCKS.every(stock => stock.format === '135' || stock.format === '120')).toBe(true);
    expect(COMMON_FILM_STOCKS.every(stock => stock.colorType === 'color' || stock.colorType === 'bw')).toBe(true);
    expect(COMMON_FILM_STOCKS.some(stock => stock.format === '120')).toBe(true);
    expect(COMMON_FILM_STOCKS.some(stock => stock.brand === 'Shanghai')).toBe(true);
  });

  it('keeps lens presets ready for mount compatibility hints', () => {
    expect(COMMON_LENSES.length).toBeGreaterThan(25);
    expect(COMMON_LENSES.every(lens => lens.brand.trim().length > 0)).toBe(true);
    expect(COMMON_LENSES.every(lens => lens.model.trim().length > 0)).toBe(true);
    expect(COMMON_LENSES.every(lens => Number.isFinite(lens.focalLength) && lens.focalLength > 0)).toBe(true);
    expect(COMMON_LENSES.every(lens => lens.maxAperture.trim().length > 0)).toBe(true);
    expect(COMMON_LENSES.every(lens => lens.type === 'prime' || lens.type === 'zoom')).toBe(true);
    expect(COMMON_LENSES.every(lens => lens.mountKey.trim().length > 0)).toBe(true);
    expect(COMMON_LENSES.some(lens => lens.mountKey === 'leica-m')).toBe(true);
    expect(COMMON_LENSES.some(lens => lens.mountKey === 'hasselblad-v')).toBe(true);
  });
});
