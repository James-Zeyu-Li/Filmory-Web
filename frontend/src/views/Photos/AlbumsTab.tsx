import React, { useState, useMemo } from 'react';
import { db } from '../../db/schema';
import { FolderHeart, Plus, Calendar, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useAlbums, useAlbumPhotos, usePhotoAssets } from '../../hooks/useData';
import { usePhotoUrlMap } from '../../hooks/usePhotoUrlMap';
import { EmptyState } from '../../components/EmptyState';

interface AlbumsTabProps {
  onSelectAlbum: (id: string) => void;
}

export const AlbumsTab: React.FC<AlbumsTabProps> = ({ onSelectAlbum }) => {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');

  // Live query albums
  const albums = useAlbums();
  
  const albumPhotosRelation = useAlbumPhotos();
  const photoAssets = usePhotoAssets();

  const { albumPhotoCounts, albumCoverPhotoIds } = useMemo(() => {
    const counts: { [key: string]: number } = {};
    const coverIds: { [key: string]: string } = {};

    albums.forEach(album => {
      const albumId = album.id!;
      // Calculate photo count
      const count = albumPhotosRelation.filter(ap => ap.albumId === albumId).length;
      counts[albumId] = count;

      // Find cover image URL
      if (album.coverPhotoId) {
        const photo = photoAssets.find(p => p.id === album.coverPhotoId);
        if (photo) {
          coverIds[albumId] = photo.id!;
        }
      }
      // If no coverPhotoId but photos exist in album, use the first photo as dynamic cover fallback
      if (!coverIds[albumId]) {
        const firstRelation = albumPhotosRelation.find(ap => ap.albumId === albumId);
        if (firstRelation) {
          const photo = photoAssets.find(p => p.id === firstRelation.photoId);
          if (photo) {
            coverIds[albumId] = photo.id!;
          }
        }
      }
    });

    return { albumPhotoCounts: counts, albumCoverPhotoIds: coverIds };
  }, [albums, albumPhotosRelation, photoAssets]);

  const albumCoverPhotos = useMemo(() => {
    const ids = new Set(Object.values(albumCoverPhotoIds));
    return photoAssets.filter(photo => photo.id && ids.has(photo.id));
  }, [albumCoverPhotoIds, photoAssets]);
  const coverUrlMap = usePhotoUrlMap(albumCoverPhotos);
  const albumCoverUrls = useMemo(() => {
    return Object.fromEntries(
      Object.entries(albumCoverPhotoIds)
        .map(([albumId, photoId]) => [albumId, coverUrlMap[photoId]])
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
    );
  }, [albumCoverPhotoIds, coverUrlMap]);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;

    await db.albums.add({
      id: crypto.randomUUID(),
      userId: user?.id || 'offline',
      name: newAlbumName.trim(),
      description: newAlbumDesc.trim() || undefined,
      addedAt: Date.now()
    });

    // Reset and close
    setNewAlbumName('');
    setNewAlbumDesc('');
    setShowCreateModal(false);
  };

  return (
    <div className="view-body">
      <div className="tab-actions-row" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button className="primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          <span>新建相册</span>
        </button>
      </div>

      {albums.length === 0 ? (
        <EmptyState
          icon={FolderHeart}
          title="你还没有创建任何相册"
          description="相册是独立于胶卷的照片合集，你可以把不同胶卷里的照片整理到同一个相册中。"
          action={<button className="primary" onClick={() => setShowCreateModal(true)}>立即创建第一个相册</button>}
        />
      ) : (
        <div className="albums-grid">
          {albums.map(album => {
            const count = albumPhotoCounts[album.id!] || 0;
            const coverUrl = albumCoverUrls[album.id!];

            return (
              <div 
                key={album.id} 
                className="album-card"
                onClick={() => onSelectAlbum(album.id!)}
              >
                <div className="album-cover">
                  {coverUrl ? (
                    <img src={coverUrl} alt={album.name} />
                  ) : (
                    <div className="album-cover-placeholder">
                      <span>📁</span>
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <span className="album-photo-count">{count} 张照片</span>
                </div>
                <div className="album-meta-info">
                  <h3>{album.name}</h3>
                  <p>{album.description || '暂无描述'}</p>
                  <span className="album-date">
                    <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    {new Date(album.addedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- CREATE ALBUM MODAL --- */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <header style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>创建新相册</h3>
            </header>
            <form onSubmit={handleCreateAlbum}>
              <div className="form-group">
                <label>相册名称</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="例如：2026夏日大理街拍" 
                  value={newAlbumName}
                  onChange={e => setNewAlbumName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>相册描述 (可选)</label>
                <textarea 
                  className="form-control" 
                  placeholder="记录关于相册的背景、地点、所用设备等细节..." 
                  value={newAlbumDesc}
                  onChange={e => setNewAlbumDesc(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="secondary" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button type="submit" className="primary">
                  创建相册
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
