import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { type Camera, type Lens, type FilmStock, type OtherEquipment } from '../../db/schema';
import { Camera as CameraIcon, Check, Plus, X, Search, Aperture, Film, Package } from 'lucide-react';
import './GearView.css';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { useLanguage } from '../../contexts/useLanguage';
import { useCameraSystems, useCameras, useCollections, useFilmBacks, useLenses, useFilmStocks, useOtherEquipments, useRolls } from '../../hooks/useData';
import { Modal } from '../../components/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import { ResponsiveHeaderSubtitle } from '../../components/ui/ResponsiveHeaderSubtitle';
import { motion, useReducedMotion } from 'framer-motion';
import {
  GEAR_AVATAR_MAX_EDGE,
  GEAR_AVATAR_WEBP_QUALITY,
  compressImageToBase64,
} from '../../utils/imageService';
import { removeGearAvatar, updateGearAvatar, type GearAvatarTableName } from '../../services/gearAvatarService';
import { useLocation, useNavigate } from 'react-router-dom';
import { GEAR_SUB_TAB_KEY } from '../../services/workspacePreferences';
import { requestImmediateSync } from '../../services/syncEvents';
import { buildCameraHistorySummaries } from '../../services/gearHistoryService';
import { buildFilmUsageSummaries } from '../../services/filmInsightsService';
import { CamerasTab } from './components/camera/CamerasTab';
import { CameraFormModal } from './components/camera/CameraFormModal';
import { CameraHistoryDrawer } from './components/camera/CameraHistoryDrawer';
import { LensesTab } from './components/lens/LensesTab';
import { LensFormModal } from './components/lens/LensFormModal';
import { FilmStocksTab } from './components/film/FilmStocksTab';
import { FilmStockFormModal } from './components/film/FilmStockFormModal';
import { FilmUsageDetailDrawer } from '../FilmInsights/FilmUsageDetailDrawer';
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
  const { t, language } = useLanguage();
  const reduceMotion = useReducedMotion();
  const gearActions = useGearActions();
  const location = useLocation();
  const navigate = useNavigate();
  const initialSearchParams = new URLSearchParams(location.search);
  const initialTab = initialSearchParams.get('tab');
  const shouldOpenNewCamera = initialSearchParams.get('newCamera') === '1';
  const shouldOpenNewFilm = initialSearchParams.get('newFilm') === '1';
  // Single place that decides which tab a `tab` param (or the localStorage
  // fallback) resolves to; reused by the initial state below and by the
  // canonicalize effect so URL changes (Back/Forward, a hand-edited URL,
  // enableFilmMode flipping) are corrected the same way on every render, not
  // just at mount.
  const resolveSubTab = useCallback((tabParam: string | null): SubTab => {
    const savedTab = localStorage.getItem(GEAR_SUB_TAB_KEY);
    const candidate = isSubTab(tabParam) ? tabParam : isSubTab(savedTab) ? savedTab : 'cameras';
    return !enableFilmMode && candidate === 'filmStocks' ? 'cameras' : candidate;
  }, [enableFilmMode]);
  // Derived fresh every render from the URL (falling back to localStorage only
  // when `tab` is absent) rather than mirrored into a separate `useState` —
  // this is what keeps it following Back/Forward and hand-edited URLs without
  // a setState-in-effect sync.
  const subTab = resolveSubTab(initialTab);

  // Edit target is URL-derived, not local state: the `edit` query param (scoped by
  // the current `tab`) is the single source of truth, mirroring RollsView's
  // openRoll/collectionId. "New" record modals keep their existing local-state /
  // transient-query-flag behavior (out of scope for this URL-ification pass).
  const editIdParam = initialSearchParams.get('edit');
  const editingCameraId = subTab === 'cameras' ? editIdParam : null;
  const editingLensId = subTab === 'lenses' ? editIdParam : null;
  const editingFilmId = subTab === 'filmStocks' ? editIdParam : null;
  const editingEquipmentId = subTab === 'otherEquipments' ? editIdParam : null;

  const [isNewCameraModalOpen, setIsNewCameraModalOpen] = useState(shouldOpenNewCamera);
  const [isNewLensModalOpen, setIsNewLensModalOpen] = useState(false);
  const [isNewFilmModalOpen, setIsNewFilmModalOpen] = useState(shouldOpenNewFilm);
  const [isNewEquipmentModalOpen, setIsNewEquipmentModalOpen] = useState(false);
  const [keepModalOpen, setKeepModalOpen] = useState(false);

  // Archive state
  const [archiveTarget, setArchiveTarget] = useState<{ id: string, type: 'camera' | 'lens', name: string } | null>(null);
  const [archivePrice, setArchivePrice] = useState<number | ''>('');

  const [cameraFormSession, setCameraFormSession] = useState(0);
  const [lensFormSession, setLensFormSession] = useState(0);
  const [filmFormSession, setFilmFormSession] = useState(0);
  const [equipmentFormSession, setEquipmentFormSession] = useState(0);
  const [nowTimestamp] = useState(Date.now);

  // Detail/history viewing state (separate from the edit-form state above).
  const [viewingCameraId, setViewingCameraId] = useState<string | null>(null);
  const [viewingFilmStockId, setViewingFilmStockId] = useState<string | null>(null);

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
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const resolvedTab = resolveSubTab(tabParam);
    const hasTransientNewCamera = params.get('newCamera') === '1';
    const hasTransientNewFilm = params.get('newFilm') === '1';

    let mutated = false;
    if (tabParam === null) {
      // Missing tab: fill in the resolved one, but the `edit` id (if any) was
      // always meant for this tab — keep it.
      params.set('tab', resolvedTab);
      mutated = true;
    } else if (tabParam !== resolvedTab) {
      // Present but invalid or currently hidden (e.g. filmStocks with
      // enableFilmMode off): correct the tab. `edit` was scoped to whatever
      // entity type that tab claimed to be, which no longer matches the
      // resolved tab, so drop it rather than let it get reinterpreted as a
      // different entity type.
      params.set('tab', resolvedTab);
      mutated = true;
      if (params.has('edit')) {
        params.delete('edit');
      }
    }
    if (hasTransientNewCamera) {
      params.delete('newCamera');
      mutated = true;
    }
    if (hasTransientNewFilm) {
      params.delete('newFilm');
      mutated = true;
    }

    if (mutated) {
      navigate({ pathname: '/gear', search: params.toString() ? `?${params.toString()}` : '' }, {
        replace: true,
        state: location.state,
      });
    }
  }, [location.search, location.state, navigate, resolveSubTab]);

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
  const rolls = useRolls();
  const collections = useCollections();

  const cameraHistorySummaries = useMemo(
    () => buildCameraHistorySummaries(allCameras, rolls, collections),
    [allCameras, rolls, collections],
  );
  const filmUsageSummaries = useMemo(
    () => buildFilmUsageSummaries(filmStocks, rolls, collections),
    [filmStocks, rolls, collections],
  );
  // Resolving against the already user-scoped live-query arrays means an `edit`
  // id that's missing, deleted, or belongs to another tab/user simply won't be
  // found here — no separate ownership check needed before opening the modal.
  const editingCamera = editingCameraId ? allCameras.find(camera => camera.id === editingCameraId) ?? null : null;
  const editingLens = editingLensId ? allLenses.find(lens => lens.id === editingLensId) ?? null : null;
  const editingFilmStock = editingFilmId ? filmStocks.find(film => film.id === editingFilmId) ?? null : null;
  const editingEquipment = editingEquipmentId ? otherEquipments.find(item => item.id === editingEquipmentId) ?? null : null;
  const isCameraModalOpen = isNewCameraModalOpen || Boolean(editingCamera);
  const isLensModalOpen = isNewLensModalOpen || Boolean(editingLens);
  const isFilmModalOpen = isNewFilmModalOpen || Boolean(editingFilmStock);
  const isEquipmentModalOpen = isNewEquipmentModalOpen || Boolean(editingEquipment);

  const viewingCamera = viewingCameraId ? allCameras.find(camera => camera.id === viewingCameraId) ?? null : null;
  const viewingCameraSummary = viewingCameraId
    ? cameraHistorySummaries.find(summary => summary.camera.id === viewingCameraId) ?? null
    : null;
  const viewingFilmSummary = viewingFilmStockId
    ? filmUsageSummaries.find(summary => summary.film.id === viewingFilmStockId) ?? null
    : null;

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

  // Shared push/back-or-replace logic for the four gear edit modals, mirroring
  // RollsView's openRollDrawer/closeRollDrawer History rules: opening from the
  // current list pushes a new entry so Back closes the modal; closing otherwise
  // (X/Esc/backdrop) returns to that entry when it exists, or replaces down to
  // the canonical tab URL when there's no reliable list origin (refresh/deep link).
  const openGearEditModal = (tab: SubTab, id: string) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    params.set('edit', id);
    navigate({ pathname: '/gear', search: `?${params.toString()}` }, {
      state: { ...location.state, grainfolioGearEditOrigin: 'gear-list' },
    });
  };

  const closeGearEditModal = () => {
    if (!editIdParam) return;
    if (location.state?.grainfolioGearEditOrigin === 'gear-list') {
      navigate(-1);
      return;
    }
    const params = new URLSearchParams(location.search);
    params.delete('edit');
    navigate({ pathname: '/gear', search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
  };

  // No form-session bump needed here: the modal's `key` below is derived
  // directly from `editingCamera.id` (resolved in the same render as the URL),
  // so it's already guaranteed to remount fresh with the right record — bumping
  // a separately-timed counter here previously raced the URL update and could
  // mount the form before `editingCamera` caught up, locking in create-mode.
  const openEditCamera = (c: Camera) => {
    if (!c.id) return;
    openGearEditModal('cameras', c.id);
  };

  const openEditLens = (l: Lens) => {
    if (!l.id) return;
    openGearEditModal('lenses', l.id);
  };

  const openEditFilm = (f: FilmStock) => {
    if (!f.id) return;
    openGearEditModal('filmStocks', f.id);
  };

  const openCameraHistory = (camera: Camera) => setViewingCameraId(camera.id!);
  const closeCameraHistory = () => setViewingCameraId(null);
  const openFilmHistory = (film: FilmStock) => setViewingFilmStockId(film.id!);
  const closeFilmHistory = () => setViewingFilmStockId(null);
  const openRollFromHistory = (rollId: string) => navigate(`/rolls?tab=all&openRoll=${rollId}`);
  const openCollectionFromHistory = (collectionId: string) => navigate(`/rolls?tab=collections&collectionId=${collectionId}`);
  const openNewRollFromHistory = () => navigate('/rolls?newRoll=1');

  const openEditEquipment = (eq: OtherEquipment) => {
    if (!eq.id) return;
    openGearEditModal('otherEquipments', eq.id);
  };

  const openNewCamera = () => {
    setCameraFormSession(previous => previous + 1);
    setIsNewCameraModalOpen(true);
  };

  const openNewLens = () => {
    setLensFormSession(previous => previous + 1);
    setIsNewLensModalOpen(true);
  };

  const openNewFilm = () => {
    setFilmFormSession(previous => previous + 1);
    setIsNewFilmModalOpen(true);
  };

  const openNewEquipment = () => {
    setEquipmentFormSession(previous => previous + 1);
    setIsNewEquipmentModalOpen(true);
  };

  const handleSubTabChange = (nextTab: SubTab) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', nextTab);
    params.delete('edit');
    navigate({ pathname: '/gear', search: `?${params.toString()}` }, { replace: true });
  };

  const renderActiveTab = () => {
    if (subTab === 'cameras') {
      return <CamerasTab cameras={allCameras} cameraSystems={cameraSystems} filmBacks={filmBacks} searchQuery={searchQuery} sortBy={sortBy} t={t} uploadingEntityId={uploadingEntityId} onAdd={openNewCamera} onView={openCameraHistory} onEdit={openEditCamera} onDelete={handleDeleteCamera} onArchive={camera => setArchiveTarget({ id: camera.id!, type: 'camera', name: camera.name })} onUpload={id => triggerAvatarUpload(id, 'cameras')} onPreview={openAvatarPreview} />;
    }
    if (subTab === 'lenses') {
      return <LensesTab lenses={allLenses} searchQuery={searchQuery} sortBy={sortBy} t={t} uploadingEntityId={uploadingEntityId} onAdd={openNewLens} onEdit={openEditLens} onDelete={handleDeleteLens} onArchive={lens => setArchiveTarget({ id: lens.id!, type: 'lens', name: lens.name })} onUpload={id => triggerAvatarUpload(id, 'lenses')} onPreview={openAvatarPreview} />;
    }
    if (subTab === 'filmStocks' && enableFilmMode) {
      return <FilmStocksTab filmStocks={filmStocks} searchQuery={searchQuery} sortBy={sortBy} t={t} uploadingEntityId={uploadingEntityId} onAdd={openNewFilm} onView={openFilmHistory} onEdit={openEditFilm} onDelete={handleDeleteFilm} onUpload={id => triggerAvatarUpload(id, 'filmStocks')} onPreview={openAvatarPreview} onAdjustStock={(id, delta) => { void handleUpdateStock(id, delta); }} />;
    }
    return <OtherEquipmentTab equipment={otherEquipments} searchQuery={searchQuery} sortBy={sortBy} nowTimestamp={nowTimestamp} t={t} onAdd={openNewEquipment} onEdit={openEditEquipment} onDelete={handleDeleteEquipment} />;
  };

  return (
    <div className="main-content" style={{ width: '100%', maxWidth: 'none', flex: 1 }}>
      <header className="view-header view-header-stack-narrow">
        <div className="view-header-title-container">
          <motion.div
            key={subTab}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <div className="view-header-icon">
              {subTab === 'cameras' ? <CameraIcon size={20} /> : subTab === 'lenses' ? <Aperture size={20} /> : subTab === 'filmStocks' ? <Film size={20} /> : <Package size={20} />}
            </div>
            <div className="view-header-text-group">
              <h1>
                {subTab === 'cameras' ? t('gear.camerasTitle') : subTab === 'lenses' ? t('gear.lensesTitle') : subTab === 'filmStocks' ? t('gear.filmStocksTitle') : t('gear.otherTitle')}
              </h1>
              <ResponsiveHeaderSubtitle
                desktop={subTab === 'cameras' ? t('gear.camerasSubtitle') : subTab === 'lenses' ? t('gear.lensesSubtitle') : subTab === 'filmStocks' ? t('gear.filmStocksSubtitle') : t('gear.otherSubtitle')}
                mobile={subTab === 'cameras' ? t('gear.camerasMobileSubtitle') : subTab === 'lenses' ? t('gear.lensesMobileSubtitle') : subTab === 'filmStocks' ? t('gear.filmStocksMobileSubtitle') : t('gear.otherMobileSubtitle')}
              />
            </div>
          </motion.div>
        </div>
        <div className="view-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="primary"
            onClick={subTab === 'cameras' ? openNewCamera : subTab === 'lenses' ? openNewLens : subTab === 'filmStocks' ? openNewFilm : openNewEquipment}
          >
            <motion.span
              key={subTab}
              className="view-header-action-content"
              initial={reduceMotion ? false : { opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
            >
              <Plus size={16} />
              <span>{subTab === 'cameras' ? t('gear.addCamera') : subTab === 'lenses' ? t('gear.addLens') : subTab === 'filmStocks' ? t('gear.addFilmStock') : t('gear.addGear')}</span>
            </motion.span>
          </button>
        </div>
      </header>

      <div className="unified-rolls-view gear-library-content" style={{ padding: '0 32px', marginTop: '16px', width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}>
        <div className="rolls-toolbar">
          <PageTabs
            className="gear-page-tabs"
            tabs={[
              { id: 'cameras', label: <><CameraIcon size={16} /> {t('gear.camerasTab')} ({cameras.length})</>, mobileLabel: <><CameraIcon size={16} /> {t('gear.camerasMobileTab')} ({cameras.length})</>, ariaLabel: `${t('gear.camerasTab')} (${cameras.length})` },
              { id: 'lenses', label: <><Aperture size={16} /> {t('gear.lensesTab')} ({lenses.length})</>, mobileLabel: <><Aperture size={16} /> {t('gear.lensesMobileTab')} ({lenses.length})</>, ariaLabel: `${t('gear.lensesTab')} (${lenses.length})` },
              ...(enableFilmMode ? [{ id: 'filmStocks' as const, label: <><Film size={16} /> {t('gear.filmStocksTab')} ({filmStocks.length})</>, mobileLabel: <><Film size={16} /> {t('gear.filmStocksMobileTab')} ({filmStocks.length})</>, ariaLabel: `${t('gear.filmStocksTab')} (${filmStocks.length})` }] : []),
              { id: 'otherEquipments', label: <><Package size={16} /> {t('gear.otherTab')} ({otherEquipments.length})</>, mobileLabel: <><Package size={16} /> {t('gear.otherMobileTab')} ({otherEquipments.length})</>, ariaLabel: `${t('gear.otherTab')} (${otherEquipments.length})` },
            ]}
            activeId={subTab}
            onChange={handleSubTabChange}
            ariaLabel={t('nav.gear')}
            idPrefix="gear"
          />
          <div className="rolls-toolbar-actions gear-toolbar-actions">
            <div
              className="search-bar search-input-wrapper gear-search-input"
            >
              <Search size={16} className="gear-search-icon" />
              <input
                type="text"
                aria-label={t('gear.searchLabel')}
                placeholder={t('gear.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="gear-search-field"
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
                    <div className="sort-sheet-title">{t('common.sortBy')}</div>
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

        <div id={`gear-${subTab}-panel`} role="tabpanel" aria-labelledby={`gear-${subTab}-tab`}>
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
        key={editingCamera ? `camera-edit-${editingCamera.id}` : `camera-new-${cameraFormSession}`}
        isOpen={isCameraModalOpen}
        editingCamera={editingCamera}
        keepModalOpen={keepModalOpen}
        uploadingEntityId={uploadingEntityId}
        onKeepModalOpenChange={setKeepModalOpen}
        onClose={() => { setIsNewCameraModalOpen(false); closeGearEditModal(); }}
        onPreview={openAvatarPreview}
        onUpload={triggerAvatarUpload}
        onRemoveAvatar={(id, type, label) => { void handleRemoveAvatar(id, type, label); }}
      />

      <LensFormModal
        key={editingLens ? `lens-edit-${editingLens.id}` : `lens-new-${lensFormSession}`}
        isOpen={isLensModalOpen}
        editingLens={editingLens}
        keepModalOpen={keepModalOpen}
        uploadingEntityId={uploadingEntityId}
        onKeepModalOpenChange={setKeepModalOpen}
        onClose={() => { setIsNewLensModalOpen(false); closeGearEditModal(); }}
        onPreview={openAvatarPreview}
        onUpload={triggerAvatarUpload}
        onRemoveAvatar={(id, type, label) => { void handleRemoveAvatar(id, type, label); }}
      />

      <FilmStockFormModal
        key={editingFilmStock ? `film-edit-${editingFilmStock.id}` : `film-new-${filmFormSession}`}
        isOpen={isFilmModalOpen}
        editingFilmStock={editingFilmStock}
        filmStocks={filmStocks}
        keepModalOpen={keepModalOpen}
        uploadingEntityId={uploadingEntityId}
        onKeepModalOpenChange={setKeepModalOpen}
        onClose={() => { setIsNewFilmModalOpen(false); closeGearEditModal(); }}
        onPreview={openAvatarPreview}
        onUpload={triggerAvatarUpload}
        onRemoveAvatar={(id, type, label) => { void handleRemoveAvatar(id, type, label); }}
      />
      <OtherEquipmentFormModal
        key={editingEquipment ? `equipment-edit-${editingEquipment.id}` : `equipment-new-${equipmentFormSession}`}
        isOpen={isEquipmentModalOpen}
        editingEquipment={editingEquipment}
        equipment={otherEquipments}
        keepModalOpen={keepModalOpen}
        uploadingEntityId={uploadingEntityId}
        onKeepModalOpenChange={setKeepModalOpen}
        onClose={() => { setIsNewEquipmentModalOpen(false); closeGearEditModal(); }}
        onPreview={openAvatarPreview}
        onUpload={triggerAvatarUpload}
        onRemoveAvatar={(id, type, label) => { void handleRemoveAvatar(id, type, label); }}
      />

      <CameraHistoryDrawer
        isOpen={Boolean(viewingCameraId)}
        camera={viewingCamera}
        summary={viewingCameraSummary}
        cameraSystems={cameraSystems}
        filmBacks={filmBacks}
        language={language}
        t={t}
        onClose={closeCameraHistory}
        onEdit={camera => { closeCameraHistory(); openEditCamera(camera); }}
        onOpenRoll={openRollFromHistory}
        onOpenCollection={openCollectionFromHistory}
      />

      <FilmUsageDetailDrawer
        isOpen={Boolean(viewingFilmStockId)}
        summary={viewingFilmSummary}
        language={language}
        t={t}
        onClose={closeFilmHistory}
        onOpenRoll={openRollFromHistory}
        onOpenCollection={openCollectionFromHistory}
        onCreateRoll={openNewRollFromHistory}
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
