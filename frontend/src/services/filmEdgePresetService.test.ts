import { describe, expect, it } from 'vitest';
import type { FilmStock } from '../db/schema';
import { resolveFilmEdgePreset } from './filmEdgePresetService';

const film = (overrides: Partial<FilmStock> = {}): FilmStock => ({
  id: 'film-1', brand: 'Kodak', name: 'Portra 400', iso: 400, colorType: 'color',
  format: '135', isSystem: 0, addedAt: 1, ...overrides,
});

describe('resolveFilmEdgePreset', () => {
  it('matches an exact brand+format fallback preset', () => {
    const result = resolveFilmEdgePreset({ filmStockId: 'film-1' }, [film()]);
    expect(result).toEqual({ preset: { brand: 'Kodak', format: '135', topText: 'KODAK', bottomText: 'KODAK' }, format: '135' });
  });

  it('matches the 120 variant of the same brand for a 120 film stock', () => {
    const rolls = [film({ format: '120' })];
    const result = resolveFilmEdgePreset({ filmStockId: 'film-1' }, rolls);
    expect(result.preset.brand).toBe('Kodak');
    expect(result.format).toBe('120');
  });

  it('falls back to Generic for a brand with no fallback preset', () => {
    const result = resolveFilmEdgePreset({ filmStockId: 'film-1' }, [film({ brand: 'Some Obscure Brand' })]);
    expect(result.preset.brand).toBe('Generic');
    expect(result.format).toBe('135');
  });

  it('falls back to Generic for a digital placeholder film stock', () => {
    const result = resolveFilmEdgePreset({ filmStockId: 'film-1' }, [film({ isSystem: 1, brand: 'Kodak' })]);
    expect(result.preset.brand).toBe('Generic');
  });

  it('falls back to Generic 135 when the roll has no filmStockId at all', () => {
    const result = resolveFilmEdgePreset({ filmStockId: undefined }, [film()]);
    expect(result).toEqual({ preset: { brand: 'Generic', format: '135', topText: 'FILM', bottomText: 'FILM' }, format: '135' });
  });

  it('falls back to Generic when filmStockId references a film stock that no longer exists', () => {
    const result = resolveFilmEdgePreset({ filmStockId: 'deleted-film' }, [film()]);
    expect(result.preset.brand).toBe('Generic');
  });

  it('brand matching is case-insensitive', () => {
    const result = resolveFilmEdgePreset({ filmStockId: 'film-1' }, [film({ brand: 'kodak' })]);
    expect(result.preset.brand).toBe('Kodak');
  });
});
