import React from 'react';

interface LensSvgAvatarProps {
  focalLength: number;
  type: string; // 'prime' | 'zoom'
  size?: number;
}

export const LensSvgAvatar: React.FC<LensSvgAvatarProps> = ({ 
  focalLength, 
  type, 
  size = 80 
}) => {
  // Determine lens category
  let category: 'wide' | 'standard' | 'telephoto' = 'standard';
  if (focalLength < 35) {
    category = 'wide';
  } else if (focalLength > 70) {
    category = 'telephoto';
  }

  // Common glass styling
  const glassStyle = {
    fill: 'rgba(56, 189, 248, 0.15)', // light blue tint
    stroke: 'var(--accent, #38bdf8)',
    strokeWidth: 1.5,
  };

  const barrelColor = 'var(--text-muted, #6b7280)';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className="lens-svg-avatar"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Sky blue glow for high-quality optical elements */}
        <filter id="lens-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        {/* Soft linear gradient for barrel shading */}
        <linearGradient id="barrel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
      </defs>

      {/* 1. Outermost Chassis (Lens mount base) */}
      <rect x="35" y="80" width="30" height="6" rx="1" fill="#9ca3af" stroke="#4b5563" strokeWidth="1" />
      <path d="M 40 80 L 45 68 L 55 68 L 60 80 Z" fill="#4b5563" />

      {/* 2. Lens Category Schematics */}
      {category === 'wide' && (
        <g>
          {/* Outer barrel (Short & Wide) */}
          <path d="M 30 25 L 70 25 L 65 68 L 35 68 Z" fill="url(#barrel-gradient)" stroke={barrelColor} strokeWidth="1.5" />
          
          {/* Bulbous front element (Wide Dome) */}
          <path 
            d="M 25 25 Q 50 -5 75 25 Q 50 10 25 25 Z" 
            {...glassStyle} 
            filter="url(#lens-glow)"
          />

          {/* Inner elements (concave and convex groupings) */}
          <path d="M 35 40 Q 50 48 65 40 Q 50 52 35 40 Z" {...glassStyle} />
          <path d="M 38 52 Q 50 58 62 52 Q 50 62 38 52 Z" {...glassStyle} />
          
          {/* Aperture blades indication */}
          <line x1="42" y1="60" x2="48" y2="60" stroke="#f59e0b" strokeWidth="2" />
          <line x1="52" y1="60" x2="58" y2="60" stroke="#f59e0b" strokeWidth="2" />
          
          {/* Flat rear element */}
          <path d="M 42 66 L 58 66 L 58 68 L 42 68 Z" {...glassStyle} />

          {/* Focal length indicator text decoration */}
          <text x="50" y="5" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="bold" letterSpacing="0.5">WIDE</text>
        </g>
      )}

      {category === 'standard' && (
        <g>
          {/* Outer barrel (Medium) */}
          <path d="M 32 20 L 68 20 L 62 68 L 38 68 Z" fill="url(#barrel-gradient)" stroke={barrelColor} strokeWidth="1.5" />
          
          {/* Standard gently curved front element */}
          <path 
            d="M 30 20 Q 50 0 70 20 Q 50 25 30 20 Z" 
            {...glassStyle} 
            filter="url(#lens-glow)"
          />

          {/* Doublet elements (Plano-convex & Concave glued) */}
          <path d="M 35 34 Q 50 40 65 34 Q 50 45 35 34 Z" {...glassStyle} />
          <path d="M 37 46 Q 50 42 63 46 L 61 50 Q 50 46 39 50 Z" {...glassStyle} />
          
          {/* Aperture iris */}
          <line x1="40" y1="56" x2="46" y2="56" stroke="#f59e0b" strokeWidth="2" />
          <line x1="54" y1="56" x2="60" y2="56" stroke="#f59e0b" strokeWidth="2" />

          {/* Rear element */}
          <path d="M 41 62 Q 50 60 59 62 L 58 66 Q 50 64 42 66 Z" {...glassStyle} />

          <text x="50" y="5" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="bold" letterSpacing="0.5">STD</text>
        </g>
      )}

      {category === 'telephoto' && (
        <g>
          {/* Outer barrel (Long & Stretched) */}
          <path d="M 34 10 L 66 10 L 60 68 L 40 68 Z" fill="url(#barrel-gradient)" stroke={barrelColor} strokeWidth="1.5" />
          
          {/* Focus grip ring indicators (grooves) */}
          <rect x="33.5" y="24" width="33" height="4" fill="#1f2937" />
          <rect x="33.5" y="30" width="33" height="4" fill="#1f2937" />
          
          {/* Front elements grouping (Doublet) */}
          <path 
            d="M 34 10 L 66 10 L 64 14 L 36 14 Z" 
            {...glassStyle} 
            filter="url(#lens-glow)"
          />
          <path d="M 37 18 Q 50 24 63 18 L 62 21 Q 50 27 38 21 Z" {...glassStyle} />

          {/* Middle dispersive element */}
          <path d="M 39 36 Q 50 32 61 36 L 60 40 Q 50 36 40 40 Z" {...glassStyle} />

          {/* Aperture blades */}
          <line x1="41" y1="48" x2="47" y2="48" stroke="#f59e0b" strokeWidth="2" />
          <line x1="53" y1="48" x2="59" y2="48" stroke="#f59e0b" strokeWidth="2" />

          {/* Rear focusing elements */}
          <path d="M 41 54 Q 50 58 59 54 L 59 58 Q 50 62 41 58 Z" {...glassStyle} />
          <path d="M 41 64 L 59 64 L 59 66 L 41 66 Z" {...glassStyle} />

          <text x="50" y="5" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="bold" letterSpacing="0.5">TELE</text>
        </g>
      )}

      {/* Decorative Focus Thread / Scale line */}
      {type === 'zoom' && (
        <path d="M 45 42 Q 50 44 55 42" stroke="#10b981" strokeWidth="1" fill="none" />
      )}
    </svg>
  );
};
