import React, { useState, useRef, useEffect } from 'react';
import { db, type Camera, type Lens, type FilmStock, type OtherEquipment } from '../../db/schema';
import { Camera as CameraIcon, Plus, Trash2, SlidersHorizontal, Upload, X, Archive, Search, Aperture, Film, Package } from 'lucide-react';
import {
  COMMON_CAMERAS,
  COMMON_FILM_STOCKS,
  COMMON_LENSES,
  type CommonCameraPreset,
  type CommonFilmStockPreset,
  type CommonLensPreset,
} from '../../catalog/gear';
import { LensSvgAvatar } from '../../components/LensSvgAvatar';
import { FilmSvgAvatar } from '../../components/FilmSvgAvatar';
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
import { OtherEquipmentFormModal } from './components/equipment/OtherEquipmentFormModal';
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
  const [equipmentFormSession, setEquipmentFormSession] = useState(0);
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
    setEquipmentFormSession(previous => previous + 1);
    setIsEquipmentModalOpen(true);
  };

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
    setEquipmentFormSession(previous => previous + 1);
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
            <button className="primary" onClick={openNewEquipment}>
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

            <div ref={sortRef} className="sort-dropdown-container">
              <button
                type="button"
                className="sort-trigger-btn"
                onClick={() => setIsSortOpen(!isSortOpen)}
                aria-haspopup="listbox"
                aria-expanded={isSortOpen}
                aria-controls="gear-sort-options"
              >
                <span>{sortBy === 'date' ? t('gear.sortDate') : t('gear.sortName')}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              {isSortOpen && (
                <>
                  <div className="sort-menu-backdrop" onClick={() => setIsSortOpen(false)} />
                  <div id="gear-sort-options" className="sort-dropdown-menu" role="listbox">
                    <div className="sort-sheet-handle" />
                    <div className="sort-sheet-title">{t('common.sortBy') || '排序方式'}</div>
                    <button
                      type="button"
                      className={`sort-option ${sortBy === 'date' ? 'active' : ''}`}
                      role="option"
                      aria-selected={sortBy === 'date'}
                      onClick={() => { setSortBy('date'); setIsSortOpen(false); }}
                    >
                      <span>{t('gear.sortDate')}</span>
                      {sortBy === 'date' && <Check size={14} className="sort-option-check" />}
                    </button>
                    <button
                      type="button"
                      className={`sort-option ${sortBy === 'name' ? 'active' : ''}`}
                      role="option"
                      aria-selected={sortBy === 'name'}
                      onClick={() => { setSortBy('name'); setIsSortOpen(false); }}
                    >
                      <span>{t('gear.sortName')}</span>
                      {sortBy === 'name' && <Check size={14} className="sort-option-check" />}
                    </button>
                  </div>
                </>
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
            {/* 1. CAMERAS TAB */}
            {subTab === 'cameras' && (
              <div className="cameras-grid-layout">
            {cameras.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={CameraIcon}
                  title={t('gear.noCameraTitle')}
                  description={t('gear.noCameraDesc')}
                  action={<button className="primary" onClick={() => {
                    setEditingCameraId(null);
                    setNewCamera({ name: '', type: 'film', format: '135', purchasePrice: undefined });
                    setCameraSystemMode('new');
                    setSelectedExistingCameraSystemId('');
                    setCameraSystemName('');
                    setCameraBackNames(['Back 1']);
                    setNewFilmBackName('');
                    setSelectedCameraBrand('');
                    setSelectedCameraModel('');
                    setCameraBrandSearch('');
                    setCameraModelSearch('');
                    setIsCameraModalOpen(true);
                  }}><Plus size={16} /> {t('gear.addCamera')}</button>}
                />
              </div>
            ) : displayCameras.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={CameraIcon}
                  title={t('gear.noCameraMatch')}
                  description={t('gear.noMatchDesc')}
                />
              </div>
            ) : (
              displayCameras.map(camera => {
                const avatarFullUrl = getAvatarFullUrl(camera.avatarUrl);

                return (
                  <div key={camera.id} className="gear-card camera-card-with-avatar" onClick={(e) => { e.stopPropagation(); openEditCamera(camera); }} style={{ cursor: "pointer" }}>
                    <div className="camera-avatar-container">
                      {avatarFullUrl ? (
                        <img
                          src={avatarFullUrl}
                          alt={camera.name}
                          className="camera-avatar-img"
                          onClick={(e) => { e.stopPropagation(); setPreviewAvatarUrl(avatarFullUrl); }}
                          title={t('gear.previewCover')}
                        />
                      ) : (
                        <div className="camera-avatar-placeholder">
                          {getPlaceholderText(camera.name)}
                        </div>
                      )}

                      {/* Upload overlay */}
                      <button
                        type="button"
                        className="camera-avatar-upload-overlay"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (avatarFullUrl) {
                            openAvatarPreview(avatarFullUrl);
                            return;
                          }
                          triggerAvatarUpload(camera.id!, 'cameras');
                        }}
                        disabled={uploadingEntityId === camera.id}
                        title={avatarFullUrl ? t('gear.previewCover') : getAvatarUploadTitle('cameras')}
                      >
                        {uploadingEntityId === camera.id ? (
                          <span className="avatar-loading-spinner" />
                        ) : (
                          avatarFullUrl ? <Search size={14} /> : <Upload size={14} />
                        )}
                      </button>
                    </div>

                    <div className="camera-card-content">
                      <div className="gear-card-header">
                        <span className={`tag ${camera.type}`}>{camera.type === 'film' ? t('gear.film') : t('gear.digital')}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <IconButton variant="success" icon={<Archive size={16} />} title={t('gear.sellArchive')} onClick={(e) => { e.stopPropagation(); setArchiveTarget({ id: camera.id!, type: 'camera', name: camera.name }); }} />
                          <IconButton variant="danger" icon={<Trash2 size={16} />} title={t('gear.deletePermanently')} onClick={(e) => { e.stopPropagation(); handleDeleteCamera(camera.id!); }} />
                        </div>
                      </div>
                      <h3>{camera.name}</h3>
                      <div className="gear-details">
                        <div><strong>{t('gear.format')}:</strong> {camera.format}</div>
                        {camera.format === '120' && (
                          <div><strong>{t('gear.back')}:</strong> {camera.backType === 'interchangeable' ? `${getFilmBacksForCamera(camera).length} ${t('common.backUnit')} · ${getCameraSystemName(camera.cameraSystemId)}` : t('gear.fixedBack')}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. LENSES TAB */}
        {subTab === 'lenses' && (
          <div className="lenses-grid-layout">
            {lenses.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={SlidersHorizontal}
                  title={t('gear.noLensTitle')}
                  description={t('gear.noLensDesc')}
                  action={<button className="primary" onClick={() => {
                    setEditingLensId(null);
                    setNewLens({ name: '', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' });
                    setLensDictSearch('');
                    setIsLensDictDropdownOpen(false);
                    setLensTypeFilter('prime');
                    setLensMountFilter('all');
                    setLensMountSearch('');
                    setSelectedLensBrand('');
                    setSelectedLensModel('');
                    setLensBrandSearch('');
                    setLensModelSearch('');
                    setIsLensModalOpen(true);
                  }}><Plus size={16} /> {t('gear.addLens')}</button>}
                />
              </div>
            ) : displayLenses.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={SlidersHorizontal}
                  title={t('gear.noLensMatch')}
                  description={t('gear.noMatchDesc')}
                />
              </div>
            ) : (
              displayLenses.map(lens => {
                const avatarFullUrl = getAvatarFullUrl(lens.avatarUrl);

                return (
                <div key={lens.id} className="gear-card lens-card-horizontal" onClick={(e) => { e.stopPropagation(); openEditLens(lens); }} style={{ cursor: "pointer" }}>
                  <div className="camera-avatar-container" style={{ width: '80px', height: '80px' }}>
                    {avatarFullUrl ? (
                      <img
                        src={avatarFullUrl}
                        alt={lens.name}
                        className="camera-avatar-img"
                        onClick={(e) => { e.stopPropagation(); setPreviewAvatarUrl(avatarFullUrl); }}
                        title={t('gear.previewCover')}
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="lens-card-avatar" style={{ margin: 0 }}>
                        <LensSvgAvatar focalLength={lens.focalLength} type={lens.type || 'prime'} size={72} />
                      </div>
                    )}

                    <button
                      type="button"
                      className="camera-avatar-upload-overlay"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (avatarFullUrl) {
                          openAvatarPreview(avatarFullUrl);
                          return;
                        }
                        triggerAvatarUpload(lens.id!, 'lenses');
                      }}
                      disabled={uploadingEntityId === lens.id}
                      title={avatarFullUrl ? t('gear.previewCover') : getAvatarUploadTitle('lenses')}
                    >
                      {uploadingEntityId === lens.id ? (
                        <span className="avatar-loading-spinner" />
                      ) : (
                        avatarFullUrl ? <Search size={14} /> : <Upload size={14} />
                      )}
                    </button>
                  </div>
                  <div className="lens-card-content">
                    <div className="gear-card-header">
                      <span className={`tag lens-${lens.type || 'prime'}`}>
                        {lens.type === 'prime' ? t('gear.prime') : t('gear.zoom')}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <IconButton variant="success" icon={<Archive size={16} />} title={t('gear.sellArchive')} onClick={(e) => { e.stopPropagation(); setArchiveTarget({ id: lens.id!, type: 'lens', name: lens.name }); }} />
                        <IconButton variant="danger" icon={<Trash2 size={16} />} title={t('gear.deletePermanently')} onClick={(e) => { e.stopPropagation(); handleDeleteLens(lens.id!); }} />
                      </div>
                    </div>
                    <h3>{lens.name}</h3>
                    <div className="gear-details">
                      <div><strong>{t('gear.focalLength')}:</strong> {lens.focalLength}mm</div>
                      <div><strong>{t('gear.maxAperture')}:</strong> {lens.maxAperture}</div>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        )}

        {/* 3. FILM STOCKS TAB */}
        {subTab === 'filmStocks' && enableFilmMode && (
          <div className="lenses-grid-layout">
            {displayFilms.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={Film}
                  title={t('gear.noFilmTitle')}
                  description={t('gear.noFilmDesc')}
                  action={<button className="primary" onClick={() => {
                    setEditingFilmId(null);
                    setNewFilm(createDefaultNewFilmDraft());
                    setFilmDictSearch('');
                    setIsDictDropdownOpen(false);
                    setFilmFormatFilter('135');
                    setSelectedFilmBrand('');
                    setFilmBrandSearch('');
                    setFilmModelSearch('');
                    setShowManualFilmForm(false);
                    setIsFilmModalOpen(true);
                  }}><Plus size={16} /> {t('gear.addFilmStock')}</button>}
                />
              </div>
            ) : displayFilms.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={Film}
                  title={t('gear.noFilmMatch')}
                  description={t('gear.noMatchDesc')}
                />
              </div>
            ) : (
              displayFilms.map(film => {
                const avatarFullUrl = getAvatarFullUrl(film.avatarUrl);

                return (
                <div key={film.id} className="gear-card lens-card-horizontal" onClick={() => openEditFilm(film)} style={{ cursor: "pointer" }}>
                  <div className="camera-avatar-container" style={{ width: '80px', height: '80px' }}>
                    {avatarFullUrl ? (
                      <img
                        src={avatarFullUrl}
                        alt={film.name}
                        className="camera-avatar-img"
                        onClick={(e) => { e.stopPropagation(); setPreviewAvatarUrl(avatarFullUrl); }}
                        title={t('gear.previewCover')}
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="lens-card-avatar" style={{ padding: '4px', width: '100%', height: '100%', overflow: 'hidden', margin: 0 }}>
                        <FilmSvgAvatar brand={film.brand} name={film.name} format={film.format} size={72} />
                      </div>
                    )}

                    <button
                      type="button"
                      className="camera-avatar-upload-overlay"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (avatarFullUrl) {
                          openAvatarPreview(avatarFullUrl);
                          return;
                        }
                        triggerAvatarUpload(film.id!, 'filmStocks');
                      }}
                      disabled={uploadingEntityId === film.id}
                      title={avatarFullUrl ? t('gear.previewCover') : getAvatarUploadTitle('filmStocks')}
                    >
                      {uploadingEntityId === film.id ? (
                        <span className="avatar-loading-spinner" />
                      ) : (
                        avatarFullUrl ? <Search size={14} /> : <Upload size={14} />
                      )}
                    </button>
                  </div>
                  <div className="lens-card-content">
                    <div className="gear-card-header">
                      <span className={`tag ${film.colorType === 'color' ? 'color' : 'bw'}`}>
                        {film.colorType === 'color' ? t('gear.color') : t('gear.bw')}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <IconButton variant="danger" icon={<Trash2 size={16} />} title={t('gear.deletePermanently')} onClick={(e) => { e.stopPropagation(); handleDeleteFilm(film.id!); }} />
                      </div>
                    </div>
                    <h3 style={{ margin: '4px 0' }}>{film.brand} {film.name}</h3>
                    <div className="gear-details" style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: 'none', paddingTop: '0', marginTop: '0' }}>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                        <div><strong>ISO：</strong>{film.iso}</div>
                        <div><strong>{t('gear.format')}:</strong> {film.format}</div>
                      </div>
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <strong>{t('gear.stockCount')}:</strong> {t('gear.rollsInStock', { count: film.stockCount || 0 })}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="secondary"
                            style={{ padding: '2px 8px', fontSize: '11px', minWidth: '22px', height: '22px', width: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={t('gear.decreaseStock')}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleUpdateStock(film.id!, -1);
                            }}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            style={{ padding: '2px 8px', fontSize: '11px', minWidth: '22px', height: '22px', width: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={t('gear.increaseStock')}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleUpdateStock(film.id!, 1);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        )}

        {/* 4. OTHER EQUIPMENTS TAB */}
        {subTab === 'otherEquipments' && (
          <>
            <div className="gear-context-note">
              {t('gear.otherContextNote')}
            </div>
            <div className="grid-layout">
              {otherEquipments.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                  <EmptyState
                    icon={SlidersHorizontal}
                    title={t('gear.noOtherTitle')}
                    description={t('gear.noOtherDesc')}
                    action={<button className="primary" onClick={() => { setEditingEquipmentId(null); setIsEquipmentModalOpen(true); }}><Plus size={16} /> {t('gear.registerAccessory')}</button>}
                  />
                </div>
              ) : displayEquipments.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                  <EmptyState
                    icon={SlidersHorizontal}
                    title={t('gear.noOtherMatch')}
                    description={t('gear.noMatchDesc')}
                  />
                </div>
              ) : (
                displayEquipments.map(eq => {
                  const isExpired = eq.type === 'chemical' && eq.expiryDate && eq.expiryDate < nowTimestamp;
                  return (
                    <div key={eq.id} className={`gear-card equipment-card ${isExpired ? 'expired-alert' : ''}`} onClick={() => openEditEquipment(eq)} style={{ cursor: 'pointer' }}>
                      <div className="gear-card-header">
                        <span className={`tag eq-${eq.type}`}>
                          {eq.type === 'chemical' ? t('gear.chemical') :
                           eq.type === 'tripod' ? t('gear.tripod') :
                           eq.type === 'cleaner' ? t('gear.cleaner') : t('gear.otherType')}
                        </span>
                        {isExpired && <span className="tag expired-tag">{t('gear.expired')}</span>}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <IconButton variant="danger" icon={<Trash2 size={16} />} title={t('gear.deletePermanently')} onClick={(e) => { e.stopPropagation(); handleDeleteEquipment(eq.id!); }} />
                        </div>
                      </div>
                      <h3>{eq.name}</h3>
                      <div className="gear-details">
                        {eq.purchaseDate && (
                          <div><strong>{t('gear.purchaseDate')}:</strong> {new Date(eq.purchaseDate).toLocaleDateString()}</div>
                        )}
                        {eq.type === 'chemical' && eq.expiryDate && (
                          <div className={isExpired ? 'expired-text' : ''}>
                            <strong>{t('gear.expiryDate')}:</strong> {new Date(eq.expiryDate).toLocaleDateString()}
                          </div>
                        )}
                        {eq.notes && <div><strong>{t('gear.notes')}:</strong> {eq.notes}</div>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
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
      <OtherEquipmentFormModal
        key={`equipment-form-${equipmentFormSession}`}
        isOpen={isEquipmentModalOpen}
        editingEquipment={editingEquipmentId ? otherEquipments.find(item => item.id === editingEquipmentId) || null : null}
        equipment={otherEquipments}
        keepModalOpen={keepModalOpen}
        uploadingEntityId={uploadingEntityId}
        onKeepModalOpenChange={setKeepModalOpen}
        onClose={() => setIsEquipmentModalOpen(false)}
        onPreview={openAvatarPreview}
        onUpload={triggerAvatarUpload}
        onRemoveAvatar={(id, type, label) => { void handleRemoveAvatar(id, type, label); }}
      />

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
