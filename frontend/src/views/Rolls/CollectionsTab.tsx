import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, type Collection } from '../../db/schema';
import { useCollections, useRolls, usePhotoAssets, useCameras, useFilmStocks } from '../../hooks/useData';
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useTrialGate } from '../../contexts/useTrialGate';
import { Edit3, Trash2, X, Calendar, Camera, Film, Folder } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { motion } from 'framer-motion';
import { IconButton } from '../../components/ui/IconButton';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { usePhotoUrlMap } from '../../hooks/usePhotoUrlMap';
import { useLanguage } from '../../contexts/useLanguage';
import { requestImmediateSync } from '../../services/syncEvents';

interface CollectionsTabProps {
  onCollectionSelect: (collectionId: string) => void;
  onCreateRoll: () => void;
  viewMode?: 'grid' | 'list';
}

export const CollectionsTab: React.FC<CollectionsTabProps> = ({ onCollectionSelect, onCreateRoll, viewMode = 'list' }) => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { guardTrialResource } = useTrialGate();
  const { t } = useLanguage();
  const collections = useCollections();
  const allRolls = useRolls();
  const allPhotos = usePhotoAssets();
  const photoUrlMap = usePhotoUrlMap(allPhotos);
  const cameras = useCameras();
  const filmStocks = useFilmStocks();

  // Get cover url for a single roll
  const getRollCoverUrl = useCallback((roll: { coverPhotoId?: string }) => {
    if (!roll.coverPhotoId) return undefined;
    const p = allPhotos.find(ph => ph.id === roll.coverPhotoId);
    if (!p) return undefined;
    return p.id ? photoUrlMap[p.id] : undefined;
  }, [allPhotos, photoUrlMap]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  
  const handleOpenModal = (collection?: Collection) => {
    if (collection) {
      setEditingCollection(collection);
      setName(collection.name);
      setDescription(collection.description || '');
      setDate(new Date(collection.date).toISOString().split('T')[0]);
    } else {
      setEditingCollection(null);
      setName('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    }
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handleOpen = () => handleOpenModal();
    document.addEventListener('open-new-collection-modal', handleOpen);
    return () => document.removeEventListener('open-new-collection-modal', handleOpen);
  }, []);
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    if (editingCollection && editingCollection.id) {
      await db.collections.update(editingCollection.id, {
        name: name.trim(),
        description: description.trim(),
        date: new Date(date).getTime()
      });
    } else {
      if (!guardTrialResource({ resource: 'collections', currentCount: collections.length })) {
        setIsModalOpen(false);
        return;
      }
      await db.collections.add({
        id: crypto.randomUUID(),
        userId: user?.id || 'offline',
        name: name.trim(),
        description: description.trim(),
        date: new Date(date).getTime(),
        addedAt: Date.now()
      });
    }
    requestImmediateSync('collection-save');
    setIsModalOpen(false);
  };
  
  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: t('collections.deleteTitle'),
      message: t('collections.deleteMessage'),
      confirmText: t('collections.confirmDelete'),
      isDanger: true
    });
    if (confirmed) {
      await db.collections.delete(id);
      
      // Detach rolls
      const linkedRolls = (await db.rolls.where('collectionId').equals(id).toArray())
        .filter(roll => roll.userId === (user?.id || 'offline'));
      for (const roll of linkedRolls) {
        if (roll.id) {
          await db.rolls.update(roll.id, { collectionId: undefined });
        }
      }
      requestImmediateSync('collection-delete');
    }
  }, [confirm, t, user]);

  const filteredCollections = collections;

  const collectionCards = useMemo(() => {
    return filteredCollections.map(collection => {
      const linkedRolls = allRolls.filter(r => r.collectionId === collection.id);

      const uniqueCameraIds = Array.from(new Set(linkedRolls.flatMap(r => r.cameraIds || [])));
      const cameraNames = uniqueCameraIds.map(id => cameras.find(c => c.id === id)?.name || t('common.unknownCamera'));
      
      const uniqueFilmIds = Array.from(new Set(linkedRolls.map(r => r.filmStockId).filter(id => id && id !== 'digital-placeholder')));
      const filmNames = uniqueFilmIds.map(id => {
        const f = filmStocks.find(fs => fs.id === id);
        return f ? `${f.brand} ${f.name}` : t('common.unknownFilm');
      });
      
      // Build mosaic: collect up to 4 cover URLs from linked rolls
      const mosaicUrls: string[] = [];
      for (const roll of linkedRolls) {
        const url = getRollCoverUrl(roll);
        if (url) mosaicUrls.push(url);
        if (mosaicUrls.length >= 4) break;
      }

      if (viewMode === 'grid') {
        return (
          <div 
            key={collection.id} 
            className="roll-card collection-card"
            onClick={() => onCollectionSelect(collection.id!)}
          >
            <button type="button" className="record-card-open-action" onClick={(event) => { event.stopPropagation(); onCollectionSelect(collection.id!); }} aria-label={`${collection.name} (${t('collections.rollCount', { count: linkedRolls.length })})`} />
            <div className="roll-card-cover">
              {collection.coverUrl ? (
                <div style={{ backgroundImage: `url(${collection.coverUrl})`, width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center' }} />
              ) : mosaicUrls.length > 0 ? (
                <div className="collection-mosaic">
                  {mosaicUrls.map((url, i) => (
                    <div key={i} className="collection-mosaic-cell" style={{ backgroundImage: `url(${url})` }} />
                  ))}
                </div>
              ) : (
                <div className="collection-card-name-thumb">
                  <span>{collection.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              
              <div className="roll-card-status">
                <span className="status-badge active">{t('collections.rollCount', { count: linkedRolls.length })}</span>
              </div>
            </div>

            <div className="roll-card-content">
              <h3 style={{ margin: 0, marginBottom: '8px' }}>{collection.name}</h3>
              
              <p className="roll-card-meta">
                 <Calendar size={12} style={{ flexShrink: 0 }}/> {new Date(collection.date).toLocaleDateString()}
              </p>
              
              {cameraNames.length > 0 && (
                 <p className="roll-card-meta">
                    <Camera size={12} style={{ flexShrink: 0 }}/> {cameraNames.join(', ')}
                 </p>
              )}
              {filmNames.length > 0 && (
                 <p className="roll-card-meta">
                    <Film size={12} style={{ flexShrink: 0 }}/> {filmNames.join(', ')}
                 </p>
              )}
              
              <div className="roll-card-actions">
                <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleOpenModal(collection); }} title={t('collections.editTitle')}>
                  <Edit3 size={14} /> <span>{t('collections.edit')}</span>
                </button>
                <button className="action-btn danger" onClick={(e) => handleDelete(collection.id!, e)} title={t('collections.deleteTitle')}>
                  <Trash2 size={14} /> <span>{t('collections.delete')}</span>
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Default List Mode (Horizontal Scroller)
      return (
        <div 
          key={collection.id} 
          className="collection-card-row"
          onClick={() => onCollectionSelect(collection.id!)}
        >
          <button type="button" className="record-card-open-action" onClick={(event) => { event.stopPropagation(); onCollectionSelect(collection.id!); }} aria-label={`${collection.name} (${t('collections.rollCount', { count: linkedRolls.length })})`} />
          {/* Square thumbnail: mosaic if photos exist, name initials if not */}
          <div className="collection-card-thumb-wrapper">
            {collection.coverUrl ? (
              <div className="collection-card-thumb" style={{ backgroundImage: `url(${collection.coverUrl})` }} />
            ) : mosaicUrls.length > 0 ? (
              <div className="collection-mosaic">
                {mosaicUrls.map((url, i) => (
                  <div key={i} className="collection-mosaic-cell" style={{ backgroundImage: `url(${url})` }} />
                ))}
              </div>
            ) : (
              <div className="collection-card-name-thumb">
                <span>{collection.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="collection-card-info">
            <p className="collection-card-title">{collection.name}</p>

            <p className="collection-card-meta">
              <Calendar size={12} style={{ flexShrink: 0 }} />
              {new Date(collection.date).toLocaleDateString()}
            </p>

            {cameraNames.length > 0 && (
              <p className="collection-card-meta">
                <Camera size={12} style={{ flexShrink: 0 }} />
                {cameraNames.join(', ')}
              </p>
            )}
            {filmNames.length > 0 && (
              <p className="roll-card-meta">
                <Film size={12} style={{ flexShrink: 0 }} />
                {filmNames.join(', ')}
              </p>
            )}

            <span className="collection-card-rolls-tag">
              <Film size={10} /> {t('collections.rollCount', { count: linkedRolls.length })}
            </span>
          </div>

          {/* Actions */}
          <div className="collection-card-actions roll-card-row-actions" onClick={e => e.stopPropagation()}>
            <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleOpenModal(collection); }} title={t('collections.editTitle')}>
              <Edit3 size={14} /> <span>{t('collections.edit')}</span>
            </button>
            <button className="action-btn danger" onClick={(e) => handleDelete(collection.id!, e)} title={t('collections.deleteTitle')}>
              <Trash2 size={14} /> <span>{t('collections.delete')}</span>
            </button>
          </div>
        </div>
      );
    });
  }, [filteredCollections, allRolls, cameras, filmStocks, viewMode, onCollectionSelect, getRollCoverUrl, handleDelete, t]);

  return (
    <div className="collections-tab-container">

      
        {collections.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
            <EmptyState 
              icon={Folder}
              title={t('collections.emptyTitle')}
              description={t('collections.emptyDesc')}
              action={
                <>
                  <Button variant="primary" onClick={() => handleOpenModal()}>
                    {t('collections.new')}
                  </Button>
                  <Button variant="secondary" onClick={onCreateRoll}>
                    {t('rolls.newRoll')}
                  </Button>
                </>
              }
            />
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="rolls-grid">
            {collectionCards}
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="rolls-list">
            {collectionCards}
          </motion.div>
        )}
      

      {/* Collection Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <div className="modal-header">
              <h3>{editingCollection ? t('collections.editTitle') : t('collections.new')}</h3>
              <IconButton type="button" onClick={() => setIsModalOpen(false)} icon={<X size={20} />} />
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body form-group">
                <label>{t('collections.collectionName')} <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder={t('collections.collectionNamePlaceholder')}
                  required 
                  autoFocus
                />
                
                <label>{t('collections.date')} <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  required 
                />
                
                <label>{t('collections.description')}</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder={t('collections.descriptionPlaceholder')}
                  rows={3}
                />
              </div>
              
              <div className="form-actions">
                <Button type="button" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
                <Button variant="primary" type="submit">{t('collections.save')}</Button>
              </div>
            </form>
      </Modal>
    </div>
  );
};
