import React from 'react';
import { Film } from 'lucide-react';

// Eager load all SVG assets from the assets directory using Vite's glob import
const svgModules = import.meta.glob('../assets/filmstock_icons/svg/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});

interface FilmSvgAvatarProps {
  brand: string;
  name: string;
  format: string;
  size?: number;
}

export const FilmSvgAvatar: React.FC<FilmSvgAvatarProps> = ({ 
  brand, 
  name, 
  format, 
  size = 80 
}) => {
  // Normalize parameters to match filenames: lowercase, strip everything
  // except alphanumerics so punctuation differences (hyphens, parens,
  // apostrophes) between catalog names and generated filenames don't
  // cause a specific icon to silently miss and fall back to a generic one.
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normBrand = normalize(brand);
  const normName = normalize(name);
  const normFormat = format.trim();

  // 1. Try specific film stock matching: e.g. "kodak|gold200|135.svg"
  const specificFileName = `svg/${normBrand}|${normName}|${normFormat}.svg`;
  const specificKey = Object.keys(svgModules).find(k => k.toLowerCase().endsWith(specificFileName));

  let resolvedUrl = '';

  if (specificKey) {
    resolvedUrl = svgModules[specificKey] as string;
  } else {
    // 2. Try brand-level fallback: e.g. "brand|Kodak.svg"
    const brandFileName = `svg/brand|${normBrand}.svg`;
    const brandKey = Object.keys(svgModules).find(k => k.toLowerCase().endsWith(brandFileName));
    
    if (brandKey) {
      resolvedUrl = svgModules[brandKey] as string;
    } else {
      // 3. Try generic fallback: e.g. "brand|Generic.svg"
      const genericKey = Object.keys(svgModules).find(k => k.toLowerCase().endsWith('svg/brand|generic.svg'));
      if (genericKey) {
        resolvedUrl = svgModules[genericKey] as string;
      }
    }
  }

  return (
    <div 
      className="film-svg-avatar" 
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'transparent',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}
    >
      {resolvedUrl ? (
        <img 
          src={resolvedUrl} 
          alt={`${brand} ${name}`} 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Film size={24} color="var(--text-muted)" />
      )}
    </div>
  );
};
