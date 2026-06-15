import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PhotoAsset } from '../../db/schema';
import { Columns, Split, Link as LinkIcon, Link2Off, Sparkles } from 'lucide-react';
import './CompareView.css';

export const CompareView: React.FC = () => {
  const [rollAId, setRollAId] = useState<number | ''>('');
  const [rollBId, setRollBId] = useState<number | ''>('');
  const [viewMode, setViewMode] = useState<'sideBySide' | 'split'>('sideBySide');
  const [isLinkedScroll, setIsLinkedScroll] = useState(false);

  // Split slider select photo state
  const [photoAId, setPhotoAId] = useState<number | null>(null);
  const [photoBId, setPhotoBId] = useState<number | null>(null);

  // Live queries
  const archivedRolls = useLiveQuery(() => db.rolls.where('status').equals('archived').toArray()) || [];
  const cameras = useLiveQuery(() => db.cameras.toArray()) || [];
  const filmStocks = useLiveQuery(() => db.filmStocks.toArray()) || [];

  const photosA = useLiveQuery<PhotoAsset[]>(() => 
    rollAId ? db.photoAssets.where('rollId').equals(Number(rollAId)).toArray() : Promise.resolve([] as PhotoAsset[])
  , [rollAId]) || [];

  const photosB = useLiveQuery<PhotoAsset[]>(() => 
    rollBId ? db.photoAssets.where('rollId').equals(Number(rollBId)).toArray() : Promise.resolve([] as PhotoAsset[])
  , [rollBId]) || [];

  // Generate Image Blob URLs to prevent memory leak and load fast
  const [urls, setUrls] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    const newUrls: { [key: number]: string } = {};
    const allCombined = [...photosA, ...photosB];
    allCombined.forEach(p => {
      if (p.id) {
        newUrls[p.id] = URL.createObjectURL(p.blob);
      }
    });
    setUrls(newUrls);

    // Auto-select first photos for split mode when rolls change
    if (photosA.length > 0 && !photoAId) setPhotoAId(photosA[0].id!);
    if (photosB.length > 0 && !photoBId) setPhotoBId(photosB[0].id!);

    return () => {
      Object.values(newUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [photosA, photosB]);

  // Linked scrolling refs
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<boolean>(false);

  const handleScroll = (source: 'A' | 'B') => {
    if (!isLinkedScroll) return;
    if (isScrollingRef.current) return;

    const sourceEl = source === 'A' ? scrollRefA.current : scrollRefB.current;
    const targetEl = source === 'A' ? scrollRefB.current : scrollRefA.current;

    if (sourceEl && targetEl) {
      isScrollingRef.current = true;
      // Synchronize scroll percentage
      const scrollPct = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight);
      targetEl.scrollTop = scrollPct * (targetEl.scrollHeight - targetEl.clientHeight);
      
      // Reset after a frame
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    }
  };

  const getRollMeta = (id: number) => {
    const roll = archivedRolls.find(r => r.id === id);
    if (!roll) return '';
    const cam = cameras.find(c => c.id === roll.cameraId)?.name || '未知相机';
    const film = filmStocks.find(f => f.id === roll.filmStockId);
    const filmName = film ? (film.isSystem === 1 ? '数码' : `${film.brand} ${film.name}`) : '';
    return `${cam} ${filmName ? `· ${filmName}` : ''}`;
  };

  return (
    <div className="main-content">
      <header className="view-header">
        <h1>对比工作台</h1>
        <div className="view-header-actions">
          {viewMode === 'sideBySide' && (
            <button 
              className={isLinkedScroll ? 'primary' : ''}
              onClick={() => setIsLinkedScroll(!isLinkedScroll)}
              title="联动滚动"
            >
              {isLinkedScroll ? <LinkIcon size={16} /> : <Link2Off size={16} />}
              <span>联动滚动: {isLinkedScroll ? '开启' : '关闭'}</span>
            </button>
          )}

          <div className="compare-mode-toggle">
            <button 
              className={viewMode === 'sideBySide' ? 'primary' : ''}
              onClick={() => setViewMode('sideBySide')}
            >
              <Columns size={16} />
              <span>左右双列</span>
            </button>
            <button 
              className={viewMode === 'split' ? 'primary' : ''}
              onClick={() => setViewMode('split')}
              disabled={!rollAId || !rollBId || photosA.length === 0 || photosB.length === 0}
            >
              <Split size={16} />
              <span>滑尺对比</span>
            </button>
          </div>
        </div>
      </header>

      {/* Select Rolls Bar */}
      <div className="compare-selector-bar">
        <div className="roll-picker">
          <span className="picker-label red-dot">A路 拍摄卷</span>
          <select 
            className="form-control"
            value={rollAId}
            onChange={e => {
              setRollAId(e.target.value === '' ? '' : Number(e.target.value));
              setPhotoAId(null);
            }}
          >
            <option value="">-- 选择A路胶卷 --</option>
            {archivedRolls.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({getRollMeta(r.id!)})</option>
            ))}
          </select>
        </div>

        <div className="roll-picker">
          <span className="picker-label blue-dot">B路 拍摄卷</span>
          <select 
            className="form-control"
            value={rollBId}
            onChange={e => {
              setRollBId(e.target.value === '' ? '' : Number(e.target.value));
              setPhotoBId(null);
            }}
          >
            <option value="">-- 选择B路胶卷 --</option>
            {archivedRolls.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({getRollMeta(r.id!)})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="view-body compare-workspace-body">
        {(!rollAId || !rollBId) ? (
          <div className="empty-state compare-empty">
            <Sparkles size={48} />
            <h3>开始你的影像对比</h3>
            <p>请在上方分别选择A路和B路的已归档胶卷，以便在侧边并列查看色彩、颗粒感和宽容度细节。</p>
          </div>
        ) : (
          <>
            {/* SIDE-BY-SIDE MODE */}
            {viewMode === 'sideBySide' && (
              <div className="side-by-side-container">
                {/* Column A */}
                <div 
                  className="compare-column" 
                  ref={scrollRefA}
                  onScroll={() => handleScroll('A')}
                >
                  <div className="column-info sticky-info">
                    <h4>{archivedRolls.find(r => r.id === rollAId)?.name}</h4>
                    <span>{getRollMeta(Number(rollAId))}</span>
                  </div>
                  <div className="compare-photos-list">
                    {photosA.length === 0 ? (
                      <p className="no-items">这卷没有照片</p>
                    ) : (
                      photosA.map(photo => (
                        <div key={photo.id} className="compare-photo-tile">
                          <img src={urls[photo.id!]} alt={photo.originalFileName} />
                          <div className="compare-photo-meta">
                            {photo.focalLength && `${photo.focalLength}mm `}
                            {photo.aperture && `${photo.aperture} `}
                            {photo.shutterSpeed && `${photo.shutterSpeed}`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Column B */}
                <div 
                  className="compare-column" 
                  ref={scrollRefB}
                  onScroll={() => handleScroll('B')}
                >
                  <div className="column-info sticky-info">
                    <h4>{archivedRolls.find(r => r.id === rollBId)?.name}</h4>
                    <span>{getRollMeta(Number(rollBId))}</span>
                  </div>
                  <div className="compare-photos-list">
                    {photosB.length === 0 ? (
                      <p className="no-items">这卷没有照片</p>
                    ) : (
                      photosB.map(photo => (
                        <div key={photo.id} className="compare-photo-tile">
                          <img src={urls[photo.id!]} alt={photo.originalFileName} />
                          <div className="compare-photo-meta">
                            {photo.focalLength && `${photo.focalLength}mm `}
                            {photo.aperture && `${photo.aperture} `}
                            {photo.shutterSpeed && `${photo.shutterSpeed}`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SPLIT SLIDER MODE */}
            {viewMode === 'split' && photoAId && photoBId && (
              <div className="split-slider-workspace">
                <div className="split-photo-selectors">
                  <div className="photo-picker-cell">
                    <span>A路照片选择:</span>
                    <select 
                      className="form-control"
                      value={photoAId}
                      onChange={e => setPhotoAId(Number(e.target.value))}
                    >
                      {photosA.map((p, idx) => (
                        <option key={p.id} value={p.id}>照片 {idx + 1} ({p.originalFileName})</option>
                      ))}
                    </select>
                  </div>
                  <div className="photo-picker-cell">
                    <span>B路照片选择:</span>
                    <select 
                      className="form-control"
                      value={photoBId}
                      onChange={e => setPhotoBId(Number(e.target.value))}
                    >
                      {photosB.map((p, idx) => (
                        <option key={p.id} value={p.id}>照片 {idx + 1} ({p.originalFileName})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="split-slider-canvas">
                  <ImageSlider imgA={urls[photoAId]} imgB={urls[photoBId]} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Split Screen Slider implementation
interface ImageSliderProps {
  imgA: string;
  imgB: string;
}

const ImageSlider: React.FC<ImageSliderProps> = ({ imgA, imgB }) => {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage 0 - 100
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Only move if dragging or just on mouse move (like slider hover)
    if (e.buttons === 1 || e.buttons === 0) {
      handleMove(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  return (
    <div 
      className="image-slider-container" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* Background Image B */}
      <img src={imgB} className="image-slider-bg" alt="Image B" />
      
      {/* Foreground Image A (clipped by container width) */}
      <div 
        className="image-slider-fg-container" 
        style={{ width: `${sliderPosition}%` }}
      >
        <img src={imgA} className="image-slider-fg" alt="Image A" />
      </div>

      {/* Slider Split Drag Handle Line */}
      <div 
        className="image-slider-handle" 
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="handle-line" />
        <div className="handle-button">↔</div>
      </div>

      <div className="slider-label label-left">A路 (左)</div>
      <div className="slider-label label-right">B路 (右)</div>
    </div>
  );
};
