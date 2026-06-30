import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../db/schema';
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { uploadPhotoToCloud } from '../../services/storageService';
import { Folder, Search, LayoutGrid, List, Trash2, Film, Plus, Camera, ArrowLeft, CheckCircle, X, Upload, Star, Sparkles } from 'lucide-react';
import { IconButton } from '../../components/ui/IconButton';
import { motion } from 'framer-motion';
import { compressImageToWebP } from '../../utils/imageService';
import './RollsView.css';
import { useCollections, useCameras, useFilmStocks, useRolls, usePhotoAssets } from '../../hooks/useData';
import { usePhotoUrlMap } from '../../hooks/usePhotoUrlMap';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Drawer } from '../../components/Drawer';

import { CollectionsTab } from './CollectionsTab';
import type { Roll } from '../../db/schema';

interface RollsViewProps {
  enableFilmMode: boolean;
}

export const RollsView: React.FC<RollsViewProps> = ({ enableFilmMode }) => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  
  // Live queries
  const cameras = useCameras();
  const filmStocks = useFilmStocks();
  const rolls = useRolls();
  const photos = usePhotoAssets();

  const collections = useCollections();
  const photoUrlMap = usePhotoUrlMap(photos);

  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const activeCollection = useMemo(() => collections.find(c => c.id === activeCollectionId), [collections, activeCollectionId]);
  const [libraryView, setLibraryView] = useState<'collections' | 'all' | 'loose'>('collections');

  
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    if (isSortOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortOpen]);

  const [selectedRollId, setSelectedRollId] = useState<string | null>(null);
  const selectedRoll = useMemo(() => rolls.find(r => r.id === selectedRollId) || null, [rolls, selectedRollId]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Phase 3: All Rolls State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'camera'>('date');
  
  
  // Modals
  const [isNewRollModalOpen, setIsNewRollModalOpen] = useState(false);
  const [isAddExistingModalOpen, setIsAddExistingModalOpen] = useState(false);
  const [selectedExistingRollIds, setSelectedExistingRollIds] = useState<string[]>([]);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  
  // Phase 2: View All States (Removed in favor of top-level tabs)
  const [keepModalOpen, setKeepModalOpen] = useState(false);
  const [quickAddCameraOpen, setQuickAddCameraOpen] = useState(false);
  const [quickAddFilmOpen, setQuickAddFilmOpen] = useState(false);

  // New Roll Form
  const [rollTitle, setRollTitle] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);
  const [selectedFilmId, setSelectedFilmId] = useState<string>('');
  const [filmSearchText, setFilmSearchText] = useState<string>('');
  const [isFilmDropdownOpen, setIsFilmDropdownOpen] = useState(false);
  const [rollFilmPrice, setRollFilmPrice] = useState<number | ''>('');
  const [generateFilmExpense, setGenerateFilmExpense] = useState<boolean>(true);
  
  // Quick Add Form States
  const [qaCameraName, setQaCameraName] = useState('');
  const [qaFilmBrand, setQaFilmBrand] = useState('');
  const [qaFilmName, setQaFilmName] = useState('');

  // Metadata Form (Drawer)
  const [rollLocation, setRollLocation] = useState('');
  const [rollNotes, setRollNotes] = useState('');
  const [developNotes, setDevelopNotes] = useState('');
  const [developPrice, setDevelopPrice] = useState<number | ''>('');
  const [nowTimestamp] = useState(Date.now);
  
  // Upload States
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const visibleFilmStocks = filmStocks.filter(f => f.isSystem === 0);

  const openRollDrawer = (roll: Roll) => {
    setSelectedRollId(roll.id!);
    setRollLocation(roll.location || '');
    setRollNotes(roll.notes || '');
    setDevelopNotes(roll.developNotes || '');
    setDevelopPrice(roll.developPrice || '');
    setIsDrawerOpen(true);
  };


  const handleCreateRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollTitle || selectedCameraIds.length === 0 || (enableFilmMode && !filmSearchText.trim()) || !user) return;

    let finalFilmId = selectedFilmId;
    
    // Auto-create film if it doesn't match existing
    if (enableFilmMode && filmSearchText.trim() !== '') {
        const matched = filmStocks.find(f => `${f.brand} ${f.name}`.toLowerCase() === filmSearchText.trim().toLowerCase());
        if (matched) {
            finalFilmId = matched.id!;
        } else {
            const parts = filmSearchText.trim().split(' ');
            const brand = parts[0] || 'Unknown';
            const name = parts.slice(1).join(' ') || 'Unknown Film';
            
            // Try to extract ISO
            const isoMatch = filmSearchText.match(/\d{2,4}/);
            const iso = isoMatch ? parseInt(isoMatch[0], 10) : 200;
            
            const isBw = filmSearchText.toLowerCase().includes('bw') || filmSearchText.toLowerCase().includes('黑白');
            const format = filmSearchText.includes('120') ? '120' : '135';
            
            const newFilm = {
                id: crypto.randomUUID(),
                brand,
                name,
                iso,
                colorType: isBw ? 'bw' : 'color' as 'color' | 'bw',
                format,
                isSystem: 0,
                stockCount: 0, // Since it's created on the fly for this roll, they didn't really buy stock
                addedAt: Date.now(),
                userId: user?.id || 'offline'
            };
            await db.filmStocks.add(newFilm);
            finalFilmId = newFilm.id;
        }
    }

    const newRoll: Roll = {
      id: crypto.randomUUID(),
      name: rollTitle,
      cameraIds: selectedCameraIds,
      filmStockId: enableFilmMode ? finalFilmId : 'digital-placeholder',
      collectionId: selectedCollectionId || undefined,
      status: 'active',
      startDate: Date.now(),
      filmPrice: rollFilmPrice ? Number(rollFilmPrice) : undefined,
      userId: user?.id || 'offline'
    };

    await db.transaction('rw', db.rolls, db.filmStocks, db.ledgerTransactions, async () => {
      await db.rolls.add(newRoll);

      if (enableFilmMode && finalFilmId) {
        const film = await db.filmStocks.get(finalFilmId);
        if (film) {
          const currentStock = film.stockCount || 0;
          await db.filmStocks.update(finalFilmId, { stockCount: Math.max(0, currentStock - 1) });
          
          if (generateFilmExpense) {
            const expenseCost = rollFilmPrice ? Number(rollFilmPrice) : (film.pricePerRoll || 0);
            if (expenseCost > 0) {
              await db.ledgerTransactions.add({
                id: crypto.randomUUID(),
                userId: user.id,
                amount: -expenseCost,
                date: Date.now(),
                type: 'expense',
                category: 'film',
                relatedEntityId: newRoll.id,
                notes: `消耗胶卷: ${film.brand} ${film.name}`,
                addedAt: Date.now()
              });
            }
          }
        }
      }
    });

    if (!keepModalOpen) {
      setIsNewRollModalOpen(false);
      setRollTitle('');
      setSelectedCameraIds([]);
      setSelectedFilmId('');
      setFilmSearchText('');
      setRollFilmPrice('');
      setSelectedCollectionId('');
    } else {
      setRollTitle('');
    }
  };

  const handleAddExistingRolls = async () => {
    if (!activeCollectionId || selectedExistingRollIds.length === 0) return;
    
    await db.transaction('rw', db.rolls, async () => {
      for (const id of selectedExistingRollIds) {
        if (id) {
          await db.rolls.update(id, { collectionId: activeCollectionId });
        }
      }
    });
    
    setIsAddExistingModalOpen(false);
    setSelectedExistingRollIds([]);
  };

  const handleQuickAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaCameraName.trim()) return;
    
    const existing = cameras.find(camera => camera.name === qaCameraName.trim());
    if (existing && existing.id) {
      setSelectedCameraIds(prev => prev.includes(existing.id!) ? prev : [...prev, existing.id!]);
    } else {
      const newId = crypto.randomUUID();
      await db.cameras.add({
        id: newId,
        userId: user?.id || 'offline',
        name: qaCameraName.trim(),
        type: 'film',
        format: '135',
        addedAt: Date.now()
      });
      setSelectedCameraIds(prev => [...prev, newId]);
    }
    setQaCameraName('');
    setQuickAddCameraOpen(false);
  };

  const handleQuickAddFilm = async (e: React.FormEvent) => {
    e.preventDefault();
    const brand = qaFilmBrand.trim();
    const name = qaFilmName.trim();
    if (!brand || !name) return;

    const existing = filmStocks.find(film => film.brand === brand && film.name === name);
    if (existing && existing.id) {
      setSelectedFilmId(existing.id!);
    } else {
      const newId = crypto.randomUUID();
      await db.filmStocks.add({
        id: newId,
        userId: user?.id || 'offline',
        brand,
        name,
        iso: 400,
        colorType: 'color',
        format: '135',
        stockCount: 1,
        isSystem: 0,
        addedAt: Date.now()
      });
      setSelectedFilmId(newId);
    }
    setQaFilmBrand('');
    setQaFilmName('');
    setQuickAddFilmOpen(false);
  };

  const handleArchiveRoll = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: '完成拍摄卷',
      message: '确认冲洗完毕并标记为完成这一卷吗？',
      confirmText: '确认完成'
    });
    if (confirmed) {
      await db.rolls.update(id, { status: 'archived', endDate: Date.now() });
    }
  };

  const handleDeleteRoll = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: '删除拍摄卷',
      message: '彻底删除这一卷？相关联的所有照片资产和账单记录将被永久删除。此操作无法撤销。',
      confirmText: '彻底删除',
      isDanger: true
    });
    if (confirmed) {
      await db.rolls.delete(id);
      
      if (selectedRollId === id) {
        setIsDrawerOpen(false);
        setSelectedRollId(null);
      }
    }
  };

  const handleRemoveFromCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: '移出项目集',
      message: '确定要将此拍摄卷从当前项目集中移出吗？\n该卷将返回至独立拍摄卷列表，照片不会被删除。',
      confirmText: '移出'
    });
    if (confirmed) {
      await db.rolls.update(id, { collectionId: undefined });
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedRollId) return;
    
    await db.transaction('rw', db.rolls, db.ledgerTransactions, async () => {
        await db.rolls.update(selectedRollId, {
          location: rollLocation,
          notes: rollNotes,
          developNotes: developNotes,
          developPrice: developPrice !== '' ? Number(developPrice) : undefined
        });

        const existingTx = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(selectedRollId)
          .filter(tx => tx.category === 'develop')
          .first();

        if (developPrice !== '' && Number(developPrice) > 0) {
          const amt = -Number(developPrice);
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, { amount: amt });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: user?.id || 'offline',
              amount: amt,
              date: Date.now(),
              type: 'expense',
              category: 'develop',
              relatedEntityId: selectedRollId,
              notes: `冲洗费用 (Roll: ${selectedRoll?.name || '未知'})`,
              addedAt: Date.now()
            });
          }
        } else if (existingTx && existingTx.id) {
          await db.ledgerTransactions.delete(existingTx.id);
        }
    });
    notify({
      type: 'success',
      title: '拍摄卷详情已保存'
    });
    setIsDrawerOpen(false);
  };

  const handleSetRating = async (rating: number) => {
    if (!selectedRollId) return;
    await db.rolls.update(selectedRollId, { rating });
  };
  
  const handleCoverUpload = async (file: File) => {
    if (!selectedRollId) return;
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
        const webpFile = await compressImageToWebP(file, 1920, 0.8);
        const photoId = crypto.randomUUID();
        const currentUserId = user?.id || 'offline';
        
        let uploadResult = null;
        if (user) {
          try {
            uploadResult = await uploadPhotoToCloud(webpFile, user.id, selectedRollId, (pct) => setUploadProgress(pct));
          } catch (err) {
            console.error("Cloud upload failed, falling back to local DB", err);
          }
        }
        
        await db.photoAssets.add({
          id: photoId,
          userId: currentUserId,
          rollId: selectedRollId,
          originalFileName: file.name,
          fileSize: webpFile.size,
          blob: uploadResult ? undefined : webpFile, // Fallback to local blob if no cloud upload
          storageKey: uploadResult?.storageKey,
          previewUrl: uploadResult?.previewUrl,
          thumbnailUrl: uploadResult?.thumbnailUrl,
          addedAt: Date.now(),
          isPinned: 1,
          orderIndex: 0
        });
        
        await db.rolls.update(selectedRollId, { coverPhotoId: photoId });
        
        // delete old covers for this roll
        if (selectedRoll?.coverPhotoId) {
             const oldPhotos = await db.photoAssets.where('rollId').equals(selectedRollId).toArray();
             for (const p of oldPhotos) {
                 if (p.id !== photoId && p.id) {
                     await db.photoAssets.delete(p.id);
                 }
             }
        }
    } catch(e) {
        console.error(e);
    }
    
    setIsUploading(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!selectedRollId) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) await handleCoverUpload(files[0]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRollId || !e.target.files) return;
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) await handleCoverUpload(files[0]);
  };

  const getCameraName = (id: string) => cameras.find(c => c.id === id)?.name || '未知相机';
  const getFilmName = (id: string) => {
    const f = filmStocks.find(fs => fs.id === id);
    return f ? `${f.brand} ${f.name}` : '未知胶卷';
  };

  const processedRolls = useMemo(() => {
    let result = libraryView === 'loose'
      ? rolls.filter(r => !r.collectionId)
      : rolls;
    
    if (libraryView !== 'loose' && libraryView !== 'all') {
      return []; // collections view doesn't use this
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const nameMatch = r.name.toLowerCase().includes(q);
        const locationMatch = r.location?.toLowerCase().includes(q);
        const notesMatch = r.notes?.toLowerCase().includes(q);
        
        let cameraMatch = false;
        if (r.cameraIds) {
          cameraMatch = r.cameraIds.some((id: string) => {
            const cam = cameras.find(c => c.id === id);
            return cam && (cam.name.toLowerCase().includes(q) || cam.brand.toLowerCase().includes(q));
          });
        }
        
        let filmMatch = false;
        if (r.filmStockId) {
          const f = filmStocks.find(fs => fs.id === r.filmStockId);
          if (f) filmMatch = f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q);
        }
        
        return nameMatch || locationMatch || notesMatch || cameraMatch || filmMatch;
      });
    }

    

    result = [...result].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'camera') {
        const aCam = a.cameraIds?.[0] ? cameras.find(c => c.id === a.cameraIds![0])?.name || '' : '';
        const bCam = b.cameraIds?.[0] ? cameras.find(c => c.id === b.cameraIds![0])?.name || '' : '';
        return aCam.localeCompare(bCam);
      } else {
        return b.startDate - a.startDate;
      }
    });
    
    return result;
  }, [rolls, libraryView, searchQuery, sortBy, cameras, filmStocks]);
  
  // Find cover photo url for a roll
  const getCoverUrl = (roll: Roll) => {
      if (!roll.coverPhotoId) return undefined;
      const p = photos.find(ph => ph.id === roll.coverPhotoId);
      if (!p) return undefined;
      return p.id ? photoUrlMap[p.id] : undefined;
  };



  const renderRollCard = (roll: Roll) => {
    const coverUrl = getCoverUrl(roll);
    const collectionName = roll.collectionId ? collections.find(c => c.id === roll.collectionId)?.name : null;
    
    if (viewLayout === 'list') {
      return (
        <div 
          key={roll.id} 
          className="roll-card-row"
          onClick={() => openRollDrawer(roll)}
        >
          <div className="roll-card-row-thumb-wrapper">
            {coverUrl ? (
              <div className="roll-card-row-thumb" style={{ backgroundImage: `url(${coverUrl})` }} />
            ) : (
              <div className="roll-card-placeholder"><Film size={28} /></div>
            )}
            
            <div className="roll-card-status" style={{ top: 4, left: 4 }}>
              {roll.status === 'active' 
                ? <span className="status-badge active">进行中</span> 
                : <span className="status-badge archived">已完成</span>}
            </div>
          </div>

          <div className="roll-card-row-info">
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>{roll.name}</h3>
            
            {collectionName && (
              <p className="roll-card-meta">
                <Folder size={12} style={{ flexShrink: 0 }} /> {collectionName}
              </p>
            )}

            <p className="roll-card-meta">
              <Camera size={12} style={{ flexShrink: 0 }} />
              {(roll.cameraIds || []).map(getCameraName).join(', ') || '未绑定相机'}
            </p>
            {enableFilmMode && roll.filmStockId !== 'digital-placeholder' && (
              <p className="roll-card-meta">
                <Film size={12} style={{ flexShrink: 0 }} />
                {getFilmName(roll.filmStockId)}
              </p>
            )}
            <p className="roll-card-meta">
              <span className="roll-date">{new Date(roll.startDate || nowTimestamp).toLocaleDateString()}</span>
            </p>
          </div>

          <div className="roll-card-row-actions">
            {activeCollectionId && roll.collectionId === activeCollectionId && (
              <button className="action-btn" onClick={(e) => handleRemoveFromCollection(roll.id!, e)} title="移出项目集">
                <Folder size={12} /> <span>移出</span>
              </button>
            )}
            {roll.status === 'active' && (
              <button className="action-btn success" onClick={(e) => handleArchiveRoll(roll.id!, e)} title="标记为已完成">
                <CheckCircle size={14} /> <span>完成</span>
              </button>
            )}
            <button className="action-btn danger" onClick={(e) => handleDeleteRoll(roll.id!, e)} title="删除拍摄卷">
              <Trash2 size={14} /> <span>删除</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div 
        key={roll.id} 
        className="roll-card"
        onClick={() => openRollDrawer(roll)}
      >
        {/* Image Zone */}
        <div 
          className="roll-card-cover" 
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : {}}
        >
          {!coverUrl && <div className="roll-card-placeholder"><Film size={28} /></div>}
          
          <div className="roll-card-status">
            {roll.status === 'active' 
              ? <span className="status-badge active">进行中</span> 
              : <span className="status-badge archived">已完成</span>}
          </div>

          {collectionName && (
            <div className="roll-card-collection-tag">
              <Folder size={10} /> {collectionName}
            </div>
          )}
        </div>

        {/* Info Panel (separate from image, no overlay) */}
        <div className="roll-card-content">
          <h3>{roll.name}</h3>
          <p className="roll-card-meta">
            <Camera size={12} style={{ flexShrink: 0 }} />
            {(roll.cameraIds || []).map(getCameraName).join(', ') || '未绑定相机'}
          </p>
          {enableFilmMode && roll.filmStockId !== 'digital-placeholder' && (
            <p className="roll-card-meta">
              <Film size={12} style={{ flexShrink: 0 }} />
              {getFilmName(roll.filmStockId)}
            </p>
          )}
          <div className="roll-card-footer">
            <span className="roll-date">
              起：{new Date(roll.startDate || nowTimestamp).toLocaleDateString()}
              {roll.endDate && ` / 止：${new Date(roll.endDate).toLocaleDateString()}`}
            </span>
          </div>
          
          <div className="roll-card-actions">
            {activeCollectionId && roll.collectionId === activeCollectionId && (
              <button className="action-btn" onClick={(e) => handleRemoveFromCollection(roll.id!, e)} title="移出项目集">
                <Folder size={12} /> <span>移出</span>
              </button>
            )}
            {roll.status === 'active' && (
              <button className="action-btn success" onClick={(e) => handleArchiveRoll(roll.id!, e)} title="标记为已完成">
                <CheckCircle size={14} /> <span>完成</span>
              </button>
            )}
            <button className="action-btn danger" onClick={(e) => handleDeleteRoll(roll.id!, e)} title="删除拍摄卷">
              <Trash2 size={14} /> <span>删除</span>
            </button>
          </div>
        </div>
      </div>
    );
  };


  const renderedRollCards = useMemo(() => {
    return processedRolls.map(renderRollCard);
  }, [processedRolls, viewLayout, activeCollectionId, collections, cameras, filmStocks, enableFilmMode, photos]);

  return (
    <div className="main-content" style={{ width: '100%', maxWidth: 'none', flex: 1 }}>
      <header className="view-header">
        <div className="view-header-title-container">
          <motion.div key={libraryView} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="view-header-icon">
              {libraryView === 'collections' ? <Folder size={20} /> : libraryView === 'loose' ? <LayoutGrid size={20} /> : <Film size={20} />}
            </div>
            <div className="view-header-text-group">
              <h1>
                {libraryView === 'collections' ? '项目集' : libraryView === 'loose' ? '散卷' : '所有拍摄卷'}
              </h1>
              <p className="view-header-subtitle">
                {libraryView === 'collections' ? '将相关的拍摄卷归类统一管理。' : libraryView === 'loose' ? '未归档到任何项目集的独立拍摄卷。' : '管理您的实体胶卷库及拍摄任务。'}
              </p>
            </div>
          </motion.div>
        </div>
        
        <div className="view-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
           <div className="tab-navigation" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0, marginRight: '8px' }}>
             <button 
               className={`tab-btn ${viewLayout === 'grid' ? 'active' : ''}`} 
               onClick={() => setViewLayout('grid')}
               style={{ padding: '6px 10px' }}
               title="网格视图"
             >
               <LayoutGrid size={16} />
             </button>
             <button 
               className={`tab-btn ${viewLayout === 'list' ? 'active' : ''}`} 
               onClick={() => setViewLayout('list')}
               style={{ padding: '6px 10px' }}
               title="列表视图"
             >
               <List size={16} />
             </button>
           </div>
           
           <button className="secondary" onClick={() => document.dispatchEvent(new CustomEvent('open-new-collection-modal'))}>
             <Folder size={16} /> 新建项目集
           </button>
           <button className="primary" onClick={() => setIsNewRollModalOpen(true)}>
             <Plus size={16} /> 新建独立拍摄卷
           </button>
        </div>
      </header>

      {/* Body Content */}
      
        {activeCollectionId ? (
          <motion.div 
            key="collection-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="collection-details-view" 
            style={{ padding: '0 32px', marginTop: '16px' }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
              <IconButton variant="solid" onClick={() => setActiveCollectionId(null)} icon={<ArrowLeft size={20} />} />
              <div>
                <h2 style={{ margin: 0 }}>{activeCollection?.name || '加载中...'}</h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {activeCollection?.description || '无描述'} · {activeCollection?.date ? new Date(activeCollection.date).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>包含的拍摄卷 ({rolls.filter(r => r.collectionId === activeCollectionId).length})</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="secondary" onClick={() => {
                  setSelectedExistingRollIds([]);
                  setIsAddExistingModalOpen(true);
                }}>
                  <Folder size={16} /> 从已有卷中选择
                </button>
                <button className="primary" onClick={() => { 
                  setSelectedCollectionId(activeCollectionId);
                  setIsNewRollModalOpen(true); 
                }}>
                  <Plus size={16} /> 新建并加入本集
                </button>
              </div>
            </div>
            
            
              <motion.div 
                key={viewLayout}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={viewLayout === 'grid' ? 'rolls-grid' : 'rolls-list'}
              >
                {rolls.filter(r => r.collectionId === activeCollectionId).length === 0 ? (
                   <div style={{ gridColumn: '1 / -1' }}>
                      <EmptyState icon={Film} title="项目集中暂无拍摄卷" description="点击右上角按钮为该项目添加拍摄卷。" />
                   </div>
                ) : (
                  rolls.filter(r => r.collectionId === activeCollectionId).map(renderRollCard)
                )}
              </motion.div>
            
          </motion.div>

        ) : (
          <motion.div 
            key="library-view"
            className="unified-rolls-view" 
            style={{ padding: '0 32px', marginTop: '16px', width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}
          >
            {/* TOP LEVEL LIBRARY TABS & SEARCH */}
            <div className="rolls-toolbar">
              
              <div className="tab-navigation rolls-tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0, flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button className={`tab-btn ${libraryView === 'collections' ? 'active' : ''}`} style={{ flex: '0 0 auto' }} onClick={() => setLibraryView('collections')}>项目集 (Collections)</button>
                <button className={`tab-btn ${libraryView === 'all' ? 'active' : ''}`} style={{ flex: '0 0 auto' }} onClick={() => setLibraryView('all')}>所有拍摄卷 (The Library)</button>
                <button className={`tab-btn ${libraryView === 'loose' ? 'active' : ''}`} style={{ flex: '0 0 auto' }} onClick={() => setLibraryView('loose')}>未整理散卷 (Loose Rolls)</button>
              </div>
              
              <div className="rolls-toolbar-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: '1 1 auto', maxWidth: '100%', minWidth: '240px', justifyContent: 'flex-end' }}>
                  <div 
                    className="search-bar search-input-wrapper" 
                    style={{ 
                      flex: '1 1 120px',
                      position: 'relative',
                      transition: 'all 0.3s ease',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  >
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input 
                      type="text" 
                      placeholder="搜索拍摄卷名称、机型、胶片..." 
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value.trim() !== '' && libraryView === 'collections') {
                          setLibraryView('all');
                        }
                      }}
                      style={{ 
                        width: '100%', 
                        paddingLeft: '36px', 
                        height: '36px', 
                        backgroundColor: 'transparent', 
                        color: 'var(--text-primary)',
                        border: 'none',
                        outline: 'none'
                      }}
                    />
                  </div>
                  
                  <div ref={sortRef} style={{ position: 'relative' }}>
                    <button 
                      className="tab-btn" 
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      style={{ height: '36px', padding: '0 12px', display: 'flex', gap: '6px', alignItems: 'center', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    >
                      {sortBy === 'date' ? '按时间排序' : '按名称排序'}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    {isSortOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '140px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div onClick={() => { setSortBy('date'); setIsSortOpen(false); }} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: sortBy === 'date' ? 'var(--accent-bg)' : 'transparent', color: sortBy === 'date' ? 'var(--accent)' : 'var(--text-primary)', fontSize: '13px' }}>按时间排序</div>
                        <div onClick={() => { setSortBy('name'); setIsSortOpen(false); }} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: sortBy === 'name' ? 'var(--accent-bg)' : 'transparent', color: sortBy === 'name' ? 'var(--accent)' : 'var(--text-primary)', fontSize: '13px' }}>按名称排序</div>
                      </div>
                    )}
                  </div>
              </div>

            </div>

            {/* CONTENT AREA */}
              {libraryView === 'collections' && (
                <motion.div
                  key="collections"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >

                  <CollectionsTab 
                    viewMode={viewLayout}
                    onCollectionSelect={(id) => {
                      setActiveCollectionId(id);
                    }} 
                  />
                </motion.div>
              )}

              {libraryView === 'all' && (
                <motion.div
                  key="all"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >

                  <div style={{ position: 'relative', minHeight: '200px' }}>
                    
                      {processedRolls.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                          <EmptyState icon={Film} title="未找到匹配的拍摄卷" description="尝试更换搜索关键词。" />
                        </motion.div>
                      ) : viewLayout === 'grid' ? (
                        <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="rolls-grid">
                          {renderedRollCards}
                        </motion.div>
                      ) : (
                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="rolls-list">
                          {renderedRollCards}
                        </motion.div>
                      )}
                    
                  </div>
                </motion.div>
              )}

              {libraryView === 'loose' && (
                <motion.div
                  key="loose"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >

                  <div style={{ position: 'relative', minHeight: '200px' }}>
                    
                      {processedRolls.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                          <EmptyState icon={Film} title={`没有未整理的拍摄任务`} description="所有的拍摄任务都已放进项目集中，或者暂无任务。" />
                        </motion.div>
                      ) : viewLayout === 'grid' ? (
                        <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="rolls-grid">
                          {renderedRollCards}
                        </motion.div>
                      ) : (
                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="rolls-list">
                          {renderedRollCards}
                        </motion.div>
                      )}
                    
                  </div>
                </motion.div>
              )}
          </motion.div>
        )}
      
            {/* Drawer for Roll Details */}
      <Drawer isOpen={isDrawerOpen && !!selectedRoll} onClose={() => setIsDrawerOpen(false)} width={600}>
        {selectedRoll && (
          <>
            <div className="drawer-header">
              <h2>{selectedRoll.name}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               {selectedRoll.status === 'active' && (
                <button className="outline-btn" style={{borderColor: 'var(--success)', color: 'var(--success)', fontSize: '12px', padding: '4px 8px'}} onClick={(e) => { handleArchiveRoll(selectedRoll.id!, e); setIsDrawerOpen(false); }}>
                  标记为已完成
                </button>
              )}
              <button className="icon-btn danger" onClick={(e) => { handleDeleteRoll(selectedRoll.id!, e); setIsDrawerOpen(false); }}>
                <Trash2 size={18} />
              </button>
              <button className="icon-btn" onClick={() => setIsDrawerOpen(false)}>
                <X size={20} />
              </button>
            </div>
            </div>
            
            <div className="drawer-content">
              {/* Cover Upload Section */}
              <div className="drawer-section">
                <h3>封面 (Cover Image)</h3>
                <div className="cover-upload-container">
                  <div className={`dropzone ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
                       onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragOver(true); }}
                       onDragLeave={() => setIsDragOver(false)}
                       onDrop={isUploading ? undefined : handleDrop}
                       style={{ height: '100%', padding: 0, border: 'none', borderRadius: 0 }}
                  >
                    {getCoverUrl(selectedRoll) && !isUploading ? (
                       <div className="cover-preview" style={{ backgroundImage: `url(${getCoverUrl(selectedRoll)})`, width: '100%', height: '100%' }}>
                          <label className="cover-upload-btn" onClick={e => e.stopPropagation()}>
                             更换封面
                             <input type="file" accept="image/*" onChange={handleFileSelect} hidden />
                          </label>
                       </div>
                    ) : isUploading ? (
                       <div style={{ width: '100%', textAlign: 'center', padding: '0 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <p style={{ fontWeight: 600 }}>正在上传封面...</p>
                          <div style={{ width: '100%', maxWidth: '300px', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', margin: '12px auto' }}>
                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s ease' }} />
                          </div>
                       </div>
                    ) : (
                       <label className="cover-upload-placeholder" style={{ width: '100%', height: '100%' }}>
                         <Upload size={24} />
                         <span>点击或拖拽上传一张封面图</span>
                         <input type="file" accept="image/*" onChange={handleFileSelect} hidden />
                       </label>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="drawer-section">
                <h3>设备与胶片 (Equipment)</h3>
                <div className="form-group">
                  <label>相机 (Camera)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', marginBottom: '12px' }}>
                    {cameras.map(c => {
                      const isSelected = (selectedRoll.cameraIds || []).includes(c.id!);
                      return (
                        <div key={c.id} 
                          onClick={async () => {
                            let newIds = [...(selectedRoll.cameraIds || [])];
                            if (isSelected) newIds = newIds.filter(id => id !== c.id);
                            else newIds.push(c.id!);
                            if (newIds.length === 0) return; // Must have at least 1 camera
                            await db.rolls.update(selectedRoll.id!, { cameraIds: newIds });
                          }}
                          style={{ 
                            padding: '4px 10px', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`, 
                            borderRadius: '12px', fontSize: '11px', cursor: 'pointer',
                            background: isSelected ? 'var(--accent)' : 'transparent', color: isSelected ? '#fff' : 'inherit'
                          }}
                        >{c.name}</div>
                      );
                    })}
                  </div>
                  
                  {enableFilmMode && (
                    <>
                      <label>胶卷 (Film Stock)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', marginBottom: '16px' }}>
                        {visibleFilmStocks.map(f => {
                          const isSelected = selectedRoll.filmStockId === f.id;
                          return (
                            <div key={f.id} 
                              onClick={async () => {
                                if (isSelected) return; // Must have 1 film
                                await db.rolls.update(selectedRoll.id!, { filmStockId: f.id });
                              }}
                              style={{ 
                                padding: '4px 10px', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`, 
                                borderRadius: '12px', fontSize: '11px', cursor: 'pointer',
                                background: isSelected ? 'var(--accent)' : 'transparent', color: isSelected ? '#fff' : 'inherit'
                              }}
                            >{f.brand} {f.name}</div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="drawer-section">
                <h3>任务元数据 (Metadata)</h3>
                
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label>开始日期 (Start Date)</label>
                    <input 
                      type="date" 
                      className="form-control"
                      value={new Date(selectedRoll.startDate).toISOString().split('T')[0]}
                      onChange={async (e) => {
                         if (e.target.value) {
                           await db.rolls.update(selectedRoll.id!, { startDate: new Date(e.target.value).getTime() });
                         }
                      }}
                    />
                  </div>
                  {selectedRoll.status === 'archived' && (
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label>完成日期 (End Date)</label>
                      <input 
                        type="date" 
                        className="form-control"
                        value={selectedRoll.endDate ? new Date(selectedRoll.endDate).toISOString().split('T')[0] : ''}
                        onChange={async (e) => {
                           if (e.target.value) {
                             await db.rolls.update(selectedRoll.id!, { endDate: new Date(e.target.value).getTime() });
                           }
                        }}
                      />
                    </div>
                  )}
                </div>
                
                <div className="form-group">
                  <label>所属拍摄项目 (Collection)</label>
                  <select 
                    className="form-control"
                    value={selectedRoll?.collectionId || ''} 
                    onChange={async (e) => {
                      if (selectedRoll.id) {
                        await db.rolls.update(selectedRoll.id, { collectionId: e.target.value || undefined });
                      }
                    }}
                  >
                    <option value="">未分类 (独立胶卷)</option>
                    {collections && collections.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>拍摄位置</label>
                  <input type="text" className="form-control" placeholder="地点名称" value={rollLocation} onChange={e => setRollLocation(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label>总体评分</label>
                  <div className="star-rating">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} size={20} fill={(selectedRoll.rating || 0) >= star ? 'var(--accent)' : 'none'} color={(selectedRoll.rating || 0) >= star ? 'var(--accent)' : 'var(--text-muted)'} onClick={() => handleSetRating(star)} style={{ cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>备注 / 想法</label>
                  <textarea className="form-control" rows={3} placeholder="拍摄心得或镜头表现..." value={rollNotes} onChange={e => setRollNotes(e.target.value)} />
                </div>
              </div>
              
              <div className="drawer-section">
                <h3 style={{ color: 'var(--accent)' }}>冲洗备忘录 (Development)</h3>
                <div className="form-group">
                  <label>冲洗开支 (￥)</label>
                  <input type="number" className="form-control" placeholder="例如: 35 (选填)" value={developPrice} onChange={e => setDevelopPrice(e.target.value ? Number(e.target.value) : '')} />
                </div>
                <div className="form-group">
                  <label>药水时间、显影、迫冲</label>
                  <textarea className="form-control" rows={4} style={{ fontFamily: 'monospace', fontSize: '13px' }} placeholder="例如:&#10;显影剂: D-76 (1:1)&#10;显影时间: 9分30秒" value={developNotes} onChange={e => setDevelopNotes(e.target.value)} />
                </div>
              </div>
            </div>
            
            <div className="drawer-footer">
              <button className="primary full-width" onClick={handleSaveDetails}>
                保存全部更改
              </button>
            </div>
          </>
        )}
      </Drawer>

      {/* --- NEW ROLL MODAL --- */}
      <Modal isOpen={isNewRollModalOpen} onClose={() => setIsNewRollModalOpen(false)}>
            <h3>新建拍摄卷 (New Roll)</h3>
            <form onSubmit={handleCreateRoll}>
              <div className="form-group">
                <label>拍摄主题/名称</label>
                <input type="text" className="form-control" placeholder="例如: 2026春日踏青" value={rollTitle} onChange={e => setRollTitle(e.target.value)} required />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>使用相机 (必选，可多选)</label>
                  <button type="button" className="text-btn" onClick={() => setQuickAddCameraOpen(true)}>+ 快捷添加</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {cameras.map(c => {
                    const isSelected = selectedCameraIds.includes(c.id!);
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          if (isSelected) setSelectedCameraIds(prev => prev.filter(id => id !== c.id));
                          else setSelectedCameraIds(prev => [...prev, c.id!]);
                        }}
                        style={{ 
                          padding: '6px 12px', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`, 
                          borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          color: isSelected ? '#fff' : 'inherit'
                        }}
                      >
                        {c.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {enableFilmMode && (
                <>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label>使用胶卷 (必填)</label>
                      <button type="button" className="text-btn" onClick={() => setQuickAddFilmOpen(true)}>+ 快捷添加</button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div className="search-input-wrapper">
                        <Search className="search-icon" size={16} />
                        <input 
                            type="text" 
                            className="form-control premium-search-input" 
                            placeholder="搜索胶卷库 (如: Kodak Gold 200)..." 
                            value={filmSearchText} 
                            onFocus={() => setIsFilmDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setIsFilmDropdownOpen(false), 200)}
                            onChange={e => {
                                setFilmSearchText(e.target.value);
                                setIsFilmDropdownOpen(true);
                                const matched = visibleFilmStocks.find(f => `${f.brand} ${f.name}`.toLowerCase() === e.target.value.trim().toLowerCase());
                                if (matched) setSelectedFilmId(matched.id!);
                                else setSelectedFilmId('');
                            }}
                            required={enableFilmMode}
                            style={{ borderColor: selectedFilmId ? 'var(--success)' : 'var(--border-color)' }}
                        />
                      </div>
                      
                      {isFilmDropdownOpen && (
                        <motion.ul 
                          className="custom-dropdown-menu glass-dropdown"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          {visibleFilmStocks.filter(f => `${f.brand} ${f.name}`.toLowerCase().includes(filmSearchText.toLowerCase())).length > 0 ? (
                            visibleFilmStocks.filter(f => `${f.brand} ${f.name}`.toLowerCase().includes(filmSearchText.toLowerCase())).map(f => (
                              <li key={f.id} className="custom-dropdown-item" onClick={() => {
                                  setFilmSearchText(`${f.brand} ${f.name}`);
                                  setSelectedFilmId(f.id!);
                                  setIsFilmDropdownOpen(false);
                              }}>
                                <div className="dropdown-item-title">{f.brand} {f.name}</div>
                                <div className="dropdown-item-meta">ISO {f.iso} • 余量 {f.stockCount || 0} 卷</div>
                              </li>
                            ))
                          ) : (
                            <div className="dropdown-empty-state">库存中未找到该胶卷</div>
                          )}
                          {!visibleFilmStocks.some(f => `${f.brand} ${f.name}`.toLowerCase() === filmSearchText.trim().toLowerCase()) && filmSearchText.trim() !== '' && (
                            <li className="custom-dropdown-item create-new-item" onClick={() => setIsFilmDropdownOpen(false)}>
                              <div className="dropdown-item-title dropdown-item-new"><Sparkles size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '4px' }}/> 极速建档: {filmSearchText}</div>
                              <div className="dropdown-item-meta">回车或点击直接创建，系统自动推断参数</div>
                            </li>
                          )}
                        </motion.ul>
                      )}
                      
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>本卷胶片成本 (￥)</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button type="button" className="secondary icon-btn" onClick={() => setRollFilmPrice(p => Math.max(0, (Number(p) || 0) - 5))} title="-5">-5</button>
                      <button type="button" className="secondary icon-btn" onClick={() => setRollFilmPrice(p => Math.max(0, (Number(p) || 0) - 1))} title="-1">-1</button>
                      <input type="number" className="form-control" style={{ textAlign: 'center', margin: 0 }} placeholder="留空或输入" value={rollFilmPrice} onChange={e => setRollFilmPrice(e.target.value ? Number(e.target.value) : '')} />
                      <button type="button" className="secondary icon-btn" onClick={() => setRollFilmPrice(p => (Number(p) || 0) + 1)} title="+1">+1</button>
                      <button type="button" className="secondary icon-btn" onClick={() => setRollFilmPrice(p => (Number(p) || 0) + 5)} title="+5">+5</button>
                    </div>
                    {rollFilmPrice !== '' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={generateFilmExpense} onChange={e => setGenerateFilmExpense(e.target.checked)} />
                        <span>产生新开支流水 (现买现拍请勾选，消耗已有库存请勿勾选)</span>
                      </label>
                    )}
                  </div>
                </>
              )}

              <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
                  保存并创建下一卷
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => { setIsNewRollModalOpen(false); setRollTitle(''); setSelectedCameraIds([]); setSelectedFilmId(''); setFilmSearchText(''); setRollFilmPrice(''); setGenerateFilmExpense(true); }}>取消</button>
                  <button type="submit" className="primary" disabled={!rollTitle || selectedCameraIds.length === 0 || (enableFilmMode && !filmSearchText.trim())}>开始记录</button>
                </div>
              </div>
            </form>
          </Modal>

      {/* --- QUICK ADD CAMERA MODAL --- */}
      <Modal isOpen={quickAddCameraOpen} onClose={() => setQuickAddCameraOpen(false)} overlayStyle={{ zIndex: 110 }} style={{ maxWidth: '400px' }}>
            <h3>快捷添加相机</h3>
            <form onSubmit={handleQuickAddCamera}>
              <div className="form-group">
                <label>相机名称</label>
                <input type="text" className="form-control" placeholder="例如: Leica M6" value={qaCameraName} onChange={e => setQaCameraName(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setQuickAddCameraOpen(false)}>取消</button>
                <button type="submit" className="primary">添加并选中</button>
              </div>
            </form>
      </Modal>

      {/* --- QUICK ADD FILM MODAL --- */}
      <Modal isOpen={quickAddFilmOpen} onClose={() => setQuickAddFilmOpen(false)} overlayStyle={{ zIndex: 110 }} style={{ maxWidth: '400px' }}>
            <h3>快捷添加胶卷</h3>
            <form onSubmit={handleQuickAddFilm}>
              <div className="form-group">
                <label>品牌/厂商</label>
                <input type="text" className="form-control" placeholder="例如: Kodak" value={qaFilmBrand} onChange={e => setQaFilmBrand(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>型号名称</label>
                <input type="text" className="form-control" placeholder="例如: Gold 200" value={qaFilmName} onChange={e => setQaFilmName(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setQuickAddFilmOpen(false)}>取消</button>
                <button type="submit" className="primary">添加并选中</button>
              </div>
            </form>
      </Modal>

      {/* --- ADD EXISTING ROLLS TO COLLECTION MODAL --- */}
      <Modal isOpen={isAddExistingModalOpen} onClose={() => setIsAddExistingModalOpen(false)} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>从已有卷中选择 (Add Existing)</h3>
              <button className="icon-btn" onClick={() => setIsAddExistingModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rolls.filter(r => r.collectionId !== activeCollectionId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>没有可供添加的拍摄卷。</div>
              ) : (
                rolls.filter(r => r.collectionId !== activeCollectionId).map(roll => {
                   const isSelected = selectedExistingRollIds.includes(roll.id!);
                   const currentCollection = roll.collectionId ? collections.find(c => c.id === roll.collectionId)?.name : '独立卷';
                   return (
                     <div key={roll.id} 
                          onClick={() => setSelectedExistingRollIds(prev => isSelected ? prev.filter(id => id !== roll.id) : [...prev, roll.id!])}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`, borderRadius: '8px', cursor: 'pointer', background: isSelected ? 'rgba(0, 122, 255, 0.05)' : 'transparent' }}>
                       <input type="checkbox" checked={isSelected} readOnly style={{ pointerEvents: 'none' }} />
                       <div>
                         <div style={{ fontWeight: 600, fontSize: '14px' }}>{roll.name}</div>
                         <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{currentCollection} · {new Date(roll.startDate || nowTimestamp).toLocaleDateString()}</div>
                       </div>
                     </div>
                   );
                })
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button className="secondary" onClick={() => setIsAddExistingModalOpen(false)}>取消</button>
              <button className="primary" onClick={handleAddExistingRolls} disabled={selectedExistingRollIds.length === 0}>
                添加选中卷 ({selectedExistingRollIds.length})
              </button>
            </div>
      </Modal>

    </div>
  );
};
