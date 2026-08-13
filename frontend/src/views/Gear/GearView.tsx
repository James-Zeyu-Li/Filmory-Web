import React, { useState, useRef, useEffect } from 'react';
import { type Camera, type Lens, type FilmStock, type OtherEquipment } from '../../db/schema';
import { Camera as CameraIcon, Plus, X, Search, Aperture, Film, Package } from 'lucide-react';
import './GearView.css';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { useLanguage } from '../../contexts/useLanguage';
import { useCameraSystems, useCameras, useFilmBacks, useLenses, useFilmStocks, useOtherEquipments } from '../../hooks/useData';
import { Modal } from '../../components/Modal';
import { motion } from 'framer-motion';
import {
  GEAR_AVATAR_MAX_EDGE,
  GEAR_AVATAR_WEBP_QUALITY,
  compressImageToBase64,
} from '../../utils/imageService';
import { removeGearAvatar, updateGearAvatar, type GearAvatarTableName } from '../../services/gearAvatarService';
import { useLocation, useNavigate } from 'react-router-dom';
import { GEAR_SUB_TAB_KEY } from '../../services/workspacePreferences';
import { requestImmediateSync } from '../../services/syncEvents';
import { CamerasTab } from './components/camera/CamerasTab';
import { CameraFormModal } from './components/camera/CameraFormModal';
import { LensesTab } from './components/lens/LensesTab';
import { LensFormModal } from './components/lens/LensFormModal';
import { FilmStocksTab } from './components/film/FilmStocksTab';
import { FilmStockFormModal } from './components/film/FilmStockFormModal';
import { OtherEquipmentTab } from './components/equipment/OtherEquipmentTab';
import { GearAvatarEditor } from './components/shared/GearAvatarEditor';
import { useGearActions } from './hooks/useGearActions';
interface GearViewProps {
  enableFilmMode: boolean;
}

type SubTab = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';
type AvatarActionEntity = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';

const isSubTab = (value: string | null): value is SubTab => {
  return value === 'cameras' || value === 'lenses' || value === 'filmStocks' || value === 'otherEquipments';
};

export const GearView: React.FC<GearViewProps> = ({ enableFilmMode }) => {
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const { currencySymbol } = useCurrency();
  const { t } = useLanguage();
  const gearActions = useGearActions();
  const location = useLocation();
  const navigate = useNavigate();
  const initialSearchParams = new URLSearchParams(location.search);
  const initialTab = initialSearchParams.get('tab');
  const shouldOpenNewCamera = initialSearchParams.get('newCamera') === '1';
  const shouldOpenNewFilm = initialSearchParams.get('newFilm') === '1';
  const [subTab, setSubTab] = useState<SubTab>(() => {
    const savedTab = localStorage.getItem(GEAR_SUB_TAB_KEY);
    const candidate = isSubTab(initialTab) ? initialTab : isSubTab(savedTab) ? savedTab : 'cameras';
    return !enableFilmMode && candidate === 'filmStocks' ? 'cameras' : candidate;
  });
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(shouldOpenNewCamera);
  const [isLensModalOpen, setIsLensModalOpen] = useState(false);
  const [isFilmModalOpen, setIsFilmModalOpen] = useState(shouldOpenNewFilm);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [keepModalOpen, setKeepModalOpen] = useState(false);

  // Archive state
  const [archiveTarget, setArchiveTarget] = useState<{ id: string, type: 'camera' | 'lens', name: string } | null>(null);
  const [archivePrice, setArchivePrice] = useState<number | ''>('');

  // Editing state
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [cameraFormSession, setCameraFormSession] = useState(0);
  const [editingLensId, setEditingLensId] = useState<string | null>(null);
  const [lensFormSession, setLensFormSession] = useState(0);
  const [editingFilmId, setEditingFilmId] = useState<string | null>(null);
  const [filmFormSession, setFilmFormSession] = useState(0);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);

  // Forms state
  const [newEquipment, setNewEquipment] = useState<Partial<OtherEquipment>>({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined });
  const [nowTimestamp] = useState(Date.now);

  // Upload and Lightbox states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadEntity, setActiveUploadEntity] = useState<{ id: string, type: AvatarActionEntity } | null>(null);
  const [uploadingEntityId, setUploadingEntityId] = useState<string | null>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!location.search) return;
    navigate('/gear', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    localStorage.setItem(GEAR_SUB_TAB_KEY, subTab);
  }, [subTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const getAvatarFullUrl = (url?: string | null) => {
    if (!url) return null;
    return (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) ? url : null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewAvatarUrl(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerAvatarUpload = (id: string, type: AvatarActionEntity) => {
    setActiveUploadEntity({ id, type });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const openAvatarPreview = (avatarUrl?: string | null) => {
    const avatarFullUrl = getAvatarFullUrl(avatarUrl);
    if (avatarFullUrl) {
      setPreviewAvatarUrl(avatarFullUrl);
    }
  };

  const updateEditingAvatarState = (
    id: string,
    type: GearAvatarTableName,
    avatarUrl: string | null
  ) => {
    if (type === 'otherEquipments' && editingEquipmentId === id) {
      setNewEquipment(prev => ({ ...prev, avatarUrl }));
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadEntity) return;

    setUploadingEntityId(activeUploadEntity.id);

    try {
      const base64DataUrl = await compressImageToBase64(
        file,
        GEAR_AVATAR_MAX_EDGE,
        GEAR_AVATAR_WEBP_QUALITY
      );

      await updateGearAvatar(activeUploadEntity.type, activeUploadEntity.id, base64DataUrl);
      requestImmediateSync('gear-cover-upload');
      updateEditingAvatarState(activeUploadEntity.id, activeUploadEntity.type, base64DataUrl);

    } catch (err) {
      console.error(err);
      notify({
        type: 'error',
        title: t('gear.avatarProcessFailedTitle'),
        message: err instanceof Error ? err.message : t('gear.retryLater')
      });
    } finally {
      setUploadingEntityId(null);
      setActiveUploadEntity(null);
    }
  };

  const handleRemoveAvatar = async (
    id: string,
    type: GearAvatarTableName,
    label: string
  ) => {
    const confirmed = await confirm({
      title: t('gear.removeCoverTitle'),
      message: t('gear.removeCoverConfirm', { name: label }),
      confirmText: t('gear.removeCover')
    });
    if (!confirmed) return;

    try {
      await removeGearAvatar(type, id);
      requestImmediateSync('gear-cover-remove');
      updateEditingAvatarState(id, type, null);
      notify({
        type: 'success',
        title: t('gear.coverRemovedTitle'),
        message: t('gear.coverRemovedMessage')
      });
    } catch (err) {
      notify({
        type: 'error',
        title: t('gear.removeCoverFailedTitle'),
        message: err instanceof Error ? err.message : t('gear.retryLater')
      });
    }
  };

  const allCameras = useCameras();
  const cameraSystems = useCameraSystems();
  const filmBacks = useFilmBacks();
  const allLenses = useLenses();
  const cameras = allCameras.filter(c => c.status !== 'archived');
  const lenses = allLenses.filter(l => l.status !== 'archived');
  const filmStocks = useFilmStocks();
  const otherEquipments = useOtherEquipments();

  // Actions

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipment.name) return;

    const result = await gearActions.saveOtherEquipment({
      draft: newEquipment,
      editingId: editingEquipmentId,
      existingEquipment: otherEquipments,
    });
    if (result === 'trial-blocked') {
      setIsEquipmentModalOpen(false);
      return;
    }
    if (result !== 'saved') return;

    setNewEquipment({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined, purchasePrice: undefined });
    setEditingEquipmentId(null);
    if (!keepModalOpen) setIsEquipmentModalOpen(false);
  };

  const handleDeleteCamera = gearActions.deleteCamera;

  const handleDeleteLens = gearActions.deleteLens;

  const handleArchiveConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveTarget) return;

    await gearActions.archiveGear({
      ...archiveTarget,
      salePrice: archivePrice,
    });

    setArchiveTarget(null);
    setArchivePrice('');
  };

  const handleDeleteFilm = gearActions.deleteFilmStock;

  const handleUpdateStock = async (id: string, change: number) => {
    const film = filmStocks.find(stock => stock.id === id);
    if (!film) return;
    await gearActions.adjustFilmStockCount(film, change);
  };

  const handleDeleteEquipment = gearActions.deleteOtherEquipment;

  const openEditCamera = (c: Camera) => {
    setEditingCameraId(c.id!);
    setCameraFormSession(previous => previous + 1);
    setIsCameraModalOpen(true);
  };

  const openEditLens = (l: Lens) => {
    setEditingLensId(l.id!);
    setLensFormSession(previous => previous + 1);
    setIsLensModalOpen(true);
  };

  const openEditFilm = (f: FilmStock) => {
    setEditingFilmId(f.id!);
    setFilmFormSession(previous => previous + 1);
    setIsFilmModalOpen(true);
  };

  const openEditEquipment = (eq: OtherEquipment) => {
    setEditingEquipmentId(eq.id!);
    setNewEquipment(eq);
    setIsEquipmentModalOpen(true);
  };

  const renderAvatarEditor = (
    id: string | null,
    type: GearAvatarTableName,
    avatarUrl: string | null | undefined,
    label: string,
    placeholder: React.ReactNode
  ) => <GearAvatarEditor id={id} type={type} avatarUrl={avatarUrl} label={label} placeholder={placeholder} uploading={uploadingEntityId === id} t={t} onPreview={openAvatarPreview} onUpload={triggerAvatarUpload} onRemove={(avatarId, avatarType, avatarLabel) => { void handleRemoveAvatar(avatarId, avatarType, avatarLabel); }} />;

  const openNewCamera = () => {
    setEditingCameraId(null);
    setCameraFormSession(previous => previous + 1);
    setIsCameraModalOpen(true);
  };

  const openNewLens = () => {
    setEditingLensId(null);
    setLensFormSession(previous => previous + 1);
    setIsLensModalOpen(true);
  };

  const openNewFilm = () => {
    setEditingFilmId(null);
    setFilmFormSession(previous => previous + 1);
    setIsFilmModalOpen(true);
  };

  const openNewEquipment = () => {
    setEditingEquipmentId(null);
    setNewEquipment({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined });
    setIsEquipmentModalOpen(true);
  };

  const renderActiveTab = () => {
    if (subTab === 'cameras') {
      return <CamerasTab cameras={allCameras} cameraSystems={cameraSystems} filmBacks={filmBacks} searchQuery={searchQuery} sortBy={sortBy} t={t} uploadingEntityId={uploadingEntityId} onAdd={openNewCamera} onEdit={openEditCamera} onDelete={handleDeleteCamera} onArchive={camera => setArchiveTarget({ id: camera.id!, type: 'camera', name: camera.name })} onUpload={id => triggerAvatarUpload(id, 'cameras')} onPreview={openAvatarPreview} />;
    }
    if (subTab === 'lenses') {
      return <LensesTab lenses={allLenses} searchQuery={searchQuery} sortBy={sortBy} t={t} uploadingEntityId={uploadingEntityId} onAdd={openNewLens} onEdit={openEditLens} onDelete={handleDeleteLens} onArchive={lens => setArchiveTarget({ id: lens.id!, type: 'lens', name: lens.name })} onUpload={id => triggerAvatarUpload(id, 'lenses')} onPreview={openAvatarPreview} />;
    }
    if (subTab === 'filmStocks' && enableFilmMode) {
      return <FilmStocksTab filmStocks={filmStocks} searchQuery={searchQuery} sortBy={sortBy} t={t} uploadingEntityId={uploadingEntityId} onAdd={openNewFilm} onEdit={openEditFilm} onDelete={handleDeleteFilm} onUpload={id => triggerAvatarUpload(id, 'filmStocks')} onPreview={openAvatarPreview} onAdjustStock={(id, delta) => { void handleUpdateStock(id, delta); }} />;
    }
    return <OtherEquipmentTab equipment={otherEquipments} searchQuery={searchQuery} sortBy={sortBy} nowTimestamp={nowTimestamp} t={t} onAdd={openNewEquipment} onEdit={openEditEquipment} onDelete={handleDeleteEquipment} />;
  };

  return (
    <div className="main-content" style={{ width: '100%', maxWidth: 'none', flex: 1 }}>
      <header className="view-header">
        <div className="view-header-title-container">
          <motion.div key={subTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="view-header-icon">
              {subTab === 'cameras' ? <CameraIcon size={20} /> : subTab === 'lenses' ? <Aperture size={20} /> : subTab === 'filmStocks' ? <Film size={20} /> : <Package size={20} />}
            </div>
            <div className="view-header-text-group">
              <h1>
                {subTab === 'cameras' ? t('gear.camerasTitle') : subTab === 'lenses' ? t('gear.lensesTitle') : subTab === 'filmStocks' ? t('gear.filmStocksTitle') : t('gear.otherTitle')}
              </h1>
              <p className="view-header-subtitle">
                {subTab === 'cameras' ? t('gear.camerasSubtitle') : subTab === 'lenses' ? t('gear.lensesSubtitle') : subTab === 'filmStocks' ? t('gear.filmStocksSubtitle') : t('gear.otherSubtitle')}
              </p>
            </div>
          </motion.div>
        </div>
        <div className="view-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {subTab === 'cameras' && (
            <button className="primary" onClick={openNewCamera}>
              <Plus size={16} /> <span>{t('gear.addCamera')}</span>
            </button>
          )}
          {subTab === 'lenses' && (
            <button className="primary" onClick={openNewLens}>
              <Plus size={16} /> <span>{t('gear.addLens')}</span>
            </button>
          )}
          {subTab === 'filmStocks' && enableFilmMode && (
            <button className="primary" onClick={openNewFilm}>
              <Plus size={16} /> <span>{t('gear.addFilmStock')}</span>
            </button>
          )}
          {subTab === 'otherEquipments' && (
            <button className="primary" onClick={() => {
              setEditingEquipmentId(null);
              setNewEquipment({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined });
              setIsEquipmentModalOpen(true);
            }}>
              <Plus size={16} /> <span>{t('gear.addGear')}</span>
            </button>
          )}
        </div>
      </header>

      <div className="unified-rolls-view" style={{ padding: '0 32px', marginTop: '16px', width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}>
        <div className="rolls-toolbar">
          <div className="tab-navigation rolls-tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0, flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              className={`tab-btn ${subTab === 'cameras' ? 'active' : ''}`}
              onClick={() => setSubTab('cameras')}
              style={{ whiteSpace: 'nowrap', flex: '0 0 auto' }}
            >
              <CameraIcon size={16} /> {t('gear.camerasTab')} ({cameras.length})
            </button>
            <button
              className={`tab-btn ${subTab === 'lenses' ? 'active' : ''}`}
              onClick={() => setSubTab('lenses')}
            >
              <Aperture size={16} /> {t('gear.lensesTab')} ({lenses.length})
            </button>
            {enableFilmMode && (
              <button
                className={`tab-btn ${subTab === 'filmStocks' ? 'active' : ''}`}
                onClick={() => setSubTab('filmStocks')}
              >
                <Film size={16} /> {t('gear.filmStocksTab')} ({filmStocks.length})
              </button>
            )}
            <button
              className={`tab-btn ${subTab === 'otherEquipments' ? 'active' : ''}`}
              onClick={() => setSubTab('otherEquipments')}
            >
              <Package size={16} /> {t('gear.otherTab')} ({otherEquipments.length})
            </button>
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
                placeholder={t('gear.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                {sortBy === 'date' ? t('gear.sortDate') : t('gear.sortName')}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              {isSortOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '140px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div onClick={() => { setSortBy('date'); setIsSortOpen(false); }} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: sortBy === 'date' ? 'var(--accent-bg)' : 'transparent', color: sortBy === 'date' ? 'var(--accent)' : 'var(--text-primary)', fontSize: '13px' }}>{t('gear.sortDate')}</div>
                  <div onClick={() => { setSortBy('name'); setIsSortOpen(false); }} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: sortBy === 'name' ? 'var(--accent-bg)' : 'transparent', color: sortBy === 'name' ? 'var(--accent)' : 'var(--text-primary)', fontSize: '13px' }}>{t('gear.sortName')}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <motion.div
            key={subTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {renderActiveTab()}
          </motion.div>
        </div>
      </div>

      {/* --- MODALS --- */}
      <CameraFormModal
        key={`camera-form-${cameraFormSession}`}
        isOpen={isCameraModalOpen}
        editingCamera={editingCameraId ? allCameras.find(camera => camera.id === editingCameraId) || null : null}
        keepModalOpen={keepModalOpen}
        uploadingEntityId={uploadingEntityId}
        onKeepModalOpenChange={setKeepModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPreview={openAvatarPreview}
        onUpload={triggerAvatarUpload}
        onRemoveAvatar={(id, type, label) => { void handleRemoveAvatar(id, type, label); }}
      />

      <LensFormModal
        key={`lens-form-${lensFormSession}`}
        isOpen={isLensModalOpen}
        editingLens={editingLensId ? allLenses.find(lens => lens.id === editingLensId) || null : null}
        keepModalOpen={keepModalOpen}
        uploadingEntityId={uploadingEntityId}
        onKeepModalOpenChange={setKeepModalOpen}
        onClose={() => setIsLensModalOpen(false)}
        onPreview={openAvatarPreview}
        onUpload={triggerAvatarUpload}
        onRemoveAvatar={(id, type, label) => { void handleRemoveAvatar(id, type, label); }}
      />

      <FilmStockFormModal
        key={`film-stock-form-${filmFormSession}`}
        isOpen={isFilmModalOpen}
        editingFilmStock={editingFilmId ? filmStocks.find(film => film.id === editingFilmId) || null : null}
        filmStocks={filmStocks}
        keepModalOpen={keepModalOpen}
        uploadingEntityId={uploadingEntityId}
        onKeepModalOpenChange={setKeepModalOpen}
        onClose={() => setIsFilmModalOpen(false)}
        onPreview={openAvatarPreview}
        onUpload={triggerAvatarUpload}
        onRemoveAvatar={(id, type, label) => { void handleRemoveAvatar(id, type, label); }}
      />
      <Modal isOpen={isEquipmentModalOpen} onClose={() => setIsEquipmentModalOpen(false)}>
        <h3>{editingEquipmentId ? t('gear.editGear') : t('gear.otherModalTitle')}</h3>
        <form onSubmit={handleSaveEquipment}>
          <div className="gear-context-note">
            {t('gear.otherModalNote')}
          </div>
          {renderAvatarEditor(
            editingEquipmentId,
            'otherEquipments',
            newEquipment.avatarUrl,
            newEquipment.name || t('gear.addGear'),
            <Package size={34} />
          )}
          <div className="form-group">
            <label>{t('gear.gearName')}</label>
            <input
              type="text"
              className="form-control"
              placeholder={t('gear.gearNamePlaceholder')}
              value={newEquipment.name}
              onChange={e => setNewEquipment({...newEquipment, name: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('gear.gearType')}</label>
            <select
              className="form-control"
              value={newEquipment.type}
              onChange={e => setNewEquipment({...newEquipment, type: e.target.value as any})}
              required
            >
              <option value="chemical">{t('gear.chemical')}</option>
              <option value="tripod">{t('gear.tripod')}</option>
              <option value="cleaner">{t('gear.cleaner')}</option>
              <option value="other">{t('gear.otherType')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('gear.purchaseDate')}</label>
            <input
              type="date"
              className="form-control"
              value={newEquipment.purchaseDate ? new Date(newEquipment.purchaseDate).toISOString().substring(0, 10) : ''}
              onChange={e => setNewEquipment({...newEquipment, purchaseDate: e.target.value ? new Date(e.target.value).getTime() : undefined})}
            />
          </div>
          {newEquipment.type === 'chemical' && (
            <div className="form-group">
              <label>{t('gear.chemicalExpiryDate')}</label>
              <input
                type="date"
                className="form-control"
                value={newEquipment.expiryDate ? new Date(newEquipment.expiryDate).toISOString().substring(0, 10) : ''}
                onChange={e => setNewEquipment({...newEquipment, expiryDate: e.target.value ? new Date(e.target.value).getTime() : undefined})}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>{t('gear.purchasePrice', { symbol: currencySymbol })}</label>
            <input
              type="number"
              className="form-control"
              placeholder={t('gear.purchasePriceGearPlaceholder')}
              value={newEquipment.purchasePrice || ''}
              onChange={e => setNewEquipment({...newEquipment, purchasePrice: e.target.value ? Number(e.target.value) : undefined})}
            />
          </div>
          <div className="form-group">
            <label>{t('gear.notesLabel')}</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder={t('gear.notesPlaceholder')}
              value={newEquipment.notes}
              onChange={e => setNewEquipment({...newEquipment, notes: e.target.value})}
            />
          </div>
          <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
              {t('gear.saveAndAddNext')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsEquipmentModalOpen(false)}>{t('common.cancel')}</button>
              <button type="submit" className="primary">{editingEquipmentId ? t('gear.saveChanges') : t('gear.add')}</button>
            </div>
          </div>
        </form>
      </Modal>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleAvatarFileChange}
      />

      {previewAvatarUrl && (
        <div className="lightbox-overlay" onClick={(e) => { e.stopPropagation(); setPreviewAvatarUrl(null); }}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close-btn" onClick={(e) => { e.stopPropagation(); setPreviewAvatarUrl(null); }}>
              <X size={24} />
            </button>
            <img src={previewAvatarUrl} alt="Camera Avatar Preview" className="lightbox-img" />
          </div>
        </div>
      )}
      {/* --- ARCHIVE / SELL MODAL --- */}
      <Modal isOpen={!!archiveTarget} onClose={() => { setArchiveTarget(null); setArchivePrice(''); }}>
            <h3>{t('gear.archiveSellTitle', { name: archiveTarget?.name || '' })}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
              {t('gear.archiveSellDesc')}
            </p>
            <form onSubmit={handleArchiveConfirm}>
              <div className="form-group">
                <label>{t('gear.sellPrice', { symbol: currencySymbol })}</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder={t('gear.sellPricePlaceholder')}
                  value={archivePrice}
                  onChange={e => setArchivePrice(e.target.value ? Number(e.target.value) : '')}
                />
                <small style={{ color: 'var(--text-muted)' }}>{t('gear.sellPriceHint')}</small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => { setArchiveTarget(null); setArchivePrice(''); }}>{t('common.cancel')}</button>
                <button type="submit" className="warning">{t('gear.confirmArchive')}</button>
              </div>
            </form>
      </Modal>
    </div>
  );
};
