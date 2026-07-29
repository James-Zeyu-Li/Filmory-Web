export interface CommonFilmStockPreset {
  brand: string;
  name: string;
  iso: number;
  colorType: 'color' | 'bw';
  format: '135' | '120';
}

type RawCommonFilmStockPreset = Omit<CommonFilmStockPreset, 'format'> & {
  format?: CommonFilmStockPreset['format'];
};

const RAW_COMMON_FILM_STOCKS: RawCommonFilmStockPreset[] = [
  // ─────────────────────────────────────────────
  // Kodak — Color Negative
  // ─────────────────────────────────────────────
  { brand: 'Kodak', name: 'ColorPlus 200', iso: 200, colorType: 'color' },
  { brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color' },
  { brand: 'Kodak', name: 'Gold 400', iso: 400, colorType: 'color' },
  { brand: 'Kodak', name: 'ProImage 100', iso: 100, colorType: 'color' },
  { brand: 'Kodak', name: 'Ultramax 400', iso: 400, colorType: 'color' },
  { brand: 'Kodak', name: 'Portra 160', iso: 160, colorType: 'color' },
  { brand: 'Kodak', name: 'Portra 400', iso: 400, colorType: 'color' },
  { brand: 'Kodak', name: 'Portra 800', iso: 800, colorType: 'color' },
  { brand: 'Kodak', name: 'Ektar 100', iso: 100, colorType: 'color' },
  { brand: 'Kodak', name: 'Vision3 50D', iso: 50, colorType: 'color' },
  { brand: 'Kodak', name: 'Vision3 250D', iso: 250, colorType: 'color' },
  { brand: 'Kodak', name: 'Vision3 500T', iso: 500, colorType: 'color' },

  // Kodak — Black & White
  { brand: 'Kodak', name: 'Tri-X 400 (TX400)', iso: 400, colorType: 'bw' },
  { brand: 'Kodak', name: 'T-Max 100', iso: 100, colorType: 'bw' },
  { brand: 'Kodak', name: 'T-Max 400', iso: 400, colorType: 'bw' },
  { brand: 'Kodak', name: 'T-Max P3200', iso: 3200, colorType: 'bw' },
  { brand: 'Kodak', name: 'Double-X (5222)', iso: 250, colorType: 'bw' },
  { brand: 'Kodak', name: 'Ektachrome E100', iso: 100, colorType: 'color' }, // Slide/Reversal

  // ─────────────────────────────────────────────
  // Fujifilm — Color Negative
  // ─────────────────────────────────────────────
  { brand: 'Fujifilm', name: 'C200', iso: 200, colorType: 'color' },
  { brand: 'Fujifilm', name: '200', iso: 200, colorType: 'color' },
  { brand: 'Fujifilm', name: '400', iso: 400, colorType: 'color' },
  { brand: 'Fujifilm', name: 'Fujicolor 100', iso: 100, colorType: 'color' },
  { brand: 'Fujifilm', name: 'Superia X-TRA 400', iso: 400, colorType: 'color' },
  { brand: 'Fujifilm', name: 'Superia Premium 400', iso: 400, colorType: 'color' },
  { brand: 'Fujifilm', name: 'Pro 400H', iso: 400, colorType: 'color' },
  { brand: 'Fujifilm', name: 'Reala 100', iso: 100, colorType: 'color' },

  // Fujifilm — Black & White
  { brand: 'Fujifilm', name: 'Neopan Acros 100 II', iso: 100, colorType: 'bw' },
  { brand: 'Fujifilm', name: 'Neopan 400', iso: 400, colorType: 'bw' },

  // Fujifilm — Slide (Reversal)
  { brand: 'Fujifilm', name: 'Provia 100F', iso: 100, colorType: 'color' },
  { brand: 'Fujifilm', name: 'Velvia 50', iso: 50, colorType: 'color' },
  { brand: 'Fujifilm', name: 'Velvia 100', iso: 100, colorType: 'color' },
  { brand: 'Fujifilm', name: 'Astia 100F', iso: 100, colorType: 'color' },

  // ─────────────────────────────────────────────
  // Ilford — Black & White
  // ─────────────────────────────────────────────
  { brand: 'Ilford', name: 'Pan F Plus 50', iso: 50, colorType: 'bw' },
  { brand: 'Ilford', name: 'FP4 Plus 125', iso: 125, colorType: 'bw' },
  { brand: 'Ilford', name: 'HP5 Plus 400', iso: 400, colorType: 'bw' },
  { brand: 'Ilford', name: 'Delta 100 Professional', iso: 100, colorType: 'bw' },
  { brand: 'Ilford', name: 'Delta 400 Professional', iso: 400, colorType: 'bw' },
  { brand: 'Ilford', name: 'Delta 3200 Professional', iso: 3200, colorType: 'bw' },
  { brand: 'Ilford', name: 'XP2 Super 400 (C41)', iso: 400, colorType: 'bw' },
  { brand: 'Ilford', name: 'SFX 200', iso: 200, colorType: 'bw' },
  { brand: 'Ilford', name: 'Ortho Plus 80', iso: 80, colorType: 'bw' },
  { brand: 'Ilford', name: 'Kentmere 100', iso: 100, colorType: 'bw' },
  { brand: 'Ilford', name: 'Kentmere 400', iso: 400, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // CineStill
  // ─────────────────────────────────────────────
  { brand: 'CineStill', name: '50D', iso: 50, colorType: 'color' },
  { brand: 'CineStill', name: '400D', iso: 400, colorType: 'color' },
  { brand: 'CineStill', name: '800T', iso: 800, colorType: 'color' },
  { brand: 'CineStill', name: 'BwXX (Double-X)', iso: 250, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Lomography
  // ─────────────────────────────────────────────
  { brand: 'Lomography', name: 'Color Negative 100', iso: 100, colorType: 'color' },
  { brand: 'Lomography', name: 'Color Negative 400', iso: 400, colorType: 'color' },
  { brand: 'Lomography', name: 'Color Negative 800', iso: 800, colorType: 'color' },
  { brand: 'Lomography', name: 'LomoChrome Purple', iso: 400, colorType: 'color' },
  { brand: 'Lomography', name: 'LomoChrome Metropolis', iso: 400, colorType: 'color' },
  { brand: 'Lomography', name: 'LomoChrome Turquoise', iso: 400, colorType: 'color' },
  { brand: 'Lomography', name: 'Redscale XR 50-200', iso: 200, colorType: 'color' },
  { brand: 'Lomography', name: 'Earl Grey B&W 100', iso: 100, colorType: 'bw' },
  { brand: 'Lomography', name: 'Lady Grey B&W 400', iso: 400, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Fomapan (Foma Bohemia) — Black & White
  // ─────────────────────────────────────────────
  { brand: 'Fomapan', name: '100 Classic', iso: 100, colorType: 'bw' },
  { brand: 'Fomapan', name: '200 Creative', iso: 200, colorType: 'bw' },
  { brand: 'Fomapan', name: '400 Action', iso: 400, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Rollei — Black & White
  // ─────────────────────────────────────────────
  { brand: 'Rollei', name: 'Retro 80S', iso: 80, colorType: 'bw' },
  { brand: 'Rollei', name: 'Retro 400S', iso: 400, colorType: 'bw' },
  { brand: 'Rollei', name: 'RPX 25', iso: 25, colorType: 'bw' },
  { brand: 'Rollei', name: 'RPX 100', iso: 100, colorType: 'bw' },
  { brand: 'Rollei', name: 'RPX 400', iso: 400, colorType: 'bw' },
  { brand: 'Rollei', name: 'Ortho 25', iso: 25, colorType: 'bw' },
  { brand: 'Rollei', name: 'Infrared 400', iso: 400, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // AgfaPhoto
  // ─────────────────────────────────────────────
  { brand: 'AgfaPhoto', name: 'Vista Plus 200', iso: 200, colorType: 'color' },
  { brand: 'AgfaPhoto', name: 'APX 100', iso: 100, colorType: 'bw' },
  { brand: 'AgfaPhoto', name: 'APX 400', iso: 400, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // ADOX — Black & White
  // ─────────────────────────────────────────────
  { brand: 'ADOX', name: 'CMS 20 II', iso: 20, colorType: 'bw' },
  { brand: 'ADOX', name: 'CHS 100 II', iso: 100, colorType: 'bw' },
  { brand: 'ADOX', name: 'HR-50', iso: 50, colorType: 'bw' },
  { brand: 'ADOX', name: 'Silvermax 100', iso: 100, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Bergger — Black & White
  // ─────────────────────────────────────────────
  { brand: 'Bergger', name: 'Pancro 400', iso: 400, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Ferrania (FILM Ferrania) — Black & White
  // ─────────────────────────────────────────────
  { brand: 'Ferrania', name: 'P30 Alpha', iso: 80, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Kosmo Foto — Black & White
  // ─────────────────────────────────────────────
  { brand: 'Kosmo Foto', name: 'Mono 100', iso: 100, colorType: 'bw' },
  { brand: 'Kosmo Foto', name: 'Agent Shadow 400', iso: 400, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Shanghai / Shenguang — Color & B&W
  // ─────────────────────────────────────────────
  { brand: 'Shanghai', name: 'GP3 100', iso: 100, colorType: 'bw' },
  { brand: 'Shanghai', name: 'Shenguang 400', iso: 400, colorType: 'color' },

  // ─────────────────────────────────────────────
  // Lucky (乐凯) — Color & B&W
  // ─────────────────────────────────────────────
  { brand: 'Lucky', name: 'SHD 100', iso: 100, colorType: 'bw' },
  { brand: 'Lucky', name: 'Color 200', iso: 200, colorType: 'color' },

  // ─────────────────────────────────────────────
  // Kentmere (Harman) — Black & White
  // (already covered under Ilford above; separate brand entry for clarity)
  // ─────────────────────────────────────────────
  // { brand: 'Kentmere', name: '100', iso: 100, colorType: 'bw' },
  // { brand: 'Kentmere', name: '400', iso: 400, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Harman (Ilford sister brand) — Black & White
  // ─────────────────────────────────────────────
  { brand: 'Harman', name: 'Phoenix 200 (Color)', iso: 200, colorType: 'color' },
  { brand: 'Harman', name: 'Direct Positive Paper', iso: 3, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // Svema / Tasma (Eastern European) — B&W
  // ─────────────────────────────────────────────
  { brand: 'Svema', name: 'Foto 100', iso: 100, colorType: 'bw' },

  // ─────────────────────────────────────────────
  // ORWO (Original Wolfen) — Black & White
  // ─────────────────────────────────────────────
  { brand: 'ORWO', name: 'UN54', iso: 100, colorType: 'bw' },
  { brand: 'ORWO', name: 'N75', iso: 400, colorType: 'bw' },
];

const COMMON_120_FILM_STOCKS: CommonFilmStockPreset[] = [
  { brand: 'Kodak', name: 'Gold 200', iso: 200, colorType: 'color', format: '120' },
  { brand: 'Kodak', name: 'Portra 160', iso: 160, colorType: 'color', format: '120' },
  { brand: 'Kodak', name: 'Portra 400', iso: 400, colorType: 'color', format: '120' },
  { brand: 'Kodak', name: 'Portra 800', iso: 800, colorType: 'color', format: '120' },
  { brand: 'Kodak', name: 'Ektar 100', iso: 100, colorType: 'color', format: '120' },
  { brand: 'Kodak', name: 'Tri-X 400 (TX400)', iso: 400, colorType: 'bw', format: '120' },
  { brand: 'Ilford', name: 'HP5 Plus 400', iso: 400, colorType: 'bw', format: '120' },
  { brand: 'Ilford', name: 'FP4 Plus 125', iso: 125, colorType: 'bw', format: '120' },
  { brand: 'Fujifilm', name: 'Neopan Acros 100 II', iso: 100, colorType: 'bw', format: '120' },
  { brand: 'Shanghai', name: 'GP3 100', iso: 100, colorType: 'bw', format: '120' },
];

export const COMMON_FILM_STOCKS: CommonFilmStockPreset[] = [
  ...RAW_COMMON_FILM_STOCKS.map(stock => ({
    ...stock,
    format: stock.format ?? '135',
  })),
  ...COMMON_120_FILM_STOCKS,
];
