export interface FilmEdgePreset {
  brand: string;
  format: '135' | '120';
  topText: string;
  bottomText: string;
}

// First-batch brand-level fallback edge markings — decorative brand/frame-marker
// text only. Not a claim about any real DX code, emulsion batch, or era; a given
// brand's actual printed edge varies by stock and decade, which is exactly why
// this stays a generic per-brand fallback rather than a per-FilmStock property.
export const FILM_EDGE_PRESETS: FilmEdgePreset[] = [
  { brand: 'Kodak', format: '135', topText: 'KODAK', bottomText: 'KODAK' },
  { brand: 'Kodak', format: '120', topText: 'KODAK', bottomText: 'KODAK' },
  { brand: 'Fujifilm', format: '135', topText: 'FUJIFILM', bottomText: 'FUJIFILM' },
  { brand: 'Fujifilm', format: '120', topText: 'FUJIFILM', bottomText: 'FUJIFILM' },
  { brand: 'Ilford', format: '135', topText: 'ILFORD', bottomText: 'ILFORD' },
  { brand: 'Ilford', format: '120', topText: 'ILFORD', bottomText: 'ILFORD' },
  { brand: 'CineStill', format: '135', topText: 'CINESTILL', bottomText: 'CINESTILL' },
  { brand: 'CineStill', format: '120', topText: 'CINESTILL', bottomText: 'CINESTILL' },
  { brand: 'Lomography', format: '135', topText: 'LOMOGRAPHY', bottomText: 'LOMOGRAPHY' },
  { brand: 'Lomography', format: '120', topText: 'LOMOGRAPHY', bottomText: 'LOMOGRAPHY' },
  { brand: 'ORWO', format: '135', topText: 'ORWO', bottomText: 'ORWO' },
  { brand: 'ORWO', format: '120', topText: 'ORWO', bottomText: 'ORWO' },
  { brand: 'Foma', format: '135', topText: 'FOMAPAN', bottomText: 'FOMAPAN' },
  { brand: 'Foma', format: '120', topText: 'FOMAPAN', bottomText: 'FOMAPAN' },
  { brand: 'Rollei', format: '135', topText: 'ROLLEI', bottomText: 'ROLLEI' },
  { brand: 'Rollei', format: '120', topText: 'ROLLEI', bottomText: 'ROLLEI' },
  { brand: 'Shanghai', format: '135', topText: 'SHANGHAI', bottomText: 'SHANGHAI' },
  { brand: 'Shanghai', format: '120', topText: 'SHANGHAI', bottomText: 'SHANGHAI' },
  { brand: 'Lucky', format: '135', topText: 'LUCKY', bottomText: 'LUCKY' },
  { brand: 'Lucky', format: '120', topText: 'LUCKY', bottomText: 'LUCKY' },
];

export const GENERIC_FILM_EDGE_PRESET: Record<'135' | '120', FilmEdgePreset> = {
  '135': { brand: 'Generic', format: '135', topText: 'FILM', bottomText: 'FILM' },
  '120': { brand: 'Generic', format: '120', topText: 'FILM', bottomText: 'FILM' },
};
