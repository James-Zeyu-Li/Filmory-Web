import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PhotoAsset } from '../../db/schema';
import { parsePhotoExif } from '../../services/exifService';
import { Plus, Trash2, Upload, Star, CheckCircle, FolderOpen } from 'lucide-react';
import './RollsView.css';

interface RollsViewProps {
  enableFilmMode: boolean;
}

export const RollsView: React.FC<RollsViewProps> = ({ enableFilmMode }) => {
  const [isNewRollModalOpen, setIsNewRollModalOpen] = useState(false);
  const [selectedRollId, setSelectedRollId] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Form State
  const [rollTitle, setRollTitle] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState<number | ''>('');
  const [selectedFilmId, setSelectedFilmId] = useState<number | ''>('');
  const [rollLocation, setRollLocation] = useState('');
  const [rollNotes, setRollNotes] = useState('');
  const [developNotes, setDevelopNotes] = useState('');

  // Live queries
  const cameras = useLiveQuery(() => db.cameras.toArray()) || [];
  const filmStocks = useLiveQuery(() => db.filmStocks.toArray()) || [];
  const rolls = useLiveQuery(() => db.rolls.toArray()) || [];
  const photos = useLiveQuery<PhotoAsset[]>(() => selectedRollId ? db.photoAssets.where('rollId').equals(selectedRollId).toArray() : Promise.resolve([] as PhotoAsset[])) || [];

  // Filter out system film stock from select menu
  const visibleFilmStocks = filmStocks.filter(f => f.isSystem === 0);

  // Helper: Find Camera name
  const getCameraName = (id?: number) => {
    return cameras.find(c => c.id === id)?.name || '未知相机';
  };

  // Helper: Find Film name
  const getFilmName = (id?: number) => {
    const film = filmStocks.find(f => f.id === id);
    if (!film) return '';
    return film.isSystem === 1 ? 'Digital数码' : `${film.brand} ${film.name}`;
  };

  // Helpers to get cover image URL
  const [photoUrls, setPhotoUrls] = useState<{ [key: number]: string }>({});

  React.useEffect(() => {
    // Revoke old URLs to prevent memory leaks
    Object.values(photoUrls).forEach(url => URL.revokeObjectURL(url));
    
    // Create new URLs
    const newUrls: { [key: number]: string } = {};
    photos.forEach(photo => {
      newUrls[photo.id!] = URL.createObjectURL(photo.blob);
    });
    setPhotoUrls(newUrls);

    return () => {
      Object.values(newUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const activeRolls = rolls.filter(r => r.status === 'active');
  const archivedRolls = rolls.filter(r => r.status === 'archived');
  const selectedRoll = rolls.find(r => r.id === selectedRollId);

  const handleCreateRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollTitle || !selectedCameraId) return;

    let finalFilmId = Number(selectedFilmId);
    if (!enableFilmMode || !selectedFilmId) {
      // Auto-fallback to Digital system stock
      const digitalStock = filmStocks.find(f => f.isSystem === 1 && f.systemKey === 'digital');
      finalFilmId = digitalStock?.id || 0;
    }

    await db.rolls.add({
      name: rollTitle,
      cameraId: Number(selectedCameraId),
      filmStockId: finalFilmId,
      status: 'active',
      startDate: Date.now()
    });

    setRollTitle('');
    setSelectedCameraId('');
    setSelectedFilmId('');
    setIsNewRollModalOpen(false);
  };

  const handleArchiveRoll = async (id: number) => {
    if (confirm('确认归档这一卷吗？归档后可以在照片库浏览照片。')) {
      await db.rolls.update(id, {
        status: 'archived',
        endDate: Date.now()
      });
    }
  };

  const handleDeleteRoll = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确认删除这卷拍摄吗？所有照片都将被永久移除！')) {
      // Delete associated photos
      const assets = await db.photoAssets.where('rollId').equals(id).toArray();
      for (const asset of assets) {
        await db.photoAssets.delete(asset.id!);
      }
      await db.rolls.delete(id);
      if (selectedRollId === id) setSelectedRollId(null);
    }
  };

  // Drag and drop photo upload
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!selectedRollId) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    await processFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRollId || !e.target.files) return;
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    await processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    if (!selectedRollId) return;
    let coverId = selectedRoll?.coverPhotoId;

    for (let file of files) {
      // 1. Read EXIF
      const exif = await parsePhotoExif(file);
      
      // 2. Add to IndexedDB
      const photoId = await db.photoAssets.add({
        rollId: selectedRollId,
        originalFileName: file.name,
        fileSize: file.size,
        blob: file,
        addedAt: exif.dateTime || Date.now(),
        focalLength: exif.focalLength,
        aperture: exif.aperture,
        shutterSpeed: exif.shutterSpeed,
        isPinned: 0
      });

      // 3. Set first photo as cover if not set
      if (!coverId) {
        coverId = photoId;
        await db.rolls.update(selectedRollId, { coverPhotoId: coverId });
      }
    }
  };

  const handleDeletePhoto = async (id: number) => {
    if (confirm('确认删除这张照片吗？')) {
      await db.photoAssets.delete(id);
      // If deleted cover photo, reset cover
      if (selectedRoll?.coverPhotoId === id) {
        const remaining = await db.photoAssets.where('rollId').equals(selectedRollId!).toArray();
        const nextCover = remaining.find(p => p.id !== id)?.id || null;
        await db.rolls.update(selectedRollId!, { coverPhotoId: nextCover as any });
      }
    }
  };

  const handleSetCover = async (photoId: number) => {
    if (selectedRollId) {
      await db.rolls.update(selectedRollId, { coverPhotoId: photoId });
    }
  };

  const handleSetRating = async (rating: number) => {
    if (selectedRollId) {
      await db.rolls.update(selectedRollId, { rating });
    }
  };

  const handleSaveDetails = async () => {
    if (selectedRollId) {
      await db.rolls.update(selectedRollId, {
        location: rollLocation,
        notes: rollNotes,
        developNotes: developNotes
      });
      alert('保存成功！');
    }
  };

  // Pre-fill fields on roll click
  const handleSelectRoll = (id: number) => {
    setSelectedRollId(id);
    const r = rolls.find(roll => roll.id === id);
    if (r) {
      setRollLocation(r.location || '');
      setRollNotes(r.notes || '');
      setDevelopNotes(r.developNotes || '');
    }
  };

  return (
    <div className="main-content">
      <header className="view-header">
        <h1>拍摄卷 (Rolls)</h1>
        <div className="view-header-actions">
          <button className="primary" onClick={() => setIsNewRollModalOpen(true)}>
            <Plus size={16} /> 开始拍摄 (New Roll)
          </button>
        </div>
      </header>

      <div className="rolls-split-layout">
        {/* Left Side: Rolls List */}
        <div className="rolls-sidebar">
          <h3>进行中 ({activeRolls.length})</h3>
          <div className="rolls-list">
            {activeRolls.length === 0 ? (
              <p className="no-items">暂无进行中的拍摄</p>
            ) : (
              activeRolls.map(roll => (
                <div 
                  key={roll.id} 
                  className={`roll-item active-roll ${selectedRollId === roll.id ? 'selected' : ''}`}
                  onClick={() => handleSelectRoll(roll.id!)}
                >
                  <div className="roll-info">
                    <h4>{roll.name}</h4>
                    <span>📷 {getCameraName(roll.cameraId)}</span>
                    {enableFilmMode && <span>🎞️ {getFilmName(roll.filmStockId)}</span>}
                  </div>
                  <button className="success-btn" onClick={() => handleArchiveRoll(roll.id!)}>
                    归档
                  </button>
                </div>
              ))
            )}
          </div>

          <h3 style={{ marginTop: '24px' }}>已归档 ({archivedRolls.length})</h3>
          <div className="rolls-list">
            {archivedRolls.length === 0 ? (
              <p className="no-items">暂无已归档的拍摄</p>
            ) : (
              archivedRolls.map(roll => (
                <div 
                  key={roll.id} 
                  className={`roll-item archived-roll ${selectedRollId === roll.id ? 'selected' : ''}`}
                  onClick={() => handleSelectRoll(roll.id!)}
                >
                  <div className="roll-info">
                    <h4>{roll.name}</h4>
                    <span>{getCameraName(roll.cameraId)} {enableFilmMode && `· ${getFilmName(roll.filmStockId)}`}</span>
                  </div>
                  <button className="danger icon-btn" onClick={(e) => handleDeleteRoll(roll.id!, e)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Roll Detail & Workspace */}
        <div className="rolls-workspace">
          {selectedRoll ? (
            <div className="workspace-card">
              <div className="workspace-header">
                <h2>{selectedRoll.name}</h2>
                <span className={`tag ${selectedRoll.status}`}>
                  {selectedRoll.status === 'active' ? '进行中' : '已归档'}
                </span>
              </div>

              <div className="roll-metadata-form">
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>拍摄位置</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="地点名称"
                      value={rollLocation}
                      onChange={e => setRollLocation(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>评分</label>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          size={18} 
                          fill={(selectedRoll.rating || 0) >= star ? 'var(--accent)' : 'none'}
                          color={(selectedRoll.rating || 0) >= star ? 'var(--accent)' : 'var(--text-muted)'}
                          onClick={() => handleSetRating(star)}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>冲洗备注 / 想法</label>
                  <textarea 
                    className="form-control" 
                    rows={2} 
                    placeholder="在此记录药水时间、显影、迫冲或镜头心得..."
                    value={rollNotes}
                    onChange={e => setRollNotes(e.target.value)}
                  />
                </div>
                
                <div className="form-group" style={{ marginTop: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent, #38bdf8)' }}>
                    📝 冲洗备忘 Notepad
                  </label>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                    placeholder="例如:&#10;显影剂: D-76 (1:1)&#10;显影时间: 9分30秒&#10;显影温度: 20°C&#10;定影/急冷: 5分钟 / 1分钟"
                    value={developNotes}
                    onChange={e => setDevelopNotes(e.target.value)}
                  />
                </div>

                <button style={{ alignSelf: 'flex-start' }} onClick={handleSaveDetails}>
                  保存详情
                </button>
              </div>

              {selectedRoll.status === 'archived' && (
                <div className="photo-upload-section">
                  <h3>照片管理 ({photos.length})</h3>
                  
                  {/* Dropzone */}
                  <div 
                    className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <Upload size={32} />
                    <p>拖拽胶卷扫描件或原图到此处，或</p>
                    <label className="file-upload-label">
                      <span>浏览本地文件</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handleFileSelect} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                    <span className="file-upload-note">支持批量导入，客户端自动提取 EXIF 参数</span>
                  </div>

                  {/* Staged photos list */}
                  <div className="photos-grid">
                    {photos.map(photo => (
                      <div key={photo.id} className="photo-tile">
                        <img src={photoUrls[photo.id!]} alt={photo.originalFileName} />
                        <div className="photo-tile-actions">
                          <button 
                            className={`tile-btn ${selectedRoll.coverPhotoId === photo.id ? 'active' : ''}`}
                            title="设为封面"
                            onClick={() => handleSetCover(photo.id!)}
                          >
                            <CheckCircle size={12} />
                          </button>
                          <button 
                            className="tile-btn danger-hover" 
                            title="删除"
                            onClick={() => handleDeletePhoto(photo.id!)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="photo-tile-meta">
                          {photo.focalLength && `${photo.focalLength}mm `}
                          {photo.aperture && `${photo.aperture} `}
                          {photo.shutterSpeed && `${photo.shutterSpeed}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="workspace-empty">
              <FolderOpen size={64} />
              <h3>请在左侧选择一卷拍摄</h3>
              <p>选择卷以添加照片、编辑位置备注、或进行归档管理。</p>
            </div>
          )}
        </div>
      </div>

      {/* --- NEW ROLL MODAL --- */}
      {isNewRollModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>新建拍摄卷 (New Roll)</h3>
            <form onSubmit={handleCreateRoll}>
              <div className="form-group">
                <label>拍摄主题/名称</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="例如: 2026春日踏青 / 城市漫步" 
                  value={rollTitle}
                  onChange={e => setRollTitle(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label>选择相机</label>
                <select 
                  className="form-control"
                  value={selectedCameraId}
                  onChange={e => setSelectedCameraId(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                >
                  <option value="">-- 请选择相机 --</option>
                  {cameras.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type === 'film' ? '胶片' : '数码'})</option>
                  ))}
                </select>
              </div>

              {enableFilmMode && (
                <div className="form-group">
                  <label>选择胶卷型号 (仅胶片模式)</label>
                  <select 
                    className="form-control"
                    value={selectedFilmId}
                    onChange={e => setSelectedFilmId(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  >
                    <option value="">-- 请选择胶卷型号 --</option>
                    {visibleFilmStocks.map(f => (
                      <option key={f.id} value={f.id}>{f.brand} {f.name} (ISO {f.iso})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setIsNewRollModalOpen(false)}>取消</button>
                <button type="submit" className="primary">开始记录</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
