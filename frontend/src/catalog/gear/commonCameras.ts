export interface CommonCameraPreset {
  brand: string;
  model: string;
  type: 'film' | 'digital';
  format: string;
  backType?: 'fixed' | 'interchangeable';
  cameraSystemName?: string;
  backs?: string[];
}

export const COMMON_CAMERAS: CommonCameraPreset[] = [
  // ─────────────────────────────────────────────
  // 135 SLR — Nikon
  // ─────────────────────────────────────────────
  { brand: 'Nikon', model: 'F', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'F2', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'F3', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'F4', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'F5', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'F6', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'FM', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'FM2', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'FM3a', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'FE', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'FE2', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'FA', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'F100', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'F80', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'N8008s', type: 'film', format: '135' },

  // 135 SLR — Canon
  { brand: 'Canon', model: 'AE-1', type: 'film', format: '135' },
  { brand: 'Canon', model: 'AE-1 Program', type: 'film', format: '135' },
  { brand: 'Canon', model: 'A-1', type: 'film', format: '135' },
  { brand: 'Canon', model: 'F-1', type: 'film', format: '135' },
  { brand: 'Canon', model: 'New F-1', type: 'film', format: '135' },
  { brand: 'Canon', model: 'EOS-1V', type: 'film', format: '135' },
  { brand: 'Canon', model: 'EOS 3', type: 'film', format: '135' },
  { brand: 'Canon', model: 'EOS 630', type: 'film', format: '135' },
  { brand: 'Canon', model: 'T70', type: 'film', format: '135' },
  { brand: 'Canon', model: 'T90', type: 'film', format: '135' },

  // 135 SLR — Leica (SLR)
  { brand: 'Leica', model: 'R3', type: 'film', format: '135' },
  { brand: 'Leica', model: 'R6', type: 'film', format: '135' },
  { brand: 'Leica', model: 'R8', type: 'film', format: '135' },

  // 135 Rangefinder — Leica M
  { brand: 'Leica', model: 'M2', type: 'film', format: '135' },
  { brand: 'Leica', model: 'M3', type: 'film', format: '135' },
  { brand: 'Leica', model: 'M4', type: 'film', format: '135' },
  { brand: 'Leica', model: 'M4-P', type: 'film', format: '135' },
  { brand: 'Leica', model: 'M6', type: 'film', format: '135' },
  { brand: 'Leica', model: 'M6 TTL', type: 'film', format: '135' },
  { brand: 'Leica', model: 'M7', type: 'film', format: '135' },
  { brand: 'Leica', model: 'MP', type: 'film', format: '135' },
  { brand: 'Leica', model: 'MA', type: 'film', format: '135' },

  // 135 SLR — Pentax
  { brand: 'Pentax', model: 'Spotmatic', type: 'film', format: '135' },
  { brand: 'Pentax', model: 'K1000', type: 'film', format: '135' },
  { brand: 'Pentax', model: 'KX', type: 'film', format: '135' },
  { brand: 'Pentax', model: 'LX', type: 'film', format: '135' },
  { brand: 'Pentax', model: 'ME Super', type: 'film', format: '135' },
  { brand: 'Pentax', model: 'MX', type: 'film', format: '135' },
  { brand: 'Pentax', model: 'P30t', type: 'film', format: '135' },

  // 135 SLR — Olympus
  { brand: 'Olympus', model: 'OM-1', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'OM-2', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'OM-2n', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'OM-3', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'OM-4', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'OM-10', type: 'film', format: '135' },

  // 135 SLR — Minolta
  { brand: 'Minolta', model: 'SR-T 101', type: 'film', format: '135' },
  { brand: 'Minolta', model: 'XD-11', type: 'film', format: '135' },
  { brand: 'Minolta', model: 'X-700', type: 'film', format: '135' },
  { brand: 'Minolta', model: 'X-570', type: 'film', format: '135' },
  { brand: 'Minolta', model: 'Maxxum 7000', type: 'film', format: '135' },
  { brand: 'Minolta', model: 'Dynax 7', type: 'film', format: '135' },

  // 135 SLR — Contax
  { brand: 'Contax', model: 'RTS', type: 'film', format: '135' },
  { brand: 'Contax', model: 'RTS II', type: 'film', format: '135' },
  { brand: 'Contax', model: 'RTS III', type: 'film', format: '135' },
  { brand: 'Contax', model: 'S2', type: 'film', format: '135' },
  { brand: 'Contax', model: 'ST', type: 'film', format: '135' },
  { brand: 'Contax', model: 'AX', type: 'film', format: '135' },

  // 135 Rangefinder — Contax G
  { brand: 'Contax', model: 'G1', type: 'film', format: '135' },
  { brand: 'Contax', model: 'G2', type: 'film', format: '135' },

  // 135 Point & Shoot / Premium Compact
  { brand: 'Contax', model: 'T2', type: 'film', format: '135' },
  { brand: 'Contax', model: 'T3', type: 'film', format: '135' },
  { brand: 'Contax', model: 'TVS', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'Stylus (MJU)', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'MJU II (Stylus Epic)', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'XA', type: 'film', format: '135' },
  { brand: 'Olympus', model: 'XA2', type: 'film', format: '135' },
  { brand: 'Ricoh', model: 'GR1', type: 'film', format: '135' },
  { brand: 'Ricoh', model: 'GR1s', type: 'film', format: '135' },
  { brand: 'Ricoh', model: 'GR1v', type: 'film', format: '135' },
  { brand: 'Ricoh', model: 'R1', type: 'film', format: '135' },
  { brand: 'Yashica', model: 'T4', type: 'film', format: '135' },
  { brand: 'Yashica', model: 'T4 Super', type: 'film', format: '135' },
  { brand: 'Yashica', model: 'T5', type: 'film', format: '135' },
  { brand: 'Nikon', model: '35Ti', type: 'film', format: '135' },
  { brand: 'Nikon', model: '28Ti', type: 'film', format: '135' },
  { brand: 'Nikon', model: 'L35AF', type: 'film', format: '135' },
  { brand: 'Minolta', model: 'TC-1', type: 'film', format: '135' },
  { brand: 'Konica', model: 'Hexar AF', type: 'film', format: '135' },
  { brand: 'Konica', model: 'Big Mini F', type: 'film', format: '135' },
  { brand: 'Fujifilm', model: 'Klasse W', type: 'film', format: '135' },
  { brand: 'Fujifilm', model: 'Klasse S', type: 'film', format: '135' },
  { brand: 'Fujifilm', model: 'Tiara', type: 'film', format: '135' },

  // 135 Rangefinder — Voigtländer Bessa
  { brand: 'Voigtländer', model: 'Bessa R', type: 'film', format: '135' },
  { brand: 'Voigtländer', model: 'Bessa R2', type: 'film', format: '135' },
  { brand: 'Voigtländer', model: 'Bessa R3A', type: 'film', format: '135' },
  { brand: 'Voigtländer', model: 'Bessa T', type: 'film', format: '135' },
  { brand: 'Voigtländer', model: 'Bessa L', type: 'film', format: '135' },

  // 135 Compact — Rollei
  { brand: 'Rollei', model: '35', type: 'film', format: '135' },
  { brand: 'Rollei', model: '35S', type: 'film', format: '135' },
  { brand: 'Rollei', model: '35T', type: 'film', format: '135' },
  { brand: 'Rollei', model: '35 SE', type: 'film', format: '135' },

  // 135 Lomography / Lo-Fi
  { brand: 'Lomography', model: 'LC-A', type: 'film', format: '135' },
  { brand: 'Lomography', model: 'LC-A+', type: 'film', format: '135' },
  { brand: 'Lomography', model: 'LC-Wide', type: 'film', format: '135' },
  { brand: 'Lomography', model: 'Sprocket Rocket', type: 'film', format: '135' },

  // 135 — Konica
  { brand: 'Konica', model: 'AutoReflex T3', type: 'film', format: '135' },
  { brand: 'Konica', model: 'FTA', type: 'film', format: '135' },

  // ─────────────────────────────────────────────
  // 120 TLR (Twin Lens Reflex)
  // ─────────────────────────────────────────────
  { brand: 'Rolleiflex', model: '2.8F', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Rolleiflex', model: '3.5F', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Rolleicord', model: 'Va', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Yashica', model: 'Mat-124G', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Yashica', model: '635', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Minolta', model: 'Autocord', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Mamiya', model: 'C220', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Mamiya', model: 'C330', type: 'film', format: '120', backType: 'fixed' },

  // 120 SLR — Hasselblad (interchangeable backs)
  {
    brand: 'Hasselblad',
    model: '500CM',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Hasselblad V',
    backs: ['A12 Back', 'A16 Back', 'A24 Back', 'A32 Back'],
  },
  {
    brand: 'Hasselblad',
    model: '501CM',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Hasselblad V',
    backs: ['A12 Back', 'A16 Back', 'A24 Back', 'A32 Back'],
  },
  {
    brand: 'Hasselblad',
    model: '503CW',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Hasselblad V',
    backs: ['A12 Back', 'A16 Back', 'A24 Back', 'A32 Back'],
  },
  {
    brand: 'Hasselblad',
    model: 'X-Pan',
    type: 'film',
    format: '135',
    backType: 'fixed',
  },

  // 120 SLR — Mamiya (interchangeable backs)
  {
    brand: 'Mamiya',
    model: 'RB67 Pro-S',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Mamiya RB67',
    backs: ['6x7 120 Back', '6x6 Back', '6x4.5 Back', 'Polaroid Back'],
  },
  {
    brand: 'Mamiya',
    model: 'RB67 Pro SD',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Mamiya RB67',
    backs: ['6x7 120 Back', '6x6 Back', '6x4.5 Back', 'Polaroid Back'],
  },
  {
    brand: 'Mamiya',
    model: 'RZ67 Pro II',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Mamiya RZ67',
    backs: ['6x7 120 Back', '6x4.5 Back', 'Polaroid Back'],
  },

  // 120 SLR — Mamiya 645 / fixed
  { brand: 'Mamiya', model: '645 Pro', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Mamiya', model: '645 Pro TL', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Mamiya', model: '645E', type: 'film', format: '120', backType: 'fixed' },

  // 120 Rangefinder — Mamiya
  { brand: 'Mamiya', model: '6', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Mamiya', model: '7', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Mamiya', model: '7 II', type: 'film', format: '120', backType: 'fixed' },

  // 120 SLR — Pentax 6x7
  { brand: 'Pentax', model: '67', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Pentax', model: '67 II', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Pentax', model: '645', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Pentax', model: '645N', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Pentax', model: '645NII', type: 'film', format: '120', backType: 'fixed' },

  // 120 Rangefinder — Fujifilm
  { brand: 'Fujifilm', model: 'GW690 III', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Fujifilm', model: 'GSW690 III', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Fujifilm', model: 'GA645', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Fujifilm', model: 'GA645W', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Fujifilm', model: 'GF670', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Fujifilm', model: 'G617', type: 'film', format: '120', backType: 'fixed' },

  // 120 SLR — Bronica (interchangeable backs)
  {
    brand: 'Bronica',
    model: 'SQ-A',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Bronica SQ',
    backs: ['120 6x6 Back', '220 6x6 Back'],
  },
  {
    brand: 'Bronica',
    model: 'SQ-Ai',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Bronica SQ',
    backs: ['120 6x6 Back', '220 6x6 Back'],
  },
  {
    brand: 'Bronica',
    model: 'ETRSi',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Bronica ETR',
    backs: ['120 6x4.5 Back', '220 6x4.5 Back'],
  },
  {
    brand: 'Bronica',
    model: 'GS-1',
    type: 'film',
    format: '120',
    backType: 'interchangeable',
    cameraSystemName: 'Bronica GS',
    backs: ['120 6x7 Back', '220 6x7 Back'],
  },

  // 120 Toy / Lo-Fi
  { brand: 'Holga', model: '120N', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Holga', model: '120SF', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Lomography', model: 'Diana F+', type: 'film', format: '120', backType: 'fixed' },
  { brand: 'Lomography', model: 'Lubitel 166+', type: 'film', format: '120', backType: 'fixed' },

  // ─────────────────────────────────────────────
  // Digital
  // ─────────────────────────────────────────────
  { brand: 'Fujifilm', model: 'X100V', type: 'digital', format: 'digital' },
  { brand: 'Fujifilm', model: 'X100VI', type: 'digital', format: 'digital' },
  { brand: 'Fujifilm', model: 'X-T5', type: 'digital', format: 'digital' },
  { brand: 'Fujifilm', model: 'X-Pro3', type: 'digital', format: 'digital' },
  { brand: 'Sony', model: 'A7 III', type: 'digital', format: 'digital' },
  { brand: 'Sony', model: 'A7 IV', type: 'digital', format: 'digital' },
  { brand: 'Sony', model: 'A7C II', type: 'digital', format: 'digital' },
  { brand: 'Canon', model: 'EOS R5', type: 'digital', format: 'digital' },
  { brand: 'Canon', model: 'EOS R6 Mark II', type: 'digital', format: 'digital' },
  { brand: 'Nikon', model: 'Z6 III', type: 'digital', format: 'digital' },
  { brand: 'Nikon', model: 'Zf', type: 'digital', format: 'digital' },
  { brand: 'Leica', model: 'M11', type: 'digital', format: 'digital' },
];
