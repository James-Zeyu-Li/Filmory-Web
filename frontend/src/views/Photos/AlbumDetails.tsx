import React, { useState, useEffect } from 'react';
import { db, type PhotoAsset } from '../../db/schema';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { usePhotoUrlMap } from '../../hooks/usePhotoUrlMap';
import { useAlbums, useAlbumPhotos, usePhotoAssets, useCameras, useFilmStocks, useTagConfigs, useRolls } from '../../hooks/useData';
import { 
  ChevronLeft, ChevronRight, Plus, Trash2, Image as ImageIcon, 
  Star, X, Check, Trash, Sliders, Calendar 
} from 'lucide-react';

interface AlbumDetailsProps {
  albumId: string;
  onBack: () => void;
  enableFilmMode: boolean;
}

export const AlbumDetails: React.FC<AlbumDetailsProps> = ({ 
  albumId, onBack, enableFilmMode 
}) => {
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isBulkManaging, setIsBulkManaging] = useState(false);
  const [bulkSelectForRemoval, setBulkSelectForRemoval] = useState<Set<string>>(new Set());
  const [isEditingTags, setIsEditingTags] = useState(false);

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Data hooks
  const allAlbums = useAlbums();
  const album = React.useMemo(() => allAlbums.find(a => a.id === albumId), [allAlbums, albumId]);
  
  const allAlbumPhotos = useAlbumPhotos();
  const albumPhotos = React.useMemo(() => allAlbumPhotos.filter(ap => ap.albumId === albumId), [allAlbumPhotos, albumId]);

  const allPhotoAssets = usePhotoAssets();
  const photos = React.useMemo(() => {
    const photoIds = albumPhotos.map(ap => ap.photoId);
    return allPhotoAssets.filter(p => photoIds.includes(p.id!));
  }, [allPhotoAssets, albumPhotos]);

  const cameras = useCameras();
  const filmStocks = useFilmStocks();
  const tagConfigs = useTagConfigs();
  const rolls = useRolls();

  const photoUrls = usePhotoUrlMap(photos, { preferFull: lightboxIndex !== null });

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in a search box or input, do not intercept
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if (lightboxIndex === null) return;
      
      if (e.key === 'ArrowRight' && lightboxIndex < photos.length - 1) {
        setLightboxIndex(lightboxIndex + 1);
        setIsEditingTags(false);
      } else if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1);
        setIsEditingTags(false);
      } else if (e.key === 'Escape') {
        setLightboxIndex(null);
        setIsEditingTags(false);
      } else if (e.key >= '1' && e.key <= '5') {
        // Quick Rate
        const photo = photos[lightboxIndex];
        if (photo && photo.id) db.photoAssets.update(photo.id, { rating: parseInt(e.key) });
      } else if (e.key === '0' || e.key === '`') {
        // Clear Rate
        const photo = photos[lightboxIndex];
        if (photo && photo.id) db.photoAssets.update(photo.id, { rating: undefined });
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Quick Delete
        const photo = photos[lightboxIndex];
        if (photo && photo.id) {
          // Optimistically adjust index before db deletes
          if (lightboxIndex === photos.length - 1) {
            setLightboxIndex(lightboxIndex > 0 ? lightboxIndex - 1 : null);
          }
          // Trigger delete
          db.photoAssets.delete(photo.id).then(() => {
            db.albumPhotos.where('photoId').equals(photo.id!).delete();
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, photos]);

  const handleTogglePhotoTag = async (photo: PhotoAsset, tagName: string) => {
    const currentTags = photo.tags ? photo.tags.split(',') : [];
    let nextTags: string[];
    if (currentTags.includes(tagName)) {
      nextTags = currentTags.filter(t => t !== tagName);
    } else {
      nextTags = [...currentTags, tagName];
    }
    const tagsString = nextTags.length > 0 ? nextTags.join(',') : undefined;
    
    // 1. Update Dexie
    await db.photoAssets.update(photo.id!, { tags: tagsString });

    // 2. Sync to Backend if connected
    const apiBaseUrl = localStorage.getItem('filmory_api_base_url');
    const accessToken = localStorage.getItem('filmory_access_token');
    if (apiBaseUrl && accessToken) {
      try {
        await fetch(`${apiBaseUrl}/api/photos/${photo.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ tags: tagsString || '' })
        });
      } catch (err) {
        console.warn('Failed to sync photo tags update:', err);
      }
    }
  };

  const handleDeleteAlbum = async () => {
    const confirmed = await confirm({
      title: '删除相册',
      message: '确定要删除这个相册吗？照片本身不会被删除，仅删除分类。',
      confirmText: '确认删除',
      isDanger: true
    });
    if (!confirmed) return;

    await db.transaction('rw', db.albums, db.albumPhotos, async () => {
      // 1. Delete mapping associations
      await db.albumPhotos.where('albumId').equals(albumId).delete();
      // 2. Delete album metadata
      await db.albums.delete(albumId);
    });
    onBack();
  };

  const handleSetCover = async (photoId: string) => {
    await db.albums.update(albumId, { coverPhotoId: photoId });
    notify({
      type: 'success',
      title: '封面已更新'
    });
  };

  const handleToggleBulkRemovalSelection = (photoId: string) => {
    const newSet = new Set(bulkSelectForRemoval);
    if (newSet.has(photoId)) {
      newSet.delete(photoId);
    } else {
      newSet.add(photoId);
    }
    setBulkSelectForRemoval(newSet);
  };

  const handleRemoveSelectedPhotos = async () => {
    if (bulkSelectForRemoval.size === 0) return;
    const confirmed = await confirm({
      title: '移除照片',
      message: `确定要从相册中移出这 ${bulkSelectForRemoval.size} 张照片吗？照片本身不会被删除。`,
      confirmText: '确认移除'
    });
    if (!confirmed) return;

    const idsToRemove = Array.from(bulkSelectForRemoval);
    const mappingKeysToRemove = albumPhotos
      .filter((m: any) => idsToRemove.includes(m.photoId))
      .map((m: any) => m.id!);

    await db.albumPhotos.bulkDelete(mappingKeysToRemove);

    // If cover photo is removed, clear it
    if (album && album.coverPhotoId && idsToRemove.includes(album.coverPhotoId)) {
      await db.albums.update(albumId, { coverPhotoId: undefined });
    }

    setBulkSelectForRemoval(new Set());
    setIsBulkManaging(false);
  };

  const getPhotoMetadata = (photo: PhotoAsset) => {
    const roll = rolls.find(r => r.id === photo.rollId);
    if (!roll) return null;
    const camera = cameras.find(c => (roll.cameraIds || []).includes(c.id!));
    const film = filmStocks.find(f => f.id === roll.filmStockId);
    return {
      rollName: roll.name,
      cameraName: camera?.name || '未知相机',
      filmName: film ? (film.isSystem === 1 ? '数码' : `${film.brand} ${film.name}`) : '未知胶卷'
    };
  };

  const currentLightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;
  const currentMeta = currentLightboxPhoto ? getPhotoMetadata(currentLightboxPhoto) : null;

  if (!album) {
    return (
      <div className="view-body">
        <p className="no-data">加载中...</p>
      </div>
    );
  }

  return (
    <div className="view-body">
      {/* Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="secondary icon-btn" onClick={onBack}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>返回相册列表</span>
      </div>

      {/* Album Details Metadata Header */}
      <div className="album-details-header">
        <div className="album-details-title-row">
          <div>
            <h2>{album.name}</h2>
            <p className="album-details-meta">
              创建于 {new Date(album.addedAt).toLocaleDateString()} · {photos.length} 张照片
            </p>
          </div>
          <div className="album-details-actions">
            {!isBulkManaging ? (
              <>
                <button className="primary" onClick={() => setShowAddModal(true)}>
                  <Plus size={16} />
                  <span>添加照片</span>
                </button>
                {photos.length > 0 && (
                  <button className="secondary" onClick={() => setIsBulkManaging(true)}>
                    <Sliders size={16} />
                    <span>批量管理</span>
                  </button>
                )}
                <button className="danger" onClick={handleDeleteAlbum}>
                  <Trash2 size={16} />
                  <span>删除相册</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  className="danger" 
                  onClick={handleRemoveSelectedPhotos}
                  disabled={bulkSelectForRemoval.size === 0}
                >
                  <Trash size={16} />
                  <span>移出选中的 ({bulkSelectForRemoval.size})</span>
                </button>
                <button className="secondary" onClick={() => {
                  setIsBulkManaging(false);
                  setBulkSelectForRemoval(new Set());
                }}>
                  取消
                </button>
              </>
            )}
          </div>
        </div>
        {album.description && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
            {album.description}
          </p>
        )}
      </div>

      {/* Album Photos Grid */}
      {photos.length === 0 ? (
        <div className="empty-state">
          <ImageIcon size={48} />
          <h3>相册内暂无照片</h3>
          <p>点击上方“添加照片”按钮，从不同拍摄卷中勾选导入精彩作品吧。</p>
          <button className="primary" onClick={() => setShowAddModal(true)} style={{ marginTop: '10px' }}>
            添加照片
          </button>
        </div>
      ) : (
        <div className="photos-masonry-grid" style={{ gridTemplateColumns: `repeat(4, 1fr)` }}>
          {photos.map((photo, index) => {
            const meta = getPhotoMetadata(photo);
            const isSelectedForRemoval = bulkSelectForRemoval.has(photo.id!);
            const tags = photo.tags ? photo.tags.split(',') : [];
            
            return (
              <div 
                key={photo.id} 
                className={`photo-card ${isSelectedForRemoval ? 'selected-for-removal' : ''}`}
                style={{
                  border: isSelectedForRemoval ? '2px solid var(--danger)' : '1px solid var(--border-color)',
                  opacity: isBulkManaging && !isSelectedForRemoval ? 0.7 : 1
                }}
                onClick={() => {
                  if (isBulkManaging) {
                    handleToggleBulkRemovalSelection(photo.id!);
                  } else {
                    setLightboxIndex(index);
                  }
                }}
              >
                <img src={photoUrls[photo.id!]} alt={photo.originalFileName} />
                
                {isBulkManaging && (
                  <div 
                    className="selector-photo-checkbox" 
                    style={{ 
                      backgroundColor: isSelectedForRemoval ? 'var(--danger)' : 'rgba(0,0,0,0.6)',
                      borderColor: isSelectedForRemoval ? 'var(--danger)' : 'var(--border-color)',
                      color: '#fff'
                    }}
                  >
                    {isSelectedForRemoval ? '✓' : ''}
                  </div>
                )}

                <div className="photo-card-overlay">
                  <div className="photo-card-meta">
                    <h4>{meta?.rollName}</h4>
                    <span>{meta?.cameraName} {enableFilmMode && `· ${meta?.filmName}`}</span>
                    {photo.tags && (
                      <div className="photo-card-tags" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {tags.map((tagName: string) => {
                          const tagConf = tagConfigs.find(tc => tc.name === tagName);
                          const tagColor = tagConf ? tagConf.color : 'var(--text-secondary)';
                          return (
                            <span 
                              key={tagName} 
                              style={{ 
                                backgroundColor: `${tagColor}22`, 
                                color: tagColor, 
                                borderColor: tagColor,
                                border: '1px solid',
                                fontSize: '9px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}
                            >
                              {tagName}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isBulkManaging && (
                      <button 
                        className="icon-btn btn-sm" 
                        title="设为相册封面"
                        style={{ background: 'rgba(0,0,0,0.6)', border: 'none', padding: '6px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetCover(photo.id!);
                        }}
                      >
                        <Check size={12} color={album.coverPhotoId === photo.id ? 'var(--accent)' : '#fff'} />
                      </button>
                    )}
                    {photo.rating && (
                      <div className="photo-card-rating">
                        <Star size={12} fill="var(--accent)" color="var(--accent)" />
                        <span>{photo.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- ADD PHOTOS MODAL --- */}
      {showAddModal && (
        <AddPhotosModal 
          existingPhotoIds={new Set(albumPhotos.map(ap => ap.photoId))}
          onClose={() => setShowAddModal(false)}
          onSave={async (selectedIds) => {
            const records = selectedIds.map(pid => ({
              albumId,
              photoId: pid,
              addedAt: Date.now()
            }));
            await db.albumPhotos.bulkAdd(records);
            setShowAddModal(false);
          }}
          enableFilmMode={enableFilmMode}
        />
      )}

      {/* --- LIGHTBOX MODAL --- */}
      {lightboxIndex !== null && currentLightboxPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxIndex(null)}>
          <button className="lightbox-close" onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}>
            <X size={24} />
          </button>

          <button 
            className="lightbox-nav left" 
            disabled={lightboxIndex === 0}
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
          >
            <ChevronLeft size={36} />
          </button>

          <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
            <img src={photoUrls[currentLightboxPhoto.id!]} alt={currentLightboxPhoto.originalFileName} />
            
            {/* Metadata Panel */}
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

              {/* Active Tags list inside lightbox metadata panel */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', position: 'relative' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>标签：</span>
                {currentLightboxPhoto.tags ? (
                  currentLightboxPhoto.tags.split(',').map((tagName: string) => {
                    const tagConf = tagConfigs.find(tc => tc.name === tagName);
                    const tagColor = tagConf ? tagConf.color : 'var(--text-secondary)';
                    return (
                      <span 
                        key={tagName} 
                        style={{ 
                          backgroundColor: `${tagColor}22`, 
                          color: tagColor, 
                          borderColor: tagColor,
                          border: '1px solid',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          fontWeight: 600
                        }}
                      >
                        {tagName}
                      </span>
                    );
                  })
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>无标签</span>
                )}
                
                {/* Popover toggle */}
                <button
                  type="button"
                  className="secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '11px', height: '22px', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingTags(!isEditingTags);
                  }}
                >
                  🏷️ 编辑标签
                </button>

                {/* Popover overlay for checking tags */}
                {isEditingTags && (
                  <div 
                    className="tags-popover"
                    style={{
                      position: 'absolute',
                      bottom: '36px',
                      left: '0px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      zIndex: 1000,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      minWidth: '160px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--text-primary)' }}>选择标签</h4>
                    {tagConfigs.length === 0 ? (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>暂无可用标签，请到设置页面创建。</p>
                    ) : (
                      tagConfigs.map(t => {
                        const photoTags = currentLightboxPhoto.tags ? currentLightboxPhoto.tags.split(',') : [];
                        const isChecked = photoTags.includes(t.name);
                        return (
                          <label 
                            key={t.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              fontSize: '12px', 
                              cursor: 'pointer',
                              color: t.color,
                              userSelect: 'none'
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePhotoTag(currentLightboxPhoto, t.name)}
                              style={{ cursor: 'pointer' }}
                            />
                            {t.name}
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Keyboard Shortcuts Hint in Lightbox */}
            <div 
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: '8px 20px',
                borderRadius: '24px',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.7)',
                zIndex: 50,
                pointerEvents: 'none'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '4px', padding: '2px 6px', fontFamily: 'monospace', color: '#fff' }}>1</kbd>-<kbd style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '4px', padding: '2px 6px', fontFamily: 'monospace', color: '#fff' }}>5</kbd> 打星</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '4px', padding: '2px 6px', fontFamily: 'monospace', color: '#fff' }}>0</kbd> 清除</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><kbd style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '4px', padding: '2px 6px', fontFamily: 'monospace', color: '#fff' }}>Del</kbd> 极速删除</span>
            </div>
          </div>

          <button 
            className="lightbox-nav right" 
            disabled={lightboxIndex === photos.length - 1}
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
          >
            <ChevronRight size={36} />
          </button>
        </div>
      )}
    </div>
  );
};

// Sub-component AddPhotosModal for selecting photos
interface AddPhotosModalProps {
  existingPhotoIds: Set<string>;
  onClose: () => void;
  onSave: (selectedIds: string[]) => void;
  enableFilmMode: boolean;
}

const AddPhotosModal: React.FC<AddPhotosModalProps> = ({ 
  existingPhotoIds, onClose, onSave, enableFilmMode 
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filtering states
  const [filterCameraId, setFilterCameraId] = useState<string>('all');
  const [filterRollId, setFilterRollId] = useState<string>('all');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');

  // Queries
  const cameras = useCameras();
  const filmStocks = useFilmStocks();
  const tagConfigs = useTagConfigs();
  const allRolls = useRolls();
  const allPhotoAssets = usePhotoAssets();

  const archivedRolls = React.useMemo(() => allRolls.filter(r => r.status === 'archived'), [allRolls]);
  const archivedRollIds = archivedRolls.map(r => r.id!);

  const allPhotos = React.useMemo(() => {
    return allPhotoAssets.filter(p => archivedRollIds.includes(p.rollId));
  }, [allPhotoAssets, archivedRollIds]);

  // Filter photos excluding already added ones
  const eligiblePhotos = allPhotos.filter(photo => !existingPhotoIds.has(photo.id!));

  const filteredPhotos = eligiblePhotos.filter(photo => {
    const roll = archivedRolls.find(r => r.id === photo.rollId);
    
    const matchesCamera = filterCameraId === 'all' || (roll && (roll.cameraIds || []).includes(filterCameraId));
    const matchesRoll = filterRollId === 'all' || photo.rollId === filterRollId;
    const matchesRating = filterRating === 'all' || (photo.rating && photo.rating >= Number(filterRating));
    const matchesTag = filterTag === 'all' || (photo.tags && photo.tags.split(',').includes(filterTag));

    return matchesCamera && matchesRoll && matchesRating && matchesTag;
  });

  const photoUrls = usePhotoUrlMap(filteredPhotos);

  const handleToggleSelect = (photoId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(photoId)) {
      newSet.delete(photoId);
    } else {
      newSet.add(photoId);
    }
    setSelectedIds(newSet);
  };



  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', width: '90%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>从拍摄卷中勾选添加照片</h3>
          <button className="modal-close" onClick={onClose} style={{ position: 'static', padding: '4px' }}>
            <X size={18} />
          </button>
        </header>

        {/* Filters bar */}
        <div className="selector-filters">
          <select 
            className="filter-select"
            value={filterCameraId}
            onChange={e => {
              setFilterCameraId(e.target.value);
              setFilterRollId('all'); // reset roll filter
            }}
          >
            <option value="all">📷 所有相机</option>
            {cameras.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select 
            className="filter-select"
            value={filterRollId}
            onChange={e => setFilterRollId(e.target.value)}
          >
            <option value="all">🎞️ 所有拍摄卷</option>
            {archivedRolls
              .filter(r => filterCameraId === 'all' || (r.cameraIds || []).includes(filterCameraId))
              .map(r => {
                const film = filmStocks.find(f => f.id === r.filmStockId);
                const filmSuffix = enableFilmMode && film && film.isSystem === 0 ? ` (${film.brand} ${film.name})` : '';
                return (
                  <option key={r.id} value={r.id}>{r.name}{filmSuffix}</option>
                );
              })}
          </select>

          <select 
            className="filter-select"
            value={filterRating}
            onChange={e => setFilterRating(e.target.value)}
          >
            <option value="all">⭐ 所有评分</option>
            <option value="5">⭐⭐⭐⭐⭐</option>
            <option value="4">⭐⭐⭐⭐及以上</option>
            <option value="3">⭐⭐⭐及以上</option>
          </select>

          <select 
            className="filter-select"
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
          >
            <option value="all">🏷️ 所有标签</option>
            {tagConfigs.map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Photos grid */}
        <div className="selector-photos-grid">
          {filteredPhotos.length === 0 ? (
            <div className="selector-empty">
              <ImageIcon size={32} />
              <p style={{ marginTop: '8px', fontSize: '13px' }}>没有可选的照片，请调整筛选条件。</p>
            </div>
          ) : (
            filteredPhotos.map(photo => {
              const isSelected = selectedIds.has(photo.id!);
              return (
                <div 
                  key={photo.id}
                  className={`selector-photo-tile ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleToggleSelect(photo.id!)}
                >
                  <img src={photoUrls[photo.id!]} alt={photo.originalFileName} />
                  <div className="selector-photo-checkbox">
                    {isSelected ? '✓' : ''}
                  </div>
                  {/* Tag overlay inside selection dialog */}
                  {photo.tags && (
                    <div style={{ position: 'absolute', top: 4, left: 4, display: 'flex', gap: '2px', flexWrap: 'wrap', maxWidth: '85%', zIndex: 10 }}>
                      {photo.tags.split(',').map((tagName: string) => {
                        const tagConf = tagConfigs.find(tc => tc.name === tagName);
                        const tagColor = tagConf ? tagConf.color : 'var(--text-secondary)';
                        // Shorten tag name for mini display
                        const shortName = tagName.split(' ')[0];
                        return (
                          <span
                            key={tagName}
                            style={{
                              backgroundColor: tagColor,
                              color: '#fff',
                              fontSize: '7px',
                              padding: '1px 3px',
                              borderRadius: '2px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                            }}
                          >
                            {shortName}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: '9px', background: 'rgba(0,0,0,0.6)', padding: '2px 4px', borderRadius: '2px', color: 'var(--text-secondary)', maxWidth: '90%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {archivedRolls.find(r => r.id === photo.rollId)?.name}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <span style={{ marginRight: 'auto', alignSelf: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
            已选中 {selectedIds.size} 张照片
          </span>
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button 
            type="button" 
            className="primary" 
            onClick={() => onSave(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
          >
            添加至相册
          </button>
        </footer>
      </div>
    </div>
  );
};
