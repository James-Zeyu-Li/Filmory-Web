import React, { useState, useEffect, useMemo } from 'react';
import type { PhotoAsset } from '../../db/schema';
import { Search, Sliders, ChevronLeft, ChevronRight, X, Star, Calendar, Images } from 'lucide-react';
import './PhotosView.css';
import { useCameras, useFilmStocks, usePhotoAssets, useRolls } from '../../hooks/useData';
import { usePhotoUrlMap } from '../../hooks/usePhotoUrlMap';
import { EmptyState } from '../../components/EmptyState';

interface PhotosViewProps {
  enableFilmMode: boolean;
}

export const PhotosView: React.FC<PhotosViewProps> = ({ enableFilmMode }) => {
  const [columns, setColumns] = useState(4);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCameraId, setFilterCameraId] = useState<string>('all');
  const [filterFilmId, setFilterFilmId] = useState<string>('all');
  const [filterRating, setFilterRating] = useState<string>('all');

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const cameras = useCameras();
  const filmStocks = useFilmStocks();
  const rolls = useRolls();
  const photoAssets = usePhotoAssets();
  const archivedRolls = useMemo(() => rolls.filter(r => r.status === 'archived'), [rolls]);
  const archivedRollIds = useMemo(() => archivedRolls.map(r => r.id!), [archivedRolls]);
  const allPhotos = useMemo(
    () => photoAssets.filter((photo: PhotoAsset) => archivedRollIds.includes(photo.rollId)),
    [photoAssets, archivedRollIds]
  );

  // Filtered photos
  const filteredPhotos = useMemo(() => allPhotos.filter(photo => {
    // 1. Search filter
    const matchesSearch = photo.originalFileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (photo.note && photo.note.toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Camera filter
    const roll = archivedRolls.find(r => r.id === photo.rollId);
    const matchesCamera = filterCameraId === 'all' || (roll && (roll.cameraIds || []).includes(filterCameraId));

    // 3. Film filter
    const matchesFilm = filterFilmId === 'all' || (roll && roll.filmStockId === filterFilmId);

    // 4. Rating filter
    const matchesRating = filterRating === 'all' || (photo.rating && photo.rating >= Number(filterRating));

    return matchesSearch && matchesCamera && matchesFilm && matchesRating;
  }), [allPhotos, archivedRolls, searchTerm, filterCameraId, filterFilmId, filterRating]);

  const photoUrls = usePhotoUrlMap(filteredPhotos, { preferFull: lightboxIndex !== null });

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'ArrowRight') {
        setLightboxIndex(current => current !== null && current < filteredPhotos.length - 1 ? current + 1 : current);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex(current => current !== null && current > 0 ? current - 1 : current);
      } else if (e.key === 'Escape') {
        setLightboxIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, filteredPhotos]);

  const handleNext = () => {
    if (lightboxIndex !== null && lightboxIndex < filteredPhotos.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const handlePrev = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  // Helper metadata
  const getPhotoMetadata = (photo: PhotoAsset) => {
    const roll = archivedRolls.find(r => r.id === photo.rollId);
    if (!roll) return null;
    const camera = cameras.find(c => (roll.cameraIds || []).includes(c.id!));
    const film = filmStocks.find(f => f.id === roll.filmStockId);
    return {
      rollName: roll.name,
      cameraName: camera?.name || '未知相机',
      filmName: film ? (film.isSystem === 1 ? '数码' : `${film.brand} ${film.name}`) : '未知胶卷'
    };
  };

  const currentLightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;
  const currentMeta = currentLightboxPhoto ? getPhotoMetadata(currentLightboxPhoto) : null;
  const hasActiveFilters = searchTerm.trim() !== '' || filterCameraId !== 'all' || filterFilmId !== 'all' || filterRating !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setFilterCameraId('all');
    setFilterFilmId('all');
    setFilterRating('all');
  };

  return (
    <div className="main-content">
      <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon">
            <Images size={20} />
          </div>
          <div className="view-header-text-group">
            <h1>照片库</h1>
            <p className="view-header-subtitle">浏览已归档胶卷记录中的精选照片和参考照片。</p>
          </div>
        </div>
        <div className="view-header-actions">
          <div className="grid-zoom-slider">
            <span>网格缩放</span>
            <input 
              type="range" 
              min="2" 
              max="8" 
              value={columns}
              onChange={e => setColumns(Number(e.target.value))}
            />
          </div>
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="search-bar">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="搜索照片名称或备注..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-selects">
          <select 
            className="filter-select"
            value={filterCameraId}
            onChange={e => setFilterCameraId(e.target.value)}
          >
            <option value="all">📷 所有相机</option>
            {cameras.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {enableFilmMode && (
            <select 
              className="filter-select"
              value={filterFilmId}
              onChange={e => setFilterFilmId(e.target.value)}
            >
              <option value="all">🎞️ 所有胶卷</option>
              {filmStocks.filter(f => f.isSystem === 0).map(f => (
                <option key={f.id} value={f.id}>{f.brand} {f.name}</option>
              ))}
            </select>
          )}

          <select 
            className="filter-select"
            value={filterRating}
            onChange={e => setFilterRating(e.target.value)}
          >
            <option value="all">⭐ 所有评分</option>
            <option value="5">⭐⭐⭐⭐⭐ (5星)</option>
            <option value="4">⭐⭐⭐⭐及以上 (&gt;=4星)</option>
            <option value="3">⭐⭐⭐及以上 (&gt;=3星)</option>
          </select>
        </div>
      </div>

      <div className="view-body">
        {filteredPhotos.length === 0 ? (
          <EmptyState
            icon={Sliders}
            title={allPhotos.length === 0 ? '还没有可浏览的照片' : '没有找到符合条件的照片'}
            description={
              allPhotos.length === 0
                ? '先在已归档的胶卷记录里保存几张精选照片，这里就会自动整理出来。'
                : '尝试清除搜索词或筛选条件，重新查看全部照片。'
            }
            action={hasActiveFilters ? <button className="primary" onClick={resetFilters}>清除筛选</button> : undefined}
          />
        ) : (
          <div 
            className="photos-masonry-grid" 
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {filteredPhotos.map((photo, index) => {
              const meta = getPhotoMetadata(photo);
              return (
                <div 
                  key={photo.id} 
                  className="photo-card"
                  onClick={() => setLightboxIndex(index)}
                >
                  <img src={photoUrls[photo.id!]} alt={photo.originalFileName} />
                  <div className="photo-card-overlay">
                    <div className="photo-card-meta">
                      <h4>{meta?.rollName}</h4>
                      <span>{meta?.cameraName} {enableFilmMode && `· ${meta?.filmName}`}</span>
                    </div>
                    {photo.rating && (
                      <div className="photo-card-rating">
                        <Star size={12} fill="var(--accent)" color="var(--accent)" />
                        <span>{photo.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- LIGHTBOX MODAL --- */}
      {lightboxIndex !== null && currentLightboxPhoto && (
        <div className="lightbox-overlay">
          <button className="lightbox-close" onClick={() => setLightboxIndex(null)}>
            <X size={24} />
          </button>

          <button 
            className="lightbox-nav left" 
            disabled={lightboxIndex === 0}
            onClick={handlePrev}
          >
            <ChevronLeft size={36} />
          </button>

          <div className="lightbox-container">
            <img src={photoUrls[currentLightboxPhoto.id!]} alt={currentLightboxPhoto.originalFileName} />
            
            {/* Metadata Bottom Panel */}
            <div className="lightbox-meta-panel">
              <div className="meta-row-primary">
                <div>
                  <h3>{currentMeta?.rollName}</h3>
                  <p>{currentMeta?.cameraName} {enableFilmMode && ` · ${currentMeta?.filmName}`}</p>
                </div>
                {currentLightboxPhoto.rating && (
                  <div className="meta-stars">
                    {Array.from({ length: currentLightboxPhoto.rating }).map((_, i) => (
                      <Star key={i} size={16} fill="var(--accent)" color="var(--accent)" />
                    ))}
                  </div>
                )}
              </div>
              <div className="meta-row-parameters">
                {currentLightboxPhoto.focalLength && (
                  <div className="param-chip">
                    <span>焦段</span>
                    <strong>{currentLightboxPhoto.focalLength}mm</strong>
                  </div>
                )}
                {currentLightboxPhoto.aperture && (
                  <div className="param-chip">
                    <span>光圈</span>
                    <strong>{currentLightboxPhoto.aperture}</strong>
                  </div>
                )}
                {currentLightboxPhoto.shutterSpeed && (
                  <div className="param-chip">
                    <span>快门</span>
                    <strong>{currentLightboxPhoto.shutterSpeed}</strong>
                  </div>
                )}
                {currentLightboxPhoto.exposureCompensation !== undefined && (
                  <div className="param-chip">
                    <span>曝光补偿</span>
                    <strong>{currentLightboxPhoto.exposureCompensation > 0 ? `+${currentLightboxPhoto.exposureCompensation}` : currentLightboxPhoto.exposureCompensation} EV</strong>
                  </div>
                )}
                <div className="param-chip date-chip">
                  <Calendar size={12} />
                  <span>{new Date(currentLightboxPhoto.addedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            className="lightbox-nav right" 
            disabled={lightboxIndex === filteredPhotos.length - 1}
            onClick={handleNext}
          >
            <ChevronRight size={36} />
          </button>
        </div>
      )}
    </div>
  );
};
