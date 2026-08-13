import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../db/schema';
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { useTrialGate } from '../../contexts/useTrialGate';
import { useLanguage } from '../../contexts/useLanguage';
import { uploadPhotoToCloud } from '../../services/storageService';
import { SyncService } from '../../services/syncService';
import { saveDeferredPhotoUpload } from '../../services/photoUploadRecoveryService';
import { Folder, Search, LayoutGrid, List, Trash2, Film, Plus, Camera, ArrowLeft, CheckCircle, X, Upload, Star, Sparkles, Package, Aperture } from 'lucide-react';
import { IconButton } from '../../components/ui/IconButton';
import { motion } from 'framer-motion';
import {
  ROLL_COVER_PREVIEW_MAX_EDGE,
  ROLL_COVER_PREVIEW_WEBP_QUALITY,
  compressImageToWebP,
} from '../../utils/imageService';
import './RollsView.css';
import { useCameraSystems, useCollections, useCameras, useFilmBacks, useFilmStocks, useRolls, usePhotoAssets, useLenses } from '../../hooks/useData';
import { usePhotoUrlMap } from '../../hooks/usePhotoUrlMap';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Drawer } from '../../components/Drawer';
import { Button } from '../../components/ui/Button';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCompatibleFilmBacks, getLoadedFilmBackIds, isInterchangeable120Camera } from '../../services/filmBackService';
import {
  getVisibleRollsTabOrder,
  readRollsCollectionsTabEnabled,
  ROLLS_LIBRARY_VIEW_KEY,
  ROLLS_COLLECTIONS_TAB_ENABLED_KEY,
  ROLLS_TAB_ORDER_KEY,
  WORKSPACE_PREFERENCES_CHANGED_EVENT,
  type RollsTabId,
} from '../../services/workspacePreferences';
import { useUserTier } from '../../hooks/useUserTier';
import { UpgradeModal } from '../../components/UpgradeModal';
import { canCreateActiveRoll } from '../../services/membershipPolicy';
import { requestImmediateSync } from '../../services/syncEvents';
import { adjustFilmStock, createRollWithInventory } from '../../services/inventoryOperationService';

import { CollectionsTab } from './CollectionsTab';
import type { CameraTransfer, Roll } from '../../db/schema';

interface RollsViewProps {
  enableFilmMode: boolean;
}

const ROLLS_VIEW_LAYOUT_KEY = 'grainfolio_rolls_view_layout';

const isViewLayout = (value: string | null): value is 'grid' | 'list' => {
  return value === 'grid' || value === 'list';
};

const getDefaultLibraryView = (
  savedView: string | null,
  visibleTabOrder: RollsTabId[],
  shouldOpenAllRolls: boolean
): RollsTabId => {
  if (shouldOpenAllRolls) return visibleTabOrder.includes('all') ? 'all' : visibleTabOrder[0];
  if (visibleTabOrder.includes(savedView as RollsTabId)) return savedView as RollsTabId;
  return visibleTabOrder.includes('all') ? 'all' : visibleTabOrder[0];
};

export const RollsView: React.FC<RollsViewProps> = ({ enableFilmMode }) => {
  const { user, authMode } = useAuth();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const { currencySymbol } = useCurrency();
  const { guardTrialResource, requireRegistration } = useTrialGate();
  const { t } = useLanguage();
  const location = useLocation();
  const { tier: userTier, isLoading: isUserTierLoading } = useUserTier();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const navigate = useNavigate();
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  
  // Live queries
  const cameras = useCameras();
  const cameraSystems = useCameraSystems();
  const filmBacks = useFilmBacks();
  const lenses = useLenses();
  const filmStocks = useFilmStocks();
  const rolls = useRolls();
  const photos = usePhotoAssets();

  const collections = useCollections();
  const photoUrlMap = usePhotoUrlMap(photos);
  const initialSearchParams = new URLSearchParams(location.search);
  const shouldOpenNewRoll = initialSearchParams.get('newRoll') === '1';
  const initialOpenRollId = initialSearchParams.get('openRoll');
  const initialVisibleTabOrder = getVisibleRollsTabOrder(enableFilmMode);
  const [visibleTabOrder, setVisibleTabOrder] = useState<RollsTabId[]>(initialVisibleTabOrder);
  const isCollectionsTabVisible = visibleTabOrder.includes('collections');

  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const activeCollection = useMemo(() => collections.find(c => c.id === activeCollectionId), [collections, activeCollectionId]);
  const [libraryView, setLibraryView] = useState<'collections' | 'all' | 'loose'>(() => {
    const saved = localStorage.getItem(ROLLS_LIBRARY_VIEW_KEY);
    return getDefaultLibraryView(saved, initialVisibleTabOrder, shouldOpenNewRoll || Boolean(initialOpenRollId));
  });

  
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

  const [selectedRollId, setSelectedRollId] = useState<string | null>(initialOpenRollId);
  const selectedRoll = useMemo(() => rolls.find(r => r.id === selectedRollId) || null, [rolls, selectedRollId]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(Boolean(initialOpenRollId));
  
  // Phase 3: All Rolls State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'camera'>('date');
  
  
  // Modals
  const [isNewRollModalOpen, setIsNewRollModalOpen] = useState(shouldOpenNewRoll);
  const [isAddExistingModalOpen, setIsAddExistingModalOpen] = useState(false);
  const [selectedExistingRollIds, setSelectedExistingRollIds] = useState<string[]>([]);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem(ROLLS_VIEW_LAYOUT_KEY);
    return isViewLayout(saved) ? saved : 'grid';
  });
  
  // Phase 2: View All States (Removed in favor of top-level tabs)
  const [keepModalOpen, setKeepModalOpen] = useState(false);
  const [quickAddCameraOpen, setQuickAddCameraOpen] = useState(false);
  const [quickAddFilmOpen, setQuickAddFilmOpen] = useState(false);
  const [isCameraTransferOpen, setIsCameraTransferOpen] = useState(false);
  const [transferCameraId, setTransferCameraId] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferNote, setTransferNote] = useState('');
  const [hasConfirmedCameraTransfer, setHasConfirmedCameraTransfer] = useState(false);

  // New Roll Form
  const [rollTitle, setRollTitle] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);
  const [selectedLensIds, setSelectedLensIds] = useState<string[]>([]);
  const [selectedFilmBackId, setSelectedFilmBackId] = useState<string>('');
  const [selectedFilmId, setSelectedFilmId] = useState<string>('');
  const [filmSearchText, setFilmSearchText] = useState<string>('');
  const [isFilmDropdownOpen, setIsFilmDropdownOpen] = useState(false);
  const [rollFilmPrice, setRollFilmPrice] = useState<number | ''>('');
  const [generateFilmExpense, setGenerateFilmExpense] = useState<boolean>(true);
  
  // Quick Add Form States
  const [qaCameraName, setQaCameraName] = useState('');
  const [qaFilmBrand, setQaFilmBrand] = useState('');
  const [qaFilmName, setQaFilmName] = useState('');
  const [qaFilmFormat, setQaFilmFormat] = useState<'135' | '120'>('135');

  // Metadata Form (Drawer)
  const [drawerRollTitle, setDrawerRollTitle] = useState('');
  const [rollLocation, setRollLocation] = useState('');
  const [rollNotes, setRollNotes] = useState('');
  const [developNotes, setDevelopNotes] = useState('');
  const [developPrice, setDevelopPrice] = useState<number | ''>('');
  const [nowTimestamp] = useState(Date.now);
  
  // Upload States
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const hydratedDrawerRollIdRef = useRef<string | null>(null);

  const visibleFilmStocks = filmStocks.filter(f => f.isSystem === 0);
  const selectedCameras = selectedCameraIds
    .map(id => cameras.find(camera => camera.id === id))
    .filter((camera): camera is NonNullable<typeof camera> => Boolean(camera));
  const suggestedQuickAddFilmFormat: '135' | '120' = selectedCameras.some(camera => camera.format === '120') ? '120' : '135';
  const selectedRequiresFilmBack = selectedCameras.some(isInterchangeable120Camera);
  const compatibleFilmBacks = getCompatibleFilmBacks(cameras, filmBacks, selectedCameraIds);
  const loadedFilmBackIds = getLoadedFilmBackIds(rolls);
  const fixed120Back = selectedCameras
    .filter(camera => camera.format === '120' && camera.backType !== 'interchangeable' && Boolean(camera.cameraSystemId))
    .map(camera => filmBacks.find(back => back.cameraSystemId === camera.cameraSystemId && back.status !== 'archived'))
    .find((back): back is NonNullable<typeof back> => Boolean(back));
  const effectiveFilmBackId = selectedRequiresFilmBack ? selectedFilmBackId : fixed120Back?.id;
  const currentRollCameraId = selectedRoll?.currentCameraId || selectedRoll?.cameraIds?.[0];
  const currentRollCamera = cameras.find(camera => camera.id === currentRollCameraId);
  const selectedRollFilmBack = filmBacks.find(back => back.id === selectedRoll?.filmBackId);
  const transferCandidateCameras = selectedRoll
    ? cameras.filter(camera => {
      if (!camera.id || camera.id === currentRollCameraId || camera.status === 'archived') return false;
      if (selectedRollFilmBack) return camera.cameraSystemId === selectedRollFilmBack.cameraSystemId;
      if (!currentRollCamera) return true;
      return camera.type === currentRollCamera.type && camera.format === currentRollCamera.format;
    })
    : [];

  const getFilmBackName = (id?: string) => {
    return filmBacks.find(back => back.id === id)?.name || t('common.notSelectedBack');
  };

  const getCameraSystemName = (id?: string) => {
    return cameraSystems.find(system => system.id === id)?.name || '未命名系统';
  };

  const openQuickAddFilm = () => {
    setQaFilmFormat(suggestedQuickAddFilmFormat);
    setQuickAddFilmOpen(true);
  };

  const getLensName = (id?: string) => {
    return lenses.find(lens => lens.id === id)?.name || t('common.unknownLens');
  };

  const openRollDrawer = (roll: Roll) => {
    setSelectedRollId(roll.id!);
    setDrawerRollTitle(roll.name || '');
    setRollLocation(roll.location || '');
    setRollNotes(roll.notes || '');
    setDevelopNotes(roll.developNotes || '');
    setDevelopPrice(roll.developPrice || '');
    setIsDrawerOpen(true);
  };

  const openCameraTransfer = () => {
    if (!selectedRoll || selectedRoll.status !== 'active' || !currentRollCameraId) return;
    setTransferCameraId('');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferNote('');
    setHasConfirmedCameraTransfer(false);
    setIsCameraTransferOpen(true);
  };

  const handleCameraTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRoll?.id || !currentRollCameraId || !transferCameraId || !hasConfirmedCameraTransfer) return;

    const changedAt = new Date(transferDate).getTime();
    const rollStartDate = selectedRoll.startDate
      ? new Date(selectedRoll.startDate).toISOString().slice(0, 10)
      : undefined;
    const latestTransferDate = new Date(nowTimestamp).toISOString().slice(0, 10);
    const isEligibleCamera = transferCandidateCameras.some(camera => camera.id === transferCameraId);
    const isInvalidDate = !Number.isFinite(changedAt)
      || (rollStartDate !== undefined && transferDate < rollStartDate)
      || transferDate > latestTransferDate;
    if (!isEligibleCamera || isInvalidDate) {
      notify({ type: 'error', title: t('rolls.cameraTransferInvalidTitle'), message: t('rolls.cameraTransferInvalidMessage') });
      return;
    }

    const transfers: CameraTransfer[] = [
      ...(selectedRoll.cameraTransfers || []),
      {
        fromCameraId: currentRollCameraId,
        toCameraId: transferCameraId,
        changedAt,
        note: transferNote.trim() || undefined,
      },
    ];
    const cameraIds = Array.from(new Set([
      ...(selectedRoll.cameraIds || []),
      currentRollCameraId,
      transferCameraId,
    ]));

    await db.rolls.update(selectedRoll.id, {
      currentCameraId: transferCameraId,
      cameraIds,
      cameraTransfers: transfers,
    });
    requestImmediateSync('roll-camera-transfer');
    setIsCameraTransferOpen(false);
    notify({ type: 'success', title: t('rolls.cameraTransferSavedTitle'), message: t('rolls.cameraTransferSavedMessage') });
  };

  useEffect(() => {
    if (!isDrawerOpen || !selectedRoll?.id || hydratedDrawerRollIdRef.current === selectedRoll.id) return;
    hydratedDrawerRollIdRef.current = selectedRoll.id;

    queueMicrotask(() => {
      setDrawerRollTitle(selectedRoll.name || '');
      setRollLocation(selectedRoll.location || '');
      setRollNotes(selectedRoll.notes || '');
      setDevelopNotes(selectedRoll.developNotes || '');
      setDevelopPrice(selectedRoll.developPrice || '');
    });
  }, [isDrawerOpen, selectedRoll]);

  useEffect(() => {
    localStorage.setItem(ROLLS_LIBRARY_VIEW_KEY, libraryView);
  }, [libraryView]);

  useEffect(() => {
    localStorage.setItem(ROLLS_VIEW_LAYOUT_KEY, viewLayout);
  }, [viewLayout]);

  useEffect(() => {
    if (!location.search) return;
    navigate('/rolls', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    const nextVisibleTabOrder = getVisibleRollsTabOrder(enableFilmMode);
    queueMicrotask(() => {
      setVisibleTabOrder(current => {
        if (
          current.length === nextVisibleTabOrder.length &&
          current.every((tab, index) => tab === nextVisibleTabOrder[index])
        ) {
          return current;
        }
        return nextVisibleTabOrder;
      });
    });
  }, [enableFilmMode]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== ROLLS_TAB_ORDER_KEY &&
        event.key !== ROLLS_COLLECTIONS_TAB_ENABLED_KEY
      ) {
        return;
      }

      const nextVisibleTabOrder = getVisibleRollsTabOrder(enableFilmMode);
      setVisibleTabOrder(nextVisibleTabOrder);
    };

    const handleWorkspacePreferencesChanged = () => {
      const nextVisibleTabOrder = getVisibleRollsTabOrder(enableFilmMode);
      setVisibleTabOrder(nextVisibleTabOrder);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(WORKSPACE_PREFERENCES_CHANGED_EVENT, handleWorkspacePreferencesChanged);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(WORKSPACE_PREFERENCES_CHANGED_EVENT, handleWorkspacePreferencesChanged);
    };
  }, [enableFilmMode]);

  useEffect(() => {
    const nextVisibleTabOrder = getVisibleRollsTabOrder(enableFilmMode);
    const collectionsVisible = !enableFilmMode || readRollsCollectionsTabEnabled();

    if (
      visibleTabOrder.length !== nextVisibleTabOrder.length ||
      visibleTabOrder.some((tab, index) => tab !== nextVisibleTabOrder[index])
    ) {
      queueMicrotask(() => setVisibleTabOrder(nextVisibleTabOrder));
      return;
    }

    if (!collectionsVisible && activeCollectionId) {
      queueMicrotask(() => setActiveCollectionId(null));
    }

    if (!nextVisibleTabOrder.includes(libraryView)) {
      queueMicrotask(() => setLibraryView(nextVisibleTabOrder[0]));
    }
  }, [activeCollectionId, enableFilmMode, libraryView, visibleTabOrder]);

  useEffect(() => {
    if (!selectedFilmBackId) return;
    if (!compatibleFilmBacks.some(back => back.id === selectedFilmBackId)) {
      queueMicrotask(() => setSelectedFilmBackId(''));
    }
  }, [compatibleFilmBacks, selectedFilmBackId]);


  const handleCreateRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollTitle || selectedCameraIds.length === 0 || (enableFilmMode && !filmSearchText.trim()) || !user) return;

    if (!guardTrialResource({ resource: 'rolls', currentCount: rolls.length })) {
      setIsNewRollModalOpen(false);
      return;
    }

    if (isUserTierLoading) {
      notify({
        type: 'error',
        title: t('rolls.readingTier'),
        message: t('rolls.createWaitMessage')
      });
      return;
    }

    const activeRollCount = rolls.filter(r => r.status === 'active').length;
    if (!canCreateActiveRoll(userTier, activeRollCount)) {
      setIsNewRollModalOpen(false);
      setIsUpgradeModalOpen(true);
      return;
    }

    if (selectedRequiresFilmBack && !selectedFilmBackId) {
      notify({
        type: 'error',
        title: t('rolls.chooseBackTitle'),
        message: t('rolls.chooseBackMessage')
      });
      return;
    }
    if (effectiveFilmBackId && loadedFilmBackIds.has(effectiveFilmBackId)) {
      notify({
        type: 'error',
        title: t('rolls.backLoadedTitle'),
        message: t('rolls.backLoadedMessage')
      });
      return;
    }

    let finalFilmId = selectedFilmId;
    
    // Auto-create film if it doesn't match existing
    if (enableFilmMode && filmSearchText.trim() !== '') {
        const matched = filmStocks.find(f => `${f.brand} ${f.name}`.toLowerCase() === filmSearchText.trim().toLowerCase());
        if (matched) {
            finalFilmId = matched.id!;
        } else {
            if (!guardTrialResource({ resource: 'filmStocks', currentCount: filmStocks.length })) {
              setIsNewRollModalOpen(false);
              return;
            }
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
                addedAt: nowTimestamp,
                userId: user?.id || 'offline'
            };
            await db.filmStocks.add(newFilm);
            finalFilmId = newFilm.id;
        }
    }

    const newRoll: Roll = {
      id: crypto.randomUUID(),
      name: rollTitle,
      currentCameraId: selectedCameraIds[0],
      cameraIds: selectedCameraIds,
      lensIds: selectedLensIds,
      filmBackId: effectiveFilmBackId,
      filmStockId: enableFilmMode ? finalFilmId : 'digital-placeholder',
      collectionId: selectedCollectionId || undefined,
      status: 'active',
      startDate: nowTimestamp,
      filmPrice: rollFilmPrice ? Number(rollFilmPrice) : undefined,
      userId: user?.id || 'offline'
    };

    const film = enableFilmMode && finalFilmId ? await db.filmStocks.get(finalFilmId) : undefined;
    const expenseCost = generateFilmExpense && film
      ? (rollFilmPrice ? Number(rollFilmPrice) : (film.pricePerRoll || 0))
      : 0;
    const ledger = expenseCost > 0 ? {
      id: crypto.randomUUID(),
      userId: newRoll.userId,
      amount: -expenseCost,
      date: nowTimestamp,
      type: 'expense' as const,
      category: 'film' as const,
      relatedEntityId: newRoll.id,
      notes: t('rolls.consumeFilmLedgerNote', { film: `${film?.brand} ${film?.name}` }),
      addedAt: nowTimestamp
    } : undefined;

    await createRollWithInventory({ roll: newRoll, ledger });

    if (!keepModalOpen) {
      setIsNewRollModalOpen(false);
      setRollTitle('');
      setSelectedCameraIds([]);
      setSelectedLensIds([]);
      setSelectedFilmBackId('');
      setSelectedFilmId('');
      setFilmSearchText('');
      setRollFilmPrice('');
      setSelectedCollectionId('');
    } else {
      setRollTitle('');
      setSelectedLensIds([]);
      setSelectedFilmBackId('');
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
    requestImmediateSync('rolls-add-to-collection');
    
    setIsAddExistingModalOpen(false);
    setSelectedExistingRollIds([]);
  };

  const handleQuickAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaCameraName.trim()) return;
    
    const existing = cameras.find(camera => camera.name === qaCameraName.trim());
    if (existing && existing.id) {
      setSelectedCameraIds([existing.id]);
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
      requestImmediateSync('roll-quick-add-camera');
      setSelectedCameraIds([newId]);
    }
    setQaCameraName('');
    setQuickAddCameraOpen(false);
  };

  const handleQuickAddFilm = async (e: React.FormEvent) => {
    e.preventDefault();
    const brand = qaFilmBrand.trim();
    const name = qaFilmName.trim();
    if (!brand || !name) return;

    const existing = filmStocks.find(film => film.brand === brand && film.name === name && film.format === qaFilmFormat);
    const filmLabel = `${brand} ${name}`;
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
        format: qaFilmFormat,
        stockCount: 0,
        isSystem: 0,
        addedAt: Date.now()
      });
      await adjustFilmStock({ id: newId, userId: user?.id || 'offline' }, 1);
      setSelectedFilmId(newId);
    }
    setFilmSearchText(filmLabel);
    setQaFilmBrand('');
    setQaFilmName('');
    setQaFilmFormat('135');
    setQuickAddFilmOpen(false);
  };

  const handleArchiveRoll = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: t('rolls.completeRollTitle'),
      message: t('rolls.completeRollMessage'),
      confirmText: t('rolls.confirmComplete')
    });
    if (confirmed) {
      await db.rolls.update(id, { status: 'archived', endDate: Date.now() });
      requestImmediateSync('roll-archive');
    }
  };

  const handleDeleteRoll = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: t('rolls.deleteTitle'),
      message: t('rolls.deleteRollMessage'),
      confirmText: t('rolls.confirmDeletePermanent'),
      isDanger: true
    });
    if (confirmed) {
      await db.rolls.delete(id);
      requestImmediateSync('roll-delete');
      
      if (selectedRollId === id) {
        setIsDrawerOpen(false);
        setSelectedRollId(null);
      }
    }
  };

  const handleRemoveFromCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: t('rolls.removeFromCollectionTitle'),
      message: t('rolls.removeFromCollectionMessage'),
      confirmText: t('rolls.removeFromCollection')
    });
    if (confirmed) {
      await db.rolls.update(id, { collectionId: undefined });
      requestImmediateSync('roll-remove-from-collection');
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedRollId) return;
    
    await db.transaction('rw', db.rolls, db.ledgerTransactions, async () => {
        await db.rolls.update(selectedRollId, {
          name: drawerRollTitle.trim() || selectedRoll?.name || t('rolls.unknownRoll'),
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
              notes: t('rolls.developLedgerNote', { name: drawerRollTitle.trim() || selectedRoll?.name || t('rolls.unknownRoll') }),
              addedAt: Date.now()
            });
          }
        } else if (existingTx && existingTx.id) {
          await db.ledgerTransactions.delete(existingTx.id);
        }
    });
    requestImmediateSync('roll-details-save');
    notify({
      type: 'success',
      title: t('rolls.detailsSaved')
    });
    setIsDrawerOpen(false);
  };

  const handleSetRating = async (rating: number) => {
    if (!selectedRollId) return;
    await db.rolls.update(selectedRollId, { rating });
  };
  
  const handleCoverUpload = async (file: File) => {
    if (!selectedRollId) return;
    if (authMode === 'trial') {
      requireRegistration('photos');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
        const webpFile = await compressImageToWebP(
          file,
          ROLL_COVER_PREVIEW_MAX_EDGE,
          ROLL_COVER_PREVIEW_WEBP_QUALITY
        );
        const photoId = crypto.randomUUID();
        const currentUserId = user?.id || 'offline';
        
        let uploadResult = null;
        const cloudUploadPending = Boolean(user && SyncService.isAutoSyncEnabled());
        let isDeferredCloudUpload = false;
        if (user) {
          try {
            uploadResult = await uploadPhotoToCloud(webpFile, user.id, selectedRollId, (pct) => setUploadProgress(pct));
          } catch (err) {
            isDeferredCloudUpload = cloudUploadPending;
            if (isDeferredCloudUpload) {
              console.error('Cloud upload failed; keeping the cover local until it can be retried.', err);
              notify({
                type: 'error',
                title: t('rolls.coverUploadFailedTitle'),
                message: t('rolls.coverUploadDeferredMessage'),
              });
            }
          }
        }

        const photoAsset = {
          id: photoId,
          userId: currentUserId,
          rollId: selectedRollId,
          originalFileName: file.name,
          fileSize: webpFile.size,
          blob: uploadResult ? undefined : webpFile,
          cloudUploadPending: isDeferredCloudUpload,
          cloudUploadError: isDeferredCloudUpload ? t('rolls.coverUploadDeferredMessage') : undefined,
          storageKey: uploadResult?.storageKey,
          previewUrl: uploadResult?.previewUrl,
          thumbnailUrl: uploadResult?.thumbnailUrl,
          addedAt: Date.now(),
          isPinned: 1,
          orderIndex: 0
        };

        if (isDeferredCloudUpload) {
          await saveDeferredPhotoUpload(photoAsset);
        } else {
          await db.transaction('rw', db.photoAssets, db.rolls, async () => {
            await db.photoAssets.add(photoAsset);
            await db.rolls.update(selectedRollId, { coverPhotoId: photoId });
          });
        }

        if (uploadResult) {
          await db.transaction('rw', db.photoAssets, async () => {
            // Do not remove the previous cloud cover until the replacement uploaded.
            if (selectedRoll?.coverPhotoId) {
              const oldPhotos = await db.photoAssets.where('rollId').equals(selectedRollId).toArray();
              for (const p of oldPhotos) {
                if (p.id !== photoId && p.id) await db.photoAssets.delete(p.id);
              }
            }
          });
          requestImmediateSync('roll-cover-upload');
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

  const getCameraName = (id: string) => cameras.find(c => c.id === id)?.name || t('common.unknownCamera');
  const getFilmName = (id: string) => {
    const f = filmStocks.find(fs => fs.id === id);
    return f ? `${f.brand} ${f.name}` : t('common.unknownFilm');
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
        
        const currentCameraId = r.currentCameraId || r.cameraIds?.[0];
        const currentCamera = cameras.find(camera => camera.id === currentCameraId);
        const cameraMatch = Boolean(currentCamera && (
          currentCamera.name.toLowerCase().includes(q) || currentCamera.brand.toLowerCase().includes(q)
        ));
        
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
        const aCameraId = a.currentCameraId || a.cameraIds?.[0];
        const bCameraId = b.currentCameraId || b.cameraIds?.[0];
        const aCam = aCameraId ? cameras.find(c => c.id === aCameraId)?.name || '' : '';
        const bCam = bCameraId ? cameras.find(c => c.id === bCameraId)?.name || '' : '';
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
    const collectionActionId = viewLayout === 'list' ? undefined : (libraryView === 'collections' ? activeCollectionId : undefined);

    const filmStock = enableFilmMode ? filmStocks.find(f => f.id === roll.filmStockId) : undefined;
    const placeholderStyle: React.CSSProperties = {
      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(99, 102, 241, 0.15) 100%)'
    };
    if (!coverUrl && filmStock?.brand) {
      const brand = filmStock.brand.toLowerCase();
      if (brand.includes('kodak')) {
        placeholderStyle.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.25) 100%)';
      } else if (brand.includes('fuji')) {
        placeholderStyle.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)';
      } else if (brand.includes('ilford') || filmStock.colorType === 'bw') {
        placeholderStyle.background = 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(75, 85, 99, 0.25) 100%)';
      } else if (brand.includes('cinestill')) {
        placeholderStyle.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.25) 100%)';
      }
    }
    
    if (viewLayout === 'list') {
      return (
        <div 
          key={roll.id} 
          className="roll-card-row"
          onClick={() => openRollDrawer(roll)}
        >
          <button type="button" className="record-card-open-action" onClick={(event) => { event.stopPropagation(); openRollDrawer(roll); }} aria-label={t('rolls.openDetails', { name: roll.name })} />
          <div className="roll-card-row-thumb-wrapper">
            {coverUrl ? (
              <div className="roll-card-row-thumb" style={{ backgroundImage: `url(${coverUrl})` }} />
            ) : (
              <div className="roll-card-row-thumb roll-card-placeholder" style={placeholderStyle}><Film size={28} /></div>
            )}
            
            <div className="roll-card-status" style={{ top: 4, left: 4 }}>
              {roll.status === 'active' 
                ? <span className="status-badge active">{t('rolls.active')}</span>
                : <span className="status-badge archived">{t('rolls.archived')}</span>}
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
              {getCameraName(roll.currentCameraId || roll.cameraIds?.[0])}
            </p>
            {roll.filmBackId && (
              <p className="roll-card-meta">
                <Package size={12} style={{ flexShrink: 0 }} /> {getFilmBackName(roll.filmBackId)}
              </p>
            )}
            {(roll.lensIds || []).length > 0 && (
              <p className="roll-card-meta">
                <Aperture size={12} style={{ flexShrink: 0 }} /> {(roll.lensIds || []).map(getLensName).join(', ')}
              </p>
            )}
            {enableFilmMode && roll.filmStockId && roll.filmStockId !== 'digital-placeholder' && (
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
            {collectionActionId && roll.collectionId === collectionActionId && (
              <button className="action-btn" onClick={(e) => handleRemoveFromCollection(roll.id!, e)} title={t('rolls.removeFromCollectionTitle')} aria-label={t('rolls.removeFromCollectionTitle')}>
                <Folder size={12} /> <span>{t('rolls.removeFromCollection')}</span>
              </button>
            )}
            {roll.status === 'active' && (
              <button className="action-btn success" onClick={(e) => handleArchiveRoll(roll.id!, e)} title={t('rolls.completeTitle')} aria-label={t('rolls.completeTitle')}>
                <CheckCircle size={14} /> <span>{t('rolls.complete')}</span>
              </button>
            )}
            <button className="action-btn danger" onClick={(e) => handleDeleteRoll(roll.id!, e)} title={t('rolls.deleteTitle')} aria-label={t('rolls.deleteTitle')}>
              <Trash2 size={14} /> <span>{t('rolls.delete')}</span>
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
        <button type="button" className="record-card-open-action" onClick={(event) => { event.stopPropagation(); openRollDrawer(roll); }} aria-label={t('rolls.openDetails', { name: roll.name })} />
        {/* Image Zone */}
        <div 
          className="roll-card-cover" 
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : placeholderStyle}
        >
          {!coverUrl && <div className="roll-card-placeholder"><Film size={28} /></div>}
          
          <div className="roll-card-status">
            {roll.status === 'active' 
              ? <span className="status-badge active">{t('rolls.active')}</span>
              : <span className="status-badge archived">{t('rolls.archived')}</span>}
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
            {getCameraName(roll.currentCameraId || roll.cameraIds?.[0])}
          </p>
          {roll.filmBackId && (
            <p className="roll-card-meta">
              <Package size={12} style={{ flexShrink: 0 }} /> {getFilmBackName(roll.filmBackId)}
            </p>
          )}
          {(roll.lensIds || []).length > 0 && (
            <p className="roll-card-meta">
              <Aperture size={12} style={{ flexShrink: 0 }} /> {(roll.lensIds || []).map(getLensName).join(', ')}
            </p>
          )}
          {enableFilmMode && roll.filmStockId && roll.filmStockId !== 'digital-placeholder' && (
            <p className="roll-card-meta">
              <Film size={12} style={{ flexShrink: 0 }} />
              {getFilmName(roll.filmStockId)}
            </p>
          )}
          <div className="roll-card-footer">
            <span className="roll-date">
              {t('rolls.startDate', { date: new Date(roll.startDate || nowTimestamp).toLocaleDateString() })}
              {roll.endDate && t('rolls.endDate', { date: new Date(roll.endDate).toLocaleDateString() })}
            </span>
          </div>
          
          <div className="roll-card-actions">
            {activeCollectionId && roll.collectionId === activeCollectionId && (
              <button className="action-btn" onClick={(e) => handleRemoveFromCollection(roll.id!, e)} title={t('rolls.removeFromCollectionTitle')} aria-label={t('rolls.removeFromCollectionTitle')}>
                <Folder size={12} /> <span>{t('rolls.removeFromCollection')}</span>
              </button>
            )}
            {roll.status === 'active' && (
              <button className="action-btn success" onClick={(e) => handleArchiveRoll(roll.id!, e)} title={t('rolls.completeTitle')} aria-label={t('rolls.completeTitle')}>
                <CheckCircle size={14} /> <span>{t('rolls.complete')}</span>
              </button>
            )}
            <button className="action-btn danger" onClick={(e) => handleDeleteRoll(roll.id!, e)} title={t('rolls.deleteTitle')} aria-label={t('rolls.deleteTitle')}>
              <Trash2 size={14} /> <span>{t('rolls.delete')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };


  const renderedRollCards = processedRolls.map(renderRollCard);
  const renderNewRollEmptyAction = () => (
    <Button
      variant="primary"
      icon={<Plus size={16} />}
      onClick={() => setIsNewRollModalOpen(true)}
    >
      {t('rolls.newRoll')}
    </Button>
  );

  return (
    <div className="main-content rolls-main-content">
      <header className="view-header">
        <div className="view-header-title-container">
          <motion.div key={libraryView} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="rolls-view-header-title">
            <div className="view-header-icon">
              {libraryView === 'collections' ? <Folder size={20} /> : libraryView === 'loose' ? <LayoutGrid size={20} /> : <Film size={20} />}
            </div>
            <div className="view-header-text-group">
              <h1>
                {libraryView === 'collections' ? t('rolls.collections') : libraryView === 'loose' ? t('rolls.loose') : t('rolls.all')}
              </h1>
              <p className="view-header-subtitle">
                {libraryView === 'collections' ? t('rolls.collectionsSubtitle') : libraryView === 'loose' ? t('rolls.looseSubtitle') : t('rolls.allSubtitle')}
              </p>
            </div>
          </motion.div>
        </div>
        
        <div className="view-header-actions rolls-view-header-actions">
           <div className="view-toggle-group">
	             <button
               className={`view-toggle-btn ${viewLayout === 'grid' ? 'active' : ''}`}
               type="button"
               onClick={() => setViewLayout('grid')}
               title={t('rolls.gridView')}
               aria-label={t('rolls.gridView')}
               aria-pressed={viewLayout === 'grid'}
             >
               <LayoutGrid size={16} />
             </button>
	             <button
               className={`view-toggle-btn ${viewLayout === 'list' ? 'active' : ''}`}
               type="button"
               onClick={() => setViewLayout('list')}
               title={t('rolls.listView')}
               aria-label={t('rolls.listView')}
               aria-pressed={viewLayout === 'list'}
             >
               <List size={16} />
             </button>
           </div>
           
           {isCollectionsTabVisible && (
             <button className="secondary" onClick={() => document.dispatchEvent(new CustomEvent('open-new-collection-modal'))}>
               <Folder size={16} /> {t('rolls.newCollection')}
             </button>
           )}
           <button className="primary" onClick={() => setIsNewRollModalOpen(true)}>
             <Plus size={16} /> {t('rolls.newRoll')}
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
            className="collection-details-view rolls-collection-details"
          >
            <div className="rolls-collection-heading">
              <IconButton variant="solid" onClick={() => setActiveCollectionId(null)} icon={<ArrowLeft size={20} />} />
              <div>
                <h2>{activeCollection?.name || t('common.loading')}</h2>
                <p>
                  {activeCollection?.description || ''} · {activeCollection?.date ? new Date(activeCollection.date).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
            
            <div className="rolls-collection-actions-row">
              <h3>{t('rolls.all')} ({rolls.filter(r => r.collectionId === activeCollectionId).length})</h3>
              <div className="rolls-collection-actions">
                <button className="secondary" onClick={() => {
                  setSelectedExistingRollIds([]);
                  setIsAddExistingModalOpen(true);
                }}>
                  <Folder size={16} /> {t('rolls.addExistingTitle')}
                </button>
                <button className="primary" onClick={() => { 
                  setSelectedCollectionId(activeCollectionId);
                  setIsNewRollModalOpen(true); 
                }}>
                  <Plus size={16} /> {t('rolls.newRoll')}
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
                   <div className="rolls-empty-grid-item">
                      <EmptyState icon={Film} title={t('rolls.noRolls')} description={t('rolls.noRollsDesc')} />
                   </div>
                ) : (
                  rolls.filter(r => r.collectionId === activeCollectionId).map(renderRollCard)
                )}
              </motion.div>
            
          </motion.div>

        ) : (
          <motion.div 
            key="library-view"
            className="unified-rolls-view rolls-library-content"
          >
            {/* TOP LEVEL LIBRARY TABS & SEARCH */}
            <div className="rolls-toolbar">
              
              <div className="rolls-tab-navigation rolls-tabs">
                {visibleTabOrder.map(tab => (
                  <button
                    key={tab}
                    className={`rolls-tab-btn ${libraryView === tab ? 'active' : ''}`}
                    onClick={() => setLibraryView(tab)}
                  >
                    {tab === 'collections' ? t('rolls.collections') : tab === 'all' ? t('rolls.all') : t('rolls.loose')}
                  </button>
                ))}
              </div>
              
              <div className="rolls-toolbar-actions">
                  <div 
                    className="search-bar search-input-wrapper rolls-search-input"
                  >
                    <Search size={16} className="rolls-search-icon" />
	                    <input
	                      type="text"
	                      placeholder={t('rolls.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value.trim() !== '' && libraryView === 'collections') {
                          setLibraryView('all');
                        }
                      }}
	                      className="rolls-search-field"
                    />
                  </div>
                  
                  <div ref={sortRef} className="rolls-sort-menu">
	                    <button
	                      className="secondary btn-sm sort-trigger-btn"
                      type="button"
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      aria-expanded={isSortOpen}
                      aria-controls="rolls-sort-options"
                    >
                      {sortBy === 'date' ? t('rolls.sortDate') : sortBy === 'camera' ? t('rolls.sortCamera') : t('rolls.sortName')}
                      <svg className="rolls-sort-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    {isSortOpen && (
                      <div id="rolls-sort-options" className="rolls-sort-options" role="menu">
                        <button type="button" role="menuitemradio" aria-checked={sortBy === 'date'} className={`rolls-sort-option ${sortBy === 'date' ? 'is-selected' : ''}`} onClick={() => { setSortBy('date'); setIsSortOpen(false); }}>{t('rolls.sortDate')}</button>
                        <button type="button" role="menuitemradio" aria-checked={sortBy === 'name'} className={`rolls-sort-option ${sortBy === 'name' ? 'is-selected' : ''}`} onClick={() => { setSortBy('name'); setIsSortOpen(false); }}>{t('rolls.sortName')}</button>
                      </div>
                    )}
                  </div>
              </div>

            </div>

            {/* CONTENT AREA */}
              {isCollectionsTabVisible && libraryView === 'collections' && (
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
                    onCreateRoll={() => setIsNewRollModalOpen(true)}
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
                          <EmptyState
                            icon={Film}
                            title={t('rolls.noRolls')}
                            description={t('rolls.noRollsDesc')}
                            action={renderNewRollEmptyAction()}
                          />
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
                          <EmptyState
                            icon={Film}
                            title={t('rolls.noRolls')}
                            description={t('rolls.noRollsDesc')}
                            action={renderNewRollEmptyAction()}
                          />
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
            <div className="drawer-header roll-drawer-header">
              <h2>{selectedRoll.name}</h2>
              <div className="roll-drawer-header-actions">
               {selectedRoll.status === 'active' && (
                <button className="outline-btn roll-drawer-complete-action" onClick={(e) => { handleArchiveRoll(selectedRoll.id!, e); setIsDrawerOpen(false); }}>
                  {t('rolls.markCompleted')}
                </button>
              )}
              <button className="icon-btn danger" onClick={(e) => { handleDeleteRoll(selectedRoll.id!, e); setIsDrawerOpen(false); }} aria-label={t('rolls.deleteTitle')} title={t('rolls.deleteTitle')}>
                <Trash2 size={18} />
              </button>
              <button className="icon-btn" onClick={() => setIsDrawerOpen(false)} aria-label={t('common.cancel')} title={t('common.cancel')}>
                <X size={20} />
              </button>
            </div>
            </div>
            
            <div className="drawer-content roll-drawer-content">
              {/* Cover Upload Section */}
              <div className="drawer-section roll-drawer-section roll-drawer-cover-section">
                <h3>{t('rolls.coverPhoto')}</h3>
                <div className="roll-cover-editor">
                  <div className="cover-upload-container">
                    <div className={`dropzone roll-cover-dropzone ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
                         onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragOver(true); }}
                         onDragLeave={() => setIsDragOver(false)}
                         onDrop={isUploading ? undefined : handleDrop}
                    >
                      {getCoverUrl(selectedRoll) && !isUploading ? (
                        <div className="cover-preview" style={{ backgroundImage: `url(${getCoverUrl(selectedRoll)})` }} />
                      ) : isUploading ? (
                        <div className="roll-cover-uploading">
                          <span>{uploadProgress}%</span>
                          <div className="roll-cover-progress-track">
                            <div className="roll-cover-progress-value" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <div className="cover-upload-placeholder">
                          <Upload size={22} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="roll-cover-editor-content">
                    <p>{getCoverUrl(selectedRoll) ? t('rolls.coverCustom') : t('rolls.uploadCoverHint')}</p>
                    <button
                      type="button"
                      className="secondary roll-cover-action"
                      onClick={() => coverFileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading
                        ? t('rolls.uploadingCover')
                        : getCoverUrl(selectedRoll)
                          ? t('rolls.changeCover')
                          : t('rolls.uploadCover')}
                    </button>
                    <input ref={coverFileInputRef} type="file" accept="image/*" onChange={handleFileSelect} disabled={isUploading} hidden />
                  </div>
                </div>
              </div>
              
              <div className="drawer-section roll-drawer-section roll-drawer-gear-section">
                <h3>{t('rolls.gearAndFilm')}</h3>
                <div className="form-group roll-drawer-choice-field">
                  <label className="roll-drawer-field-label">{t('rolls.currentCamera')}</label>
                  <p className="roll-drawer-current-value">{currentRollCamera?.name || t('rolls.unboundCamera')}</p>
                  
                  <label className="roll-drawer-field-label">{t('rolls.lensMultiOptional')}</label>
                  <div className="roll-drawer-chip-list">
                    {lenses.length === 0 ? (
                      <div className="roll-form-hint">{t('rolls.noLensHint')}</div>
                    ) : (
                      lenses.map(lens => {
                        const isSelected = (selectedRoll.lensIds || []).includes(lens.id!);
                        return (
                          <button
                            key={lens.id}
                            type="button"
                            onClick={async () => {
                              let newIds = [...(selectedRoll.lensIds || [])];
                              if (isSelected) newIds = newIds.filter(id => id !== lens.id);
                              else newIds.push(lens.id!);
                              await db.rolls.update(selectedRoll.id!, { lensIds: newIds });
                            }}
                            className={`roll-drawer-chip ${isSelected ? 'is-selected' : ''}`}
                            aria-pressed={isSelected}
                          >{lens.name}</button>
                        );
                      })
                    )}
                  </div>

                  {selectedRoll.filmBackId && (
                    <div className="roll-form-hint roll-drawer-inline-hint">
                      {t('rolls.currentBack', { name: getFilmBackName(selectedRoll.filmBackId) })}
                    </div>
                  )}

                  {enableFilmMode && (
                    <>
                      <label className="roll-drawer-field-label">{t('rolls.filmStock')}</label>
                      <div className="roll-drawer-chip-list">
                        {visibleFilmStocks.map(f => {
                          const isSelected = selectedRoll.filmStockId === f.id;
                          return (
                            <button key={f.id} type="button"
                              onClick={async () => {
                                if (isSelected) return; // Must have 1 film
                                await db.rolls.update(selectedRoll.id!, { filmStockId: f.id });
                              }}
                              className={`roll-drawer-chip ${isSelected ? 'is-selected' : ''}`}
                              aria-pressed={isSelected}
                            >{f.brand} {f.name}</button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="drawer-section roll-drawer-section roll-drawer-advanced-section">
                <h3>{t('rolls.advanced')}</h3>
                <p className="roll-form-hint">{t('rolls.cameraTransferHint')}</p>
                {selectedRoll.status === 'active' ? (
                  <button type="button" className="secondary" onClick={openCameraTransfer} disabled={!currentRollCameraId}>
                    <Camera size={16} /> {t('rolls.changeCamera')}
                  </button>
                ) : (
                  <p className="roll-form-hint">{t('rolls.cameraTransferArchivedHint')}</p>
                )}
                {(selectedRoll.cameraTransfers || []).length > 0 && (
                  <ol className="roll-camera-transfer-history" aria-label={t('rolls.cameraTransferHistory')}>
                    {(selectedRoll.cameraTransfers || []).map((transfer: CameraTransfer, index: number) => (
                      <li key={`${transfer.changedAt}-${transfer.toCameraId}-${index}`}>
                        <strong>{getCameraName(transfer.fromCameraId)} → {getCameraName(transfer.toCameraId)}</strong>
                        <span>{new Date(transfer.changedAt).toLocaleDateString()}</span>
                        {transfer.note && <p>{transfer.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="drawer-section roll-drawer-section roll-drawer-shooting-section">
                <h3>{t('rolls.shootingInfo')}</h3>
                
                <div className="roll-drawer-name-row">
                  <div className="form-group">
                    <label>{t('rolls.rollName')}</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('rolls.rollNamePlaceholder')}
                      value={drawerRollTitle}
                      onChange={e => setDrawerRollTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="roll-drawer-date-row">
                  <div className="form-group">
                    <label>{t('rolls.startDateLabel')}</label>
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
                    <div className="form-group">
                      <label>{t('rolls.completedDateLabel')}</label>
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
                  <label>{t('rolls.collectionLabel')}</label>
                  <select 
                    className="form-control"
                    value={selectedRoll?.collectionId || ''} 
                    onChange={async (e) => {
                      if (selectedRoll.id) {
                        await db.rolls.update(selectedRoll.id, { collectionId: e.target.value || undefined });
                      }
                    }}
                  >
                    <option value="">{t('rolls.uncategorized')}</option>
                    {collections && collections.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>{t('rolls.locationLabel')}</label>
                  <input type="text" className="form-control" placeholder={t('rolls.locationPlaceholder')} value={rollLocation} onChange={e => setRollLocation(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label>{t('rolls.ratingLabel')}</label>
                  <div className="star-rating">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} size={20} fill={(selectedRoll.rating || 0) >= star ? 'var(--accent)' : 'none'} color={(selectedRoll.rating || 0) >= star ? 'var(--accent)' : 'var(--text-muted)'} onClick={() => handleSetRating(star)} style={{ cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>{t('rolls.notesLabel')}</label>
                  <textarea className="form-control" rows={3} placeholder={t('rolls.notesPlaceholder')} value={rollNotes} onChange={e => setRollNotes(e.target.value)} />
                </div>
              </div>
              
              <div className="drawer-section roll-drawer-section roll-drawer-lab-section">
                <h3>{t('rolls.labRecord')}</h3>
                <div className="form-group">
                  <label>{t('rolls.developmentCost', { symbol: currencySymbol })}</label>
                  <input type="number" className="form-control" placeholder={t('rolls.developmentCostPlaceholder')} value={developPrice} onChange={e => setDevelopPrice(e.target.value ? Number(e.target.value) : '')} />
                </div>
                <div className="form-group">
                  <label>{t('rolls.labNotes')}</label>
                  <textarea className="form-control roll-drawer-lab-notes" rows={4} placeholder={t('rolls.labNotesPlaceholder')} value={developNotes} onChange={e => setDevelopNotes(e.target.value)} />
                </div>
              </div>
            </div>
            
            <div className="drawer-footer roll-drawer-footer">
              <button className="primary full-width" onClick={handleSaveDetails}>
                {t('rolls.saveAllChanges')}
              </button>
            </div>
          </>
        )}
      </Drawer>

      <Modal isOpen={isCameraTransferOpen} onClose={() => setIsCameraTransferOpen(false)} style={{ maxWidth: '460px' }}>
        <h3>{t('rolls.changeCameraTitle')}</h3>
        <p className="modal-helper-text">{t('rolls.changeCameraDescription', { camera: currentRollCamera?.name || t('rolls.unboundCamera') })}</p>
        <form onSubmit={handleCameraTransfer} className="roll-camera-transfer-form">
          <div className="form-group">
            <label htmlFor="transfer-camera">{t('rolls.newCamera')}</label>
            <select id="transfer-camera" className="form-control" value={transferCameraId} onChange={event => setTransferCameraId(event.target.value)} required>
              <option value="">{t('rolls.selectCamera')}</option>
              {transferCandidateCameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
            </select>
            {transferCandidateCameras.length === 0 && <p className="roll-form-hint">{t('rolls.noCompatibleTransferCamera')}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="transfer-date">{t('rolls.cameraTransferDate')}</label>
            <input
              id="transfer-date"
              type="date"
              className="form-control"
              value={transferDate}
              min={selectedRoll?.startDate ? new Date(selectedRoll.startDate).toISOString().slice(0, 10) : undefined}
              max={new Date(nowTimestamp).toISOString().slice(0, 10)}
              onChange={event => setTransferDate(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="transfer-note">{t('rolls.cameraTransferNote')}</label>
            <textarea id="transfer-note" className="form-control" rows={3} value={transferNote} onChange={event => setTransferNote(event.target.value)} placeholder={t('rolls.cameraTransferNotePlaceholder')} />
          </div>
          <label className="roll-camera-transfer-confirmation">
            <input type="checkbox" checked={hasConfirmedCameraTransfer} onChange={event => setHasConfirmedCameraTransfer(event.target.checked)} />
            <span>{t('rolls.cameraTransferConfirmation')}</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setIsCameraTransferOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="primary" disabled={!transferCameraId || !hasConfirmedCameraTransfer}>{t('rolls.confirmCameraTransfer')}</button>
          </div>
        </form>
      </Modal>

      {/* --- NEW ROLL MODAL --- */}
      <Modal
        isOpen={isNewRollModalOpen}
        onClose={() => setIsNewRollModalOpen(false)}
        style={{ maxWidth: '600px', maxHeight: 'calc(100dvh - 40px)' }}
      >
            <h3>{t('rolls.newRollModalTitle')}</h3>
            <form className="new-roll-form" onSubmit={handleCreateRoll}>
              <div className="form-group new-roll-intro-section">
                <label>{t('rolls.rollName')}</label>
                <input type="text" className="form-control" placeholder={t('rolls.rollNamePlaceholder')} value={rollTitle} onChange={e => setRollTitle(e.target.value)} required />
              </div>

              <div className="new-roll-section new-roll-field-grid new-roll-field-grid--equipment">
                <div className="form-group">
                  <div className="new-roll-field-heading">
                    <label>{t('rolls.cameraRequired')}</label>
                    <button type="button" className="text-btn" onClick={() => setQuickAddCameraOpen(true)}>{t('rolls.quickAddCamera')}</button>
                  </div>
                  <div className="new-roll-option-list">
                    {cameras.map(c => {
                      const isSelected = selectedCameraIds.includes(c.id!);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCameraIds([c.id!]);
                          }}
                          className={`new-roll-option-chip ${isSelected ? 'is-selected' : ''}`}
                          aria-pressed={isSelected}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('rolls.lensOptional')}</label>
                  <div className="new-roll-option-list">
                    {lenses.length === 0 ? (
                      <div className="roll-form-hint">{t('rolls.noLensHint')}</div>
                    ) : (
                      lenses.map(lens => {
                        const isSelected = selectedLensIds.includes(lens.id!);
                        return (
                          <button
                            key={lens.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) setSelectedLensIds(prev => prev.filter(id => id !== lens.id));
                              else setSelectedLensIds(prev => [...prev, lens.id!]);
                            }}
                            className={`new-roll-option-chip ${isSelected ? 'is-selected' : ''}`}
                            aria-pressed={isSelected}
                          >
                            {lens.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {selectedRequiresFilmBack && (
                <div className="form-group new-roll-section">
                  <label>{t('rolls.filmBackRequired')}</label>
                  <div className="film-back-picker">
                    {compatibleFilmBacks.length === 0 ? (
                      <div className="roll-form-hint">
                        {t('rolls.noFilmBackHint')}
                      </div>
                    ) : (
                      compatibleFilmBacks.map(back => {
                        const isLoaded = loadedFilmBackIds.has(back.id!);
                        const isSelected = selectedFilmBackId === back.id;
                        return (
                          <button
                            key={back.id}
                            type="button"
                            className={`film-back-option ${isSelected ? 'active' : ''}`}
                            disabled={isLoaded}
                            onClick={() => setSelectedFilmBackId(back.id!)}
                          >
                            <span>{back.name}</span>
                            <small>{getCameraSystemName(back.cameraSystemId)} · {isLoaded ? t('rolls.loaded') : t('rolls.available')}</small>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {enableFilmMode && (
                <>
                  <div className="new-roll-section new-roll-field-grid new-roll-field-grid--film">
                    <div className="form-group">
                      <div className="new-roll-field-heading">
                        <label>{t('rolls.filmRequired')}</label>
                        <button type="button" className="text-btn" onClick={openQuickAddFilm}>{t('rolls.quickAdd')}</button>
                      </div>
                      <div className="new-roll-film-search">
                        <div className="search-input-wrapper">
                          <Search className="search-icon" size={16} />
                          <input
                              type="text"
                              placeholder={t('rolls.filmSearchPlaceholder')}
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
                              className={`form-control premium-search-input ${selectedFilmId ? 'is-selected' : ''}`}
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
                              <li key={f.id}>
                                <button type="button" className="custom-dropdown-item" onClick={() => {
                                    setFilmSearchText(`${f.brand} ${f.name}`);
                                    setSelectedFilmId(f.id!);
                                    setIsFilmDropdownOpen(false);
                                }}>
                                  <div className="dropdown-item-title">{f.brand} {f.name}</div>
                                  <div className="dropdown-item-meta">{t('rolls.filmStockMeta', { iso: f.iso, count: f.stockCount || 0 })}</div>
                                </button>
                              </li>
                              ))
                            ) : (
                              <div className="dropdown-empty-state">{t('rolls.filmNotFound')}</div>
                            )}
                            {!visibleFilmStocks.some(f => `${f.brand} ${f.name}`.toLowerCase() === filmSearchText.trim().toLowerCase()) && filmSearchText.trim() !== '' && (
                              <li>
                                <button type="button" className="custom-dropdown-item create-new-item" onClick={() => setIsFilmDropdownOpen(false)}>
                                <div className="dropdown-item-title dropdown-item-new"><Sparkles size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '4px' }}/> {t('rolls.quickCreateFilm', { name: filmSearchText })}</div>
                                <div className="dropdown-item-meta">{t('rolls.quickCreateFilmHint')}</div>
                                </button>
                              </li>
                            )}
                          </motion.ul>
                        )}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>{t('rolls.rollFilmCost', { symbol: currencySymbol })}</label>
                      <div className="roll-price-control">
                        <button type="button" className="secondary roll-price-step" onClick={() => setRollFilmPrice(p => Math.max(0, (Number(p) || 0) - 5))} aria-label={t('rolls.decreaseFilmCost', { amount: 5 })}>-5</button>
                        <button type="button" className="secondary roll-price-step" onClick={() => setRollFilmPrice(p => Math.max(0, (Number(p) || 0) - 1))} aria-label={t('rolls.decreaseFilmCost', { amount: 1 })}>-1</button>
                        <input type="number" className="form-control roll-price-input" placeholder={t('rolls.costPlaceholder')} value={rollFilmPrice} onChange={e => setRollFilmPrice(e.target.value ? Number(e.target.value) : '')} />
                        <button type="button" className="secondary roll-price-step" onClick={() => setRollFilmPrice(p => (Number(p) || 0) + 1)} aria-label={t('rolls.increaseFilmCost', { amount: 1 })}>+1</button>
                        <button type="button" className="secondary roll-price-step" onClick={() => setRollFilmPrice(p => (Number(p) || 0) + 5)} aria-label={t('rolls.increaseFilmCost', { amount: 5 })}>+5</button>
                      </div>
                      {rollFilmPrice !== '' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={generateFilmExpense} onChange={e => setGenerateFilmExpense(e.target.checked)} />
                          <span>{t('rolls.syncFilmExpense')}</span>
                        </label>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="modal-actions new-roll-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
                  {t('rolls.saveAndCreateNext')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => { setIsNewRollModalOpen(false); setRollTitle(''); setSelectedCameraIds([]); setSelectedFilmId(''); setFilmSearchText(''); setRollFilmPrice(''); setGenerateFilmExpense(true); }}>{t('common.cancel')}</button>
                  <button type="submit" className="primary" disabled={isUserTierLoading || !rollTitle || selectedCameraIds.length === 0 || (enableFilmMode && !filmSearchText.trim())}>
                    {isUserTierLoading ? t('rolls.readingTier') : t('rolls.startLogging')}
                  </button>
                </div>
              </div>
            </form>
          </Modal>

      {/* --- QUICK ADD CAMERA MODAL --- */}
      <Modal isOpen={quickAddCameraOpen} onClose={() => setQuickAddCameraOpen(false)} overlayStyle={{ zIndex: 10020 }} style={{ maxWidth: '400px' }}>
            <h3>{t('rolls.quickAddCameraTitle')}</h3>
            <form onSubmit={handleQuickAddCamera}>
              <p className="modal-helper-text">{t('rolls.quickAddCameraHelp')}</p>
              <div className="form-group">
                <label>{t('rolls.cameraName')}</label>
                <input type="text" className="form-control" placeholder={t('rolls.cameraNamePlaceholder')} value={qaCameraName} onChange={e => setQaCameraName(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setQuickAddCameraOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" className="primary">{t('rolls.addAndSelect')}</button>
              </div>
            </form>
      </Modal>

      {/* --- QUICK ADD FILM MODAL --- */}
      <Modal isOpen={quickAddFilmOpen} onClose={() => setQuickAddFilmOpen(false)} overlayStyle={{ zIndex: 10020 }} style={{ maxWidth: '400px' }}>
            <h3>{t('rolls.quickAddFilmTitle')}</h3>
            <form onSubmit={handleQuickAddFilm}>
              <p className="modal-helper-text">{t('rolls.quickAddFilmHelp')}</p>
              <div className="form-group">
                <label>{t('rolls.filmBrand')}</label>
                <input type="text" className="form-control" placeholder={t('rolls.filmBrandPlaceholder')} value={qaFilmBrand} onChange={e => setQaFilmBrand(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>{t('rolls.filmModel')}</label>
                <input type="text" className="form-control" placeholder={t('rolls.filmModelPlaceholder')} value={qaFilmName} onChange={e => setQaFilmName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>{t('rolls.format')}</label>
                <div className="quick-format-toggle">
                  {(['135', '120'] as const).map(format => (
                    <button
                      key={format}
                      type="button"
                      className={`quick-format-option ${qaFilmFormat === format ? 'active' : ''}`}
                      onClick={() => setQaFilmFormat(format)}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setQuickAddFilmOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" className="primary">{t('rolls.addAndSelect')}</button>
              </div>
            </form>
      </Modal>

      {/* --- ADD EXISTING ROLLS TO COLLECTION MODAL --- */}
      <Modal isOpen={isAddExistingModalOpen} onClose={() => setIsAddExistingModalOpen(false)} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{t('rolls.addExistingTitle')}</h3>
              <button className="icon-btn" onClick={() => setIsAddExistingModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rolls.filter(r => r.collectionId !== activeCollectionId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>{t('rolls.noExistingRolls')}</div>
              ) : (
                rolls.filter(r => r.collectionId !== activeCollectionId).map(roll => {
                   const isSelected = selectedExistingRollIds.includes(roll.id!);
                   const currentCollection = roll.collectionId ? collections.find(c => c.id === roll.collectionId)?.name : t('rolls.loose');
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
              <button className="secondary" onClick={() => setIsAddExistingModalOpen(false)}>{t('common.cancel')}</button>
              <button className="primary" onClick={handleAddExistingRolls} disabled={selectedExistingRollIds.length === 0}>
                {t('rolls.addSelected', { count: selectedExistingRollIds.length })}
              </button>
            </div>
      </Modal>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        trigger="roll-limit"
      />

    </div>
  );
};
