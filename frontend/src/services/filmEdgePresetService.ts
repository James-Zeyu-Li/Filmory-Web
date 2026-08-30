import type { FilmStock, Roll } from '../db/schema';
import { FILM_EDGE_PRESETS, GENERIC_FILM_EDGE_PRESET, type FilmEdgePreset } from '../catalog/gear';

export interface ResolvedFilmEdgePreset {
  preset: FilmEdgePreset;
  format: '135' | '120';
}

const toGenericFormat = (format: string | undefined): '135' | '120' => (format === '120' ? '120' : '135');

/**
 * Match order: exact brand-level fallback for the roll's film stock -> Generic
 * (135 or 120, based on whatever format is known) -> Generic 135 as the final
 * catch-all. No manual per-roll override yet (Phase 3) — this only derives
 * from the roll's existing `filmStockId`, no new persisted state.
 */
export const resolveFilmEdgePreset = (
  roll: Pick<Roll, 'filmStockId'>,
  filmStocks: readonly FilmStock[],
): ResolvedFilmEdgePreset => {
  const filmStock = roll.filmStockId
    ? filmStocks.find(film => film.id === roll.filmStockId)
    : undefined;

  const isRegisteredFilm = Boolean(filmStock) && filmStock!.isSystem === 0;
  const format = toGenericFormat(filmStock?.format);

  if (isRegisteredFilm) {
    const brandMatch = FILM_EDGE_PRESETS.find(
      entry => entry.brand.toLowerCase() === filmStock!.brand.trim().toLowerCase() && entry.format === format,
    );
    if (brandMatch) return { preset: brandMatch, format };
  }

  return { preset: GENERIC_FILM_EDGE_PRESET[format], format };
};
