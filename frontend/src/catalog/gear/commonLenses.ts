export interface CommonLensPreset {
  brand: string;
  model: string;
  focalLength: number;
  maxAperture: string;
  type: 'prime' | 'zoom';
  mountKey: string;
}

type RawCommonLensPreset = Omit<CommonLensPreset, 'mountKey'> & {
  mountKey?: string;
};

const inferMountKey = (lens: RawCommonLensPreset): string => {
  const model = lens.model.toLowerCase();
  if (lens.mountKey) return lens.mountKey;
  // Leica
  if (lens.brand === 'Leica' && model.includes('-m')) return 'leica-m';
  if (lens.brand === 'Leica' && model.includes('-r')) return 'leica-r';
  // Zeiss
  if (lens.brand === 'Zeiss' && model.includes('zm')) return 'leica-m';
  if (lens.brand === 'Zeiss' && (model.includes('ze') || model.includes('zf'))) return 'zeiss-ze-zf';
  if (lens.brand === 'Zeiss' && model.includes('batis')) return 'sony-e';
  if (lens.brand === 'Zeiss' && model.includes('loxia')) return 'sony-e';
  // Voigtländer
  if (lens.brand === 'Voigtländer' && (model.includes(' m') || model.includes('-m'))) return 'leica-m';
  if (lens.brand === 'Voigtländer' && model.includes(' e ')) return 'sony-e';
  if (lens.brand === 'Voigtländer' && model.includes('sl ii')) return 'nikon-f';
  if (lens.brand === 'Voigtländer' && model.includes('vm')) return 'leica-m';
  // Nikon
  if (lens.brand === 'Nikon') return model.includes(' z ') || model.startsWith('z ') || model.includes('nikkor z') ? 'nikon-z' : 'nikon-f';
  // Canon
  if (lens.brand === 'Canon' && model.startsWith('rf')) return 'canon-rf';
  if (lens.brand === 'Canon' && model.startsWith('fd')) return 'canon-fd';
  if (lens.brand === 'Canon' && model.startsWith('ef')) return 'canon-ef';
  // Sony
  if (lens.brand === 'Sony') return 'sony-e';
  // Fujifilm
  if (lens.brand === 'Fujifilm') return model.includes('gf') ? 'fujifilm-gfx' : 'fujifilm-x';
  // Tamron
  if (lens.brand === 'Tamron' && model.includes('sony e')) return 'sony-e';
  if (lens.brand === 'Tamron' && model.includes('nikon z')) return 'nikon-z';
  if (lens.brand === 'Tamron' && model.includes('canon rf')) return 'canon-rf';
  if (lens.brand === 'Tamron' && model.includes('fuji x')) return 'fujifilm-x';
  if (lens.brand === 'Tamron' && model.includes('adaptall')) return 'adaptall-2';
  if (lens.brand === 'Tamron') return 'adaptall-2';
  // Sigma
  if (lens.brand === 'Sigma' && model.includes('sony e')) return 'sony-e';
  if (lens.brand === 'Sigma' && model.includes('nikon z')) return 'nikon-z';
  if (lens.brand === 'Sigma' && model.includes('canon rf')) return 'canon-rf';
  if (lens.brand === 'Sigma' && model.includes('fuji x')) return 'fujifilm-x';
  if (lens.brand === 'Sigma' && model.includes('nikon f')) return 'nikon-f';
  if (lens.brand === 'Sigma' && model.includes('canon ef')) return 'canon-ef';
  if (lens.brand === 'Sigma' && model.includes('m4/3')) return 'micro-four-thirds';
  // Rokinon / Samyang
  if (lens.brand === 'Rokinon' && model.includes('sony e')) return 'sony-e';
  if (lens.brand === 'Rokinon' && model.includes('nikon z')) return 'nikon-z';
  if (lens.brand === 'Rokinon' && model.includes('canon rf')) return 'canon-rf';
  if (lens.brand === 'Rokinon' && model.includes('fuji x')) return 'fujifilm-x';
  if (lens.brand === 'Samyang') return 'sony-e';
  // TTArtisan
  if (lens.brand === 'TTArtisan' && model.includes('sony e')) return 'sony-e';
  if (lens.brand === 'TTArtisan' && model.includes('fuji x')) return 'fujifilm-x';
  if (lens.brand === 'TTArtisan' && model.includes('nikon z')) return 'nikon-z';
  if (lens.brand === 'TTArtisan' && model.includes('leica m')) return 'leica-m';
  // 7Artisans
  if (lens.brand === '7Artisans' && model.includes('sony e')) return 'sony-e';
  if (lens.brand === '7Artisans' && model.includes('fuji x')) return 'fujifilm-x';
  if (lens.brand === '7Artisans' && model.includes('nikon z')) return 'nikon-z';
  if (lens.brand === '7Artisans' && model.includes('leica m')) return 'leica-m';
  // Minolta / Olympus / Panasonic / Pentax / Contax / etc.
  if (lens.brand === 'Minolta') return 'minolta-md';
  if (lens.brand === 'Olympus' && model.includes('m.zuiko')) return 'micro-four-thirds';
  if (lens.brand === 'Olympus') return 'olympus-om';
  if (lens.brand === 'Panasonic') return 'micro-four-thirds';
  if (lens.brand === 'Pentax' && model.includes('takumar')) return 'm42';
  if (lens.brand === 'Pentax') return 'pentax-k';
  if (lens.brand === 'Contax' && model.includes(' g')) return 'contax-g';
  if (lens.brand === 'Contax') return 'contax-yashica';
  if (lens.brand === 'Hasselblad') return 'hasselblad-v';
  if (lens.brand === 'Mamiya' && model.includes('sekor z')) return 'mamiya-rz67';
  if (lens.brand === 'Mamiya' && model.includes('sekor c')) return 'mamiya-rb67';
  if (lens.brand === 'Mamiya' && model.includes(' n ')) return 'mamiya-7';
  if (lens.brand === 'Bronica' && model.includes('pe')) return 'bronica-etr';
  if (lens.brand === 'Bronica') return 'bronica-sq';
  if (lens.brand === 'Helios' && model.includes('m42')) return 'm42';
  if (lens.brand === 'Helios' && model.includes('contax rf')) return 'contax-rf';
  return 'unknown';
};

const RAW_COMMON_LENSES = [
  // ─────────────────────────────────────────────
  // Sony — FE / E Mount (Mirrorless Full Frame)
  // ─────────────────────────────────────────────
  { brand: 'Sony', model: 'FE 14mm f/1.8 GM', focalLength: 14, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Sony', model: 'FE 20mm f/1.8 G', focalLength: 20, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Sony', model: 'FE 24mm f/1.4 GM', focalLength: 24, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sony', model: 'FE 35mm f/1.4 GM', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sony', model: 'FE 35mm f/1.8', focalLength: 35, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Sony', model: 'FE 50mm f/1.2 GM', focalLength: 50, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Sony', model: 'FE 50mm f/1.4 GM', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sony', model: 'FE 85mm f/1.4 GM', focalLength: 85, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sony', model: 'FE 85mm f/1.8', focalLength: 85, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Sony', model: 'FE 135mm f/1.8 GM', focalLength: 135, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Sony', model: 'FE 16-35mm f/2.8 GM II', focalLength: 16, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Sony', model: 'FE 24-70mm f/2.8 GM II', focalLength: 24, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Sony', model: 'FE 24-105mm f/4 G OSS', focalLength: 24, maxAperture: 'f/4', type: 'zoom' },
  { brand: 'Sony', model: 'FE 70-200mm f/2.8 GM II OSS', focalLength: 70, maxAperture: 'f/2.8', type: 'zoom' },

  // ─────────────────────────────────────────────
  // Nikon — Z Mount (Mirrorless)
  // ─────────────────────────────────────────────
  { brand: 'Nikon', model: 'NIKKOR Z 20mm f/1.8 S', focalLength: 20, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Nikon', model: 'NIKKOR Z 24mm f/1.8 S', focalLength: 24, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Nikon', model: 'NIKKOR Z 35mm f/1.8 S', focalLength: 35, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Nikon', model: 'NIKKOR Z 50mm f/1.2 S', focalLength: 50, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Nikon', model: 'NIKKOR Z 50mm f/1.8 S', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Nikon', model: 'NIKKOR Z 85mm f/1.2 S', focalLength: 85, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Nikon', model: 'NIKKOR Z 85mm f/1.8 S', focalLength: 85, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Nikon', model: 'NIKKOR Z 135mm f/1.8 S Plena', focalLength: 135, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Nikon', model: 'NIKKOR Z 14-24mm f/2.8 S', focalLength: 14, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Nikon', model: 'NIKKOR Z 24-70mm f/2.8 S', focalLength: 24, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Nikon', model: 'NIKKOR Z 24-120mm f/4 S', focalLength: 24, maxAperture: 'f/4', type: 'zoom' },
  { brand: 'Nikon', model: 'NIKKOR Z 70-200mm f/2.8 VR S', focalLength: 70, maxAperture: 'f/2.8', type: 'zoom' },

  // ─────────────────────────────────────────────
  // Canon — RF Mount (Mirrorless)
  // ─────────────────────────────────────────────
  { brand: 'Canon', model: 'RF 16mm f/2.8 STM', focalLength: 16, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Canon', model: 'RF 35mm f/1.8 Macro IS STM', focalLength: 35, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Canon', model: 'RF 50mm f/1.2L USM', focalLength: 50, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Canon', model: 'RF 50mm f/1.8 STM', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Canon', model: 'RF 85mm f/1.2L USM', focalLength: 85, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Canon', model: 'RF 85mm f/2 Macro IS STM', focalLength: 85, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Canon', model: 'RF 135mm f/1.8L IS USM', focalLength: 135, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Canon', model: 'RF 15-35mm f/2.8L IS USM', focalLength: 15, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Canon', model: 'RF 24-70mm f/2.8L IS USM', focalLength: 24, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Canon', model: 'RF 24-105mm f/4L IS USM', focalLength: 24, maxAperture: 'f/4', type: 'zoom' },
  { brand: 'Canon', model: 'RF 70-200mm f/2.8L IS USM', focalLength: 70, maxAperture: 'f/2.8', type: 'zoom' },

  // ─────────────────────────────────────────────
  // Fujifilm — X Mount (Mirrorless APS-C)
  // ─────────────────────────────────────────────
  { brand: 'Fujifilm', model: 'XF 10-24mm f/4 R OIS WR', focalLength: 10, maxAperture: 'f/4', type: 'zoom' },
  { brand: 'Fujifilm', model: 'XF 16mm f/1.4 R WR', focalLength: 16, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 23mm f/1.4 R LM WR', focalLength: 23, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 27mm f/2.8 R WR', focalLength: 27, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 33mm f/1.4 R LM WR', focalLength: 33, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 35mm f/1.4 R', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 35mm f/2 R WR', focalLength: 35, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 50mm f/1.0 R WR', focalLength: 50, maxAperture: 'f/1.0', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 56mm f/1.2 R WR', focalLength: 56, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 90mm f/2 R LM WR', focalLength: 90, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Fujifilm', model: 'XF 16-55mm f/2.8 R LM WR', focalLength: 16, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Fujifilm', model: 'XF 50-140mm f/2.8 R LM OIS WR', focalLength: 50, maxAperture: 'f/2.8', type: 'zoom' },

  // ─────────────────────────────────────────────
  // Tamron — Sony E Mount (现代三方镜头)
  // ─────────────────────────────────────────────
  { brand: 'Tamron', model: '17-28mm f/2.8 Di III RXD (Sony E)', focalLength: 17, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Tamron', model: '28-75mm f/2.8 Di III VXD G2 (Sony E)', focalLength: 28, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Tamron', model: '70-180mm f/2.8 Di III VXD G2 (Sony E)', focalLength: 70, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Tamron', model: '35mm f/1.4 Di USD (Sony E)', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Tamron', model: '50-400mm f/4.5-6.3 Di III VC VXD (Sony E)', focalLength: 50, maxAperture: 'f/4.5', type: 'zoom' },

  // Tamron — Nikon Z Mount
  { brand: 'Tamron', model: '17-28mm f/2.8 Di III-A RXD (Nikon Z)', focalLength: 17, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Tamron', model: '28-75mm f/2.8 Di III VXD G2 (Nikon Z)', focalLength: 28, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Tamron', model: '70-180mm f/2.8 Di III VC VXD G2 (Nikon Z)', focalLength: 70, maxAperture: 'f/2.8', type: 'zoom' },

  // Tamron — Fuji X Mount
  { brand: 'Tamron', model: '17-70mm f/2.8 Di III-A VC RXD (Fuji X)', focalLength: 17, maxAperture: 'f/2.8', type: 'zoom' },

  // Tamron — Classic Adaptall-2
  { brand: 'Tamron', model: 'SP 90mm f/2.5 Macro Adaptall-2', focalLength: 90, maxAperture: 'f/2.5', type: 'prime' },
  { brand: 'Tamron', model: 'SP 17mm f/3.5 Adaptall-2', focalLength: 17, maxAperture: 'f/3.5', type: 'prime' },

  // ─────────────────────────────────────────────
  // Sigma — Art / DN Series
  // ─────────────────────────────────────────────
  // Sigma Art for Sony E
  { brand: 'Sigma', model: 'Art 14mm f/1.8 DG HSM (Sony E)', focalLength: 14, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Sigma', model: 'Art 24mm f/1.4 DG HSM (Sony E)', focalLength: 24, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: 'Art 35mm f/1.4 DG DN (Sony E)', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: 'Art 50mm f/1.4 DG DN (Sony E)', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: 'Art 85mm f/1.4 DG DN (Sony E)', focalLength: 85, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: 'Art 135mm f/1.8 DG HSM (Sony E)', focalLength: 135, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Sigma', model: 'Art 24-70mm f/2.8 DG DN (Sony E)', focalLength: 24, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Sigma', model: 'Art 28-45mm f/1.8 DG DN (Sony E)', focalLength: 28, maxAperture: 'f/1.8', type: 'zoom' },

  // Sigma DN compact for Sony E / Fuji X
  { brand: 'Sigma', model: '16mm f/1.4 DC DN Contemporary (Sony E)', focalLength: 16, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: '30mm f/1.4 DC DN Contemporary (Sony E)', focalLength: 30, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: '56mm f/1.4 DC DN Contemporary (Sony E)', focalLength: 56, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: '16mm f/1.4 DC DN Contemporary (Fuji X)', focalLength: 16, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: '30mm f/1.4 DC DN Contemporary (Fuji X)', focalLength: 30, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: '56mm f/1.4 DC DN Contemporary (Fuji X)', focalLength: 56, maxAperture: 'f/1.4', type: 'prime' },

  // Sigma Art for Nikon Z
  { brand: 'Sigma', model: 'Art 35mm f/1.4 DG DN (Nikon Z)', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: 'Art 50mm f/1.4 DG DN (Nikon Z)', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: 'Art 85mm f/1.4 DG DN (Nikon Z)', focalLength: 85, maxAperture: 'f/1.4', type: 'prime' },

  // Sigma classic for Canon EF / Nikon F
  { brand: 'Sigma', model: 'Art 18-35mm f/1.8 DC HSM (Canon EF)', focalLength: 18, maxAperture: 'f/1.8', type: 'zoom' },
  { brand: 'Sigma', model: 'Art 35mm f/1.4 DG HSM (Nikon F)', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: 'Art 50mm f/1.4 DG HSM (Canon EF)', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Sigma', model: 'Art 85mm f/1.4 DG HSM (Nikon F)', focalLength: 85, maxAperture: 'f/1.4', type: 'prime' },

  // ─────────────────────────────────────────────
  // Rokinon / Samyang — Manual Focus Cine / Mirrorless
  // ─────────────────────────────────────────────
  { brand: 'Rokinon', model: 'SP 14mm f/2.4 (Sony E)', focalLength: 14, maxAperture: 'f/2.4', type: 'prime' },
  { brand: 'Rokinon', model: 'SP 35mm f/1.2 (Sony E)', focalLength: 35, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Rokinon', model: 'SP 85mm f/1.2 (Sony E)', focalLength: 85, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Rokinon', model: '24mm T1.5 Cine DS (Sony E)', focalLength: 24, maxAperture: 'T1.5', type: 'prime' },
  { brand: 'Rokinon', model: 'SP 14mm f/2.8 (Nikon Z)', focalLength: 14, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Rokinon', model: 'SP 35mm f/1.2 (Fuji X)', focalLength: 35, maxAperture: 'f/1.2', type: 'prime' },

  // ─────────────────────────────────────────────
  // TTArtisan — Budget Manual Focus (Leica M & Mirrorless)
  // ─────────────────────────────────────────────
  { brand: 'TTArtisan', model: '11mm f/2.8 (Sony E)', focalLength: 11, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'TTArtisan', model: '35mm f/1.4 (Sony E)', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'TTArtisan', model: '50mm f/0.95 (Sony E)', focalLength: 50, maxAperture: 'f/0.95', type: 'prime' },
  { brand: 'TTArtisan', model: '50mm f/1.4 ASPH (Leica M)', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'TTArtisan', model: '35mm f/1.4 (Fuji X)', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'TTArtisan', model: '50mm f/0.95 (Fuji X)', focalLength: 50, maxAperture: 'f/0.95', type: 'prime' },
  { brand: 'TTArtisan', model: '50mm f/2 (Leica M)', focalLength: 50, maxAperture: 'f/2', type: 'prime' },
  { brand: 'TTArtisan', model: '35mm f/1.4 (Nikon Z)', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },

  // ─────────────────────────────────────────────
  // 7Artisans — Budget Manual Focus
  // ─────────────────────────────────────────────
  { brand: '7Artisans', model: '10mm f/2.8 (Sony E)', focalLength: 10, maxAperture: 'f/2.8', type: 'prime' },
  { brand: '7Artisans', model: '25mm f/1.8 (Sony E)', focalLength: 25, maxAperture: 'f/1.8', type: 'prime' },
  { brand: '7Artisans', model: '35mm f/1.2 (Sony E)', focalLength: 35, maxAperture: 'f/1.2', type: 'prime' },
  { brand: '7Artisans', model: '50mm f/1.8 (Fuji X)', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' },
  { brand: '7Artisans', model: '35mm f/1.2 (Fuji X)', focalLength: 35, maxAperture: 'f/1.2', type: 'prime' },
  { brand: '7Artisans', model: '28mm f/1.4 (Leica M)', focalLength: 28, maxAperture: 'f/1.4', type: 'prime' },
  { brand: '7Artisans', model: '50mm f/1.1 (Leica M)', focalLength: 50, maxAperture: 'f/1.1', type: 'prime' },
  { brand: '7Artisans', model: '35mm f/1.2 (Nikon Z)', focalLength: 35, maxAperture: 'f/1.2', type: 'prime' },

  // ─────────────────────────────────────────────
  // Zeiss — Batis / Loxia (Sony E Mount)
  // ─────────────────────────────────────────────
  { brand: 'Zeiss', model: 'Batis 18mm f/2.8', focalLength: 18, maxAperture: 'f/2.8', type: 'prime', mountKey: 'sony-e' },
  { brand: 'Zeiss', model: 'Batis 25mm f/2', focalLength: 25, maxAperture: 'f/2', type: 'prime', mountKey: 'sony-e' },
  { brand: 'Zeiss', model: 'Batis 85mm f/1.8', focalLength: 85, maxAperture: 'f/1.8', type: 'prime', mountKey: 'sony-e' },
  { brand: 'Zeiss', model: 'Loxia 21mm f/2.8', focalLength: 21, maxAperture: 'f/2.8', type: 'prime', mountKey: 'sony-e' },
  { brand: 'Zeiss', model: 'Loxia 35mm f/2', focalLength: 35, maxAperture: 'f/2', type: 'prime', mountKey: 'sony-e' },
  { brand: 'Zeiss', model: 'Loxia 50mm f/2', focalLength: 50, maxAperture: 'f/2', type: 'prime', mountKey: 'sony-e' },

  // ─────────────────────────────────────────────
  // Olympus / Panasonic — Micro Four Thirds
  // ─────────────────────────────────────────────
  { brand: 'Olympus', model: 'M.Zuiko Digital 17mm f/1.8', focalLength: 17, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Olympus', model: 'M.Zuiko Digital 25mm f/1.8', focalLength: 25, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Olympus', model: 'M.Zuiko Digital 45mm f/1.8', focalLength: 45, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Olympus', model: 'M.Zuiko Digital ED 75mm f/1.8', focalLength: 75, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Olympus', model: 'M.Zuiko Digital ED 12-40mm f/2.8 PRO', focalLength: 12, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Olympus', model: 'M.Zuiko Digital ED 12-100mm f/4 IS PRO', focalLength: 12, maxAperture: 'f/4', type: 'zoom' },
  { brand: 'Panasonic', model: 'Lumix G 20mm f/1.7 ASPH', focalLength: 20, maxAperture: 'f/1.7', type: 'prime' },
  { brand: 'Panasonic', model: 'Leica DG Summilux 25mm f/1.4 ASPH', focalLength: 25, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Panasonic', model: 'Lumix G 42.5mm f/1.7 ASPH', focalLength: 42, maxAperture: 'f/1.7', type: 'prime' },
  { brand: 'Panasonic', model: 'Lumix G Vario 12-35mm f/2.8 II ASPH', focalLength: 12, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Panasonic', model: 'Lumix G Vario 35-100mm f/2.8', focalLength: 35, maxAperture: 'f/2.8', type: 'zoom' },

  // ─────────────────────────────────────────────
  // Voigtländer — Leica M-mount (胶片首选平价头)
  // ─────────────────────────────────────────────
  { brand: 'Voigtländer', model: 'Color-Skopar 21mm f/3.5 M', focalLength: 21, maxAperture: 'f/3.5', type: 'prime' },
  { brand: 'Voigtländer', model: 'Ultron 28mm f/2 M', focalLength: 28, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Voigtländer', model: 'Nokton 35mm f/1.2 II M', focalLength: 35, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Voigtländer', model: 'Color-Skopar 35mm f/2.5 M', focalLength: 35, maxAperture: 'f/2.5', type: 'prime' },
  { brand: 'Voigtländer', model: 'Nokton Classic 40mm f/1.4 M', focalLength: 40, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Voigtländer', model: 'Nokton 50mm f/1.1 M', focalLength: 50, maxAperture: 'f/1.1', type: 'prime' },
  { brand: 'Voigtländer', model: 'Nokton Classic 50mm f/1.5 M', focalLength: 50, maxAperture: 'f/1.5', type: 'prime' },
  { brand: 'Voigtländer', model: 'APO-Lanthar 50mm f/2 M', focalLength: 50, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Voigtländer', model: 'Heliar 50mm f/3.5 M', focalLength: 50, maxAperture: 'f/3.5', type: 'prime' },
  { brand: 'Voigtländer', model: 'Nokton 75mm f/1.5 M', focalLength: 75, maxAperture: 'f/1.5', type: 'prime' },
  { brand: 'Voigtländer', model: 'Heliar 75mm f/1.8 M', focalLength: 75, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Voigtländer', model: 'APO-Lanthar 90mm f/3.5 M', focalLength: 90, maxAperture: 'f/3.5', type: 'prime' },

  // Voigtländer — Sony E Mount
  { brand: 'Voigtländer', model: 'Nokton 40mm f/1.2 Aspherical (Sony E)', focalLength: 40, maxAperture: 'f/1.2', type: 'prime', mountKey: 'sony-e' },
  { brand: 'Voigtländer', model: 'Nokton 50mm f/1.2 Aspherical (Sony E)', focalLength: 50, maxAperture: 'f/1.2', type: 'prime', mountKey: 'sony-e' },
  { brand: 'Voigtländer', model: 'APO-Lanthar 35mm f/2 Aspherical (Sony E)', focalLength: 35, maxAperture: 'f/2', type: 'prime', mountKey: 'sony-e' },
  { brand: 'Voigtländer', model: 'APO-Lanthar 50mm f/2 Aspherical (Sony E)', focalLength: 50, maxAperture: 'f/2', type: 'prime', mountKey: 'sony-e' },

  // Voigtländer — Nikon F Mount
  { brand: 'Voigtländer', model: 'Nokton 58mm f/1.4 SL II F', focalLength: 58, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Voigtländer', model: 'Nokton 125mm f/2.5 SL Macro F', focalLength: 125, maxAperture: 'f/2.5', type: 'prime' },

  // ─────────────────────────────────────────────
  // Leica — M-mount (Rangefinder)
  // ─────────────────────────────────────────────
  { brand: 'Leica', model: 'Summicron-M 28mm f/2 ASPH', focalLength: 28, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Leica', model: 'Summicron-M 35mm f/2 ASPH', focalLength: 35, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Leica', model: 'Summilux-M 35mm f/1.4 ASPH', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Leica', model: 'Summicron-M 50mm f/2', focalLength: 50, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Leica', model: 'Summilux-M 50mm f/1.4 ASPH', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Leica', model: 'Noctilux-M 50mm f/0.95 ASPH', focalLength: 50, maxAperture: 'f/0.95', type: 'prime' },
  { brand: 'Leica', model: 'APO-Summicron-M 75mm f/2 ASPH', focalLength: 75, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Leica', model: 'Summicron-M 90mm f/2 ASPH', focalLength: 90, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Leica', model: 'APO-Summicron-M 90mm f/2 ASPH', focalLength: 90, maxAperture: 'f/2', type: 'prime' },

  // Leica — R-mount (SLR)
  { brand: 'Leica', model: 'Summicron-R 50mm f/2', focalLength: 50, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Leica', model: 'Summilux-R 80mm f/1.4', focalLength: 80, maxAperture: 'f/1.4', type: 'prime' },

  // ─────────────────────────────────────────────
  // Zeiss ZM — Leica M-mount (胶片 Rangefinder)
  // ─────────────────────────────────────────────
  { brand: 'Zeiss', model: 'C-Biogon 21mm f/4.5 ZM', focalLength: 21, maxAperture: 'f/4.5', type: 'prime' },
  { brand: 'Zeiss', model: 'Biogon 28mm f/2.8 ZM', focalLength: 28, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Zeiss', model: 'Biogon 35mm f/2 ZM', focalLength: 35, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Zeiss', model: 'C-Biogon 35mm f/2.8 ZM', focalLength: 35, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Zeiss', model: 'Planar 50mm f/2 ZM', focalLength: 50, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Zeiss', model: 'Sonnar 85mm f/2 ZM', focalLength: 85, maxAperture: 'f/2', type: 'prime' },

  // ─────────────────────────────────────────────
  // Contax / Yashica (C/Y Mount) — Carl Zeiss SLR
  // ─────────────────────────────────────────────
  { brand: 'Contax', model: 'Carl Zeiss Distagon 21mm f/2.8 C/Y', focalLength: 21, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Distagon 28mm f/2.8 C/Y', focalLength: 28, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Distagon 35mm f/1.4 C/Y', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Planar 50mm f/1.4 C/Y', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Planar 85mm f/1.4 C/Y', focalLength: 85, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Sonnar 135mm f/2.8 C/Y', focalLength: 135, maxAperture: 'f/2.8', type: 'prime' },

  // Contax G-mount (AF Rangefinder)
  { brand: 'Contax', model: 'Carl Zeiss Biogon 21mm f/2.8 G', focalLength: 21, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Hologon 16mm f/8 G', focalLength: 16, maxAperture: 'f/8', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Biogon 28mm f/2.8 G', focalLength: 28, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Planar 45mm f/2 G', focalLength: 45, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Contax', model: 'Carl Zeiss Sonnar 90mm f/2.8 G', focalLength: 90, maxAperture: 'f/2.8', type: 'prime' },

  // ─────────────────────────────────────────────
  // Nikon — F-mount (AI / AI-S / AF, 胶片 SLR)
  // ─────────────────────────────────────────────
  { brand: 'Nikon', model: 'Nikkor 20mm f/2.8 AI-S', focalLength: 20, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 24mm f/2.8 AI-S', focalLength: 24, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 28mm f/2.8 AI-S', focalLength: 28, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 35mm f/1.4 AI-S', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 35mm f/2 AI-S', focalLength: 35, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 50mm f/1.2 AI-S', focalLength: 50, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 50mm f/1.4 AI-S', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 50mm f/1.8 AI-S', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 85mm f/1.4 AI-S', focalLength: 85, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 85mm f/1.8 AI-S', focalLength: 85, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 105mm f/2.5 AI-S', focalLength: 105, maxAperture: 'f/2.5', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 135mm f/2 AI-S', focalLength: 135, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Nikon', model: 'Nikkor 180mm f/2.8 ED AI-S', focalLength: 180, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Nikon', model: 'AF-S Nikkor 24-70mm f/2.8G ED', focalLength: 24, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Nikon', model: 'AF-S Nikkor 70-200mm f/2.8G VR II', focalLength: 70, maxAperture: 'f/2.8', type: 'zoom' },

  // ─────────────────────────────────────────────
  // Canon — FD Mount (Manual Focus, pre-1987)
  // ─────────────────────────────────────────────
  { brand: 'Canon', model: 'FD 24mm f/2.8', focalLength: 24, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Canon', model: 'FD 28mm f/2.8', focalLength: 28, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Canon', model: 'FD 35mm f/2', focalLength: 35, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Canon', model: 'FD 50mm f/1.2L', focalLength: 50, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Canon', model: 'FD 50mm f/1.4', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Canon', model: 'FD 55mm f/1.2 SSC', focalLength: 55, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Canon', model: 'FD 85mm f/1.2L', focalLength: 85, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Canon', model: 'FD 85mm f/1.8', focalLength: 85, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Canon', model: 'FD 100mm f/2', focalLength: 100, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Canon', model: 'FD 135mm f/2.8', focalLength: 135, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Canon', model: 'FD 200mm f/2.8L', focalLength: 200, maxAperture: 'f/2.8', type: 'prime' },

  // Canon — EF Mount (Autofocus DSLR)
  { brand: 'Canon', model: 'EF 35mm f/1.4L USM', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Canon', model: 'EF 50mm f/1.2L USM', focalLength: 50, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Canon', model: 'EF 50mm f/1.4 USM', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Canon', model: 'EF 85mm f/1.2L II USM', focalLength: 85, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Canon', model: 'EF 85mm f/1.8 USM', focalLength: 85, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Canon', model: 'EF 135mm f/2L USM', focalLength: 135, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Canon', model: 'EF 24-70mm f/2.8L II USM', focalLength: 24, maxAperture: 'f/2.8', type: 'zoom' },
  { brand: 'Canon', model: 'EF 70-200mm f/2.8L IS III USM', focalLength: 70, maxAperture: 'f/2.8', type: 'zoom' },

  // ─────────────────────────────────────────────
  // Minolta — MD / MC Mount
  // ─────────────────────────────────────────────
  { brand: 'Minolta', model: 'MD 28mm f/2.8', focalLength: 28, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Minolta', model: 'MD 35mm f/1.8', focalLength: 35, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Minolta', model: 'MD 35mm f/2.8', focalLength: 35, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Minolta', model: 'MD 50mm f/1.4', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Minolta', model: 'MD 50mm f/1.7', focalLength: 50, maxAperture: 'f/1.7', type: 'prime' },
  { brand: 'Minolta', model: 'MD 58mm f/1.2', focalLength: 58, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Minolta', model: 'MD 85mm f/1.7', focalLength: 85, maxAperture: 'f/1.7', type: 'prime' },
  { brand: 'Minolta', model: 'MC Rokkor-PG 58mm f/1.2', focalLength: 58, maxAperture: 'f/1.2', type: 'prime' },

  // ─────────────────────────────────────────────
  // Olympus — OM Mount (胶片 SLR)
  // ─────────────────────────────────────────────
  { brand: 'Olympus', model: 'Zuiko 21mm f/3.5', focalLength: 21, maxAperture: 'f/3.5', type: 'prime' },
  { brand: 'Olympus', model: 'Zuiko 28mm f/2', focalLength: 28, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Olympus', model: 'Zuiko 28mm f/2.8', focalLength: 28, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Olympus', model: 'Zuiko 50mm f/1.2', focalLength: 50, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Olympus', model: 'Zuiko 50mm f/1.4', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Olympus', model: 'Zuiko 50mm f/1.8', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Olympus', model: 'Zuiko 85mm f/2', focalLength: 85, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Olympus', model: 'Zuiko 100mm f/2', focalLength: 100, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Olympus', model: 'Zuiko 135mm f/2.8', focalLength: 135, maxAperture: 'f/2.8', type: 'prime' },

  // ─────────────────────────────────────────────
  // Pentax — K Mount / M42 Screw Mount
  // ─────────────────────────────────────────────
  { brand: 'Pentax', model: 'Super-Takumar 28mm f/3.5 (M42)', focalLength: 28, maxAperture: 'f/3.5', type: 'prime' },
  { brand: 'Pentax', model: 'Super-Takumar 35mm f/2 (M42)', focalLength: 35, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Pentax', model: 'Super-Takumar 50mm f/1.4 (M42)', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Pentax', model: 'Super-Takumar 55mm f/1.8 (M42)', focalLength: 55, maxAperture: 'f/1.8', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax-M 50mm f/1.4', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax-M 50mm f/1.7', focalLength: 50, maxAperture: 'f/1.7', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax-A 50mm f/1.2', focalLength: 50, maxAperture: 'f/1.2', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax-FA 43mm f/1.9 Limited', focalLength: 43, maxAperture: 'f/1.9', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax-FA 77mm f/1.8 Limited', focalLength: 77, maxAperture: 'f/1.8', type: 'prime' },

  // ─────────────────────────────────────────────
  // Zeiss ZE / ZF.2 (Third-Party SLR, Canon EF / Nikon F)
  // ─────────────────────────────────────────────
  { brand: 'Zeiss', model: 'Milvus 21mm f/2.8 ZE/ZF.2', focalLength: 21, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Zeiss', model: 'Milvus 35mm f/1.4 ZE/ZF.2', focalLength: 35, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Zeiss', model: 'Milvus 50mm f/1.4 ZE/ZF.2', focalLength: 50, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Zeiss', model: 'Otus 55mm f/1.4 ZE/ZF.2', focalLength: 55, maxAperture: 'f/1.4', type: 'prime' },
  { brand: 'Zeiss', model: 'Otus 85mm f/1.4 ZE/ZF.2', focalLength: 85, maxAperture: 'f/1.4', type: 'prime' },

  // ─────────────────────────────────────────────
  // Hasselblad — V-mount (6x6 Medium Format)
  // ─────────────────────────────────────────────
  { brand: 'Hasselblad', model: 'Carl Zeiss Distagon 40mm f/4 CF', focalLength: 40, maxAperture: 'f/4', type: 'prime' },
  { brand: 'Hasselblad', model: 'Carl Zeiss Distagon 50mm f/4 C', focalLength: 50, maxAperture: 'f/4', type: 'prime' },
  { brand: 'Hasselblad', model: 'Carl Zeiss Planar 80mm f/2.8 C', focalLength: 80, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Hasselblad', model: 'Carl Zeiss Planar 80mm f/2.8 CF', focalLength: 80, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Hasselblad', model: 'Carl Zeiss Sonnar 150mm f/4 C', focalLength: 150, maxAperture: 'f/4', type: 'prime' },
  { brand: 'Hasselblad', model: 'Carl Zeiss Sonnar 250mm f/5.6 CF', focalLength: 250, maxAperture: 'f/5.6', type: 'prime' },

  // ─────────────────────────────────────────────
  // Mamiya — RB67 / RZ67 Mount (Medium Format)
  // ─────────────────────────────────────────────
  { brand: 'Mamiya', model: 'Sekor C 50mm f/4.5', focalLength: 50, maxAperture: 'f/4.5', type: 'prime' },
  { brand: 'Mamiya', model: 'Sekor C 90mm f/3.8', focalLength: 90, maxAperture: 'f/3.8', type: 'prime' },
  { brand: 'Mamiya', model: 'Sekor C 127mm f/3.8', focalLength: 127, maxAperture: 'f/3.8', type: 'prime' },
  { brand: 'Mamiya', model: 'Sekor C 180mm f/4.5', focalLength: 180, maxAperture: 'f/4.5', type: 'prime' },
  { brand: 'Mamiya', model: 'Sekor Z 50mm f/4.5 W', focalLength: 50, maxAperture: 'f/4.5', type: 'prime' },
  { brand: 'Mamiya', model: 'Sekor Z 110mm f/2.8 W', focalLength: 110, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Mamiya', model: 'Sekor Z 250mm f/4.5 W', focalLength: 250, maxAperture: 'f/4.5', type: 'prime' },

  // Mamiya 7 / 6 — Rangefinder Mount
  { brand: 'Mamiya', model: 'N 43mm f/4.5 L', focalLength: 43, maxAperture: 'f/4.5', type: 'prime' },
  { brand: 'Mamiya', model: 'N 65mm f/4 L', focalLength: 65, maxAperture: 'f/4', type: 'prime' },
  { brand: 'Mamiya', model: 'N 80mm f/4 L', focalLength: 80, maxAperture: 'f/4', type: 'prime' },
  { brand: 'Mamiya', model: 'N 150mm f/4.5 L', focalLength: 150, maxAperture: 'f/4.5', type: 'prime' },

  // ─────────────────────────────────────────────
  // Pentax 67 Mount (Medium Format)
  // ─────────────────────────────────────────────
  { brand: 'Pentax', model: 'SMC Pentax 67 45mm f/4', focalLength: 45, maxAperture: 'f/4', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax 67 90mm f/2.8', focalLength: 90, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax 67 105mm f/2.4', focalLength: 105, maxAperture: 'f/2.4', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax 67 165mm f/2.8', focalLength: 165, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Pentax', model: 'SMC Pentax 67 200mm f/4', focalLength: 200, maxAperture: 'f/4', type: 'prime' },

  // ─────────────────────────────────────────────
  // Bronica — SQ / ETR Mount
  // ─────────────────────────────────────────────
  { brand: 'Bronica', model: 'Zenzanon-S 40mm f/4', focalLength: 40, maxAperture: 'f/4', type: 'prime' },
  { brand: 'Bronica', model: 'Zenzanon-S 80mm f/2.8', focalLength: 80, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Bronica', model: 'Zenzanon-S 150mm f/3.5', focalLength: 150, maxAperture: 'f/3.5', type: 'prime' },
  { brand: 'Bronica', model: 'Zenzanon-PE 75mm f/2.8', focalLength: 75, maxAperture: 'f/2.8', type: 'prime' },
  { brand: 'Bronica', model: 'Zenzanon-PE 150mm f/3.5', focalLength: 150, maxAperture: 'f/3.5', type: 'prime' },

  // ─────────────────────────────────────────────
  // Helios (Soviet — M42 Mount)
  // ─────────────────────────────────────────────
  { brand: 'Helios', model: '44-2 58mm f/2 (M42)', focalLength: 58, maxAperture: 'f/2', type: 'prime' },
  { brand: 'Helios', model: '40-2 85mm f/1.5 (M42)', focalLength: 85, maxAperture: 'f/1.5', type: 'prime' },
  { brand: 'Helios', model: '103 53mm f/1.8 (Contax RF)', focalLength: 53, maxAperture: 'f/1.8', type: 'prime' },

] satisfies RawCommonLensPreset[];

export const COMMON_LENSES: CommonLensPreset[] = RAW_COMMON_LENSES.map(lens => ({
  ...lens,
  mountKey: inferMountKey(lens),
}));
