import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Roll, type PhotoAsset } from '../../db/schema';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { usePhotoUrlMap } from '../../hooks/usePhotoUrlMap';

interface RollArchiveCardProps {
  roll: Roll;
  isSelected: boolean;
  enableFilmMode: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  getCameraName: (id?: string) => string;
  getFilmName: (id?: string) => string;
}

export const RollArchiveCard: React.FC<RollArchiveCardProps> = ({
  roll, isSelected, enableFilmMode, onSelect, onDelete, getCameraName, getFilmName
}) => {
  const { user } = useAuth();
  // Query only the first 6 photos for this specific roll
  const photos = useLiveQuery<PhotoAsset[]>(async () => {
    return await db.photoAssets
      .where('rollId').equals(roll.id!)
      .filter(p => p.userId === user?.id)
      .limit(6)
      .toArray();
  }, [roll.id, user?.id]) || [];

  const photoUrls = usePhotoUrlMap(photos);

  return (
    <div 
      className={`roll-item archived-roll ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(roll.id!)}
    >
      <div className="archived-roll-header">
        <div className="roll-info">
          <h4>{roll.name}</h4>
          <span>{(roll.cameraIds || []).map(getCameraName).join(', ')} {enableFilmMode && roll.filmStockId !== 'digital-placeholder' && `· ${getFilmName(roll.filmStockId)}`}</span>
        </div>
        <button className="danger icon-btn" onClick={(e) => { e.stopPropagation(); onDelete(roll.id!, e); }}>
          <Trash2 size={12} />
        </button>
      </div>

      {/* Carousel */}
      {photos.length > 0 && (
        <div 
          className="roll-carousel" 
          onClick={() => {
            // we don't stop propagation here so clicking the carousel still selects the roll
          }}
        >
          {photos.map(p => (
            <div key={p.id} className="carousel-photo-tile">
              <img src={photoUrls[p.id!]} alt={p.originalFileName} />
            </div>
          ))}
          {photos.length === 6 && (
            <div className="carousel-more-indicator">
              <span>...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
