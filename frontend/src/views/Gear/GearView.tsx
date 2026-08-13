import React, { useState, useRef, useEffect } from 'react';
import { db, type Camera, type Lens, type FilmStock, type OtherEquipment } from '../../db/schema';
import { Camera as CameraIcon, Plus, X, Search, Aperture, Film, Package } from 'lucide-react';
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
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { useTrialGate } from '../../contexts/useTrialGate';
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
import { adjustFilmStock } from '../../services/inventoryOperationService';
import { CamerasTab } from './components/CamerasTab';
import { LensesTab } from './components/LensesTab';
import { FilmStocksTab } from './components/FilmStocksTab';
import { OtherEquipmentTab } from './components/OtherEquipmentTab';
interface GearViewProps {
  enableFilmMode: boolean;
}

type SubTab = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';
type AvatarActionEntity = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';

const isSubTab = (value: string | null): value is SubTab => {
  return value === 'cameras' || value === 'lenses' || value === 'filmStocks' || value === 'otherEquipments';
};

const CAMERA_SYSTEM_PRESETS = [
  { name: 'Hasselblad V', backs: ['A12 Back', 'A16 Back', 'A24 Back'] },
  { name: 'Mamiya RB67', backs: ['6x7 120 Back', '6x6 Back', 'Polaroid Back'] },
  { name: 'Mamiya RZ67', backs: ['6x7 120 Back', '6x4.5 Back', 'Polaroid Back'] },
  { name: 'Bronica SQ', backs: ['120 6x6 Back', '220 6x6 Back'] },
  { name: 'Bronica ETR', backs: ['120 6x4.5 Back', '220 6x4.5 Back'] },
  { name: 'Fuji GX680', backs: ['120 Holder', '220 Holder', 'Instant Film Holder'] },
];

const COMMON_FILM_BACK_NAMES = ['A12 Back', 'A16 Back', '6x7 120 Back', '6x6 Back', '6x4.5 Back', 'Polaroid Back'];

const createDefaultNewFilmDraft = (format: '135' | '120' = '135'): Partial<FilmStock> => ({
  brand: '',
  name: '',
  iso: 400,
  colorType: 'color',
  format,
  stockCount: 1,
  pricePerRoll: undefined,
});

const getPlaceholderText = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length <= 10) {
    return trimmed;
  }
  // Split by whitespace to separate brand and model
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    // Model is everything except the first word (brand)
    const model = parts.slice(1).join(' ');
    if (model.length <= 10) {
      return model;
    }
    return model.slice(0, 9) + '…';
  }
  return trimmed.slice(0, 9) + '…';
};

export const GearView: React.FC<GearViewProps> = ({ enableFilmMode }) => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const { currencySymbol } = useCurrency();
  const { guardTrialResource } = useTrialGate();
  const { t } = useLanguage();
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
  const [editingLensId, setEditingLensId] = useState<string | null>(null);
  const [editingFilmId, setEditingFilmId] = useState<string | null>(null);
  const [filmDictSearch, setFilmDictSearch] = useState('');
  const [isDictDropdownOpen, setIsDictDropdownOpen] = useState(false);
  const [filmFormatFilter, setFilmFormatFilter] = useState<'135' | '120'>('135');
  const [selectedCameraBrand, setSelectedCameraBrand] = useState('');
  const [selectedCameraModel, setSelectedCameraModel] = useState('');
  const [cameraBrandSearch, setCameraBrandSearch] = useState('');
  const [cameraModelSearch, setCameraModelSearch] = useState('');
  const [lensDictSearch, setLensDictSearch] = useState('');
  const [isLensDictDropdownOpen, setIsLensDictDropdownOpen] = useState(false);
  const [lensTypeFilter, setLensTypeFilter] = useState<'prime' | 'zoom'>('prime');
  const [lensMountFilter, setLensMountFilter] = useState('all');
  const [lensMountSearch, setLensMountSearch] = useState('');
  const [selectedLensBrand, setSelectedLensBrand] = useState('');
  const [selectedLensModel, setSelectedLensModel] = useState('');
  const [lensBrandSearch, setLensBrandSearch] = useState('');
  const [lensModelSearch, setLensModelSearch] = useState('');
  const [selectedFilmBrand, setSelectedFilmBrand] = useState('');
  const [filmBrandSearch, setFilmBrandSearch] = useState('');
  const [filmModelSearch, setFilmModelSearch] = useState('');
  const [showManualFilmForm, setShowManualFilmForm] = useState(false);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);

  // Forms state
  const [newCamera, setNewCamera] = useState<Partial<Camera>>({ name: '', type: 'film', format: '135', purchasePrice: undefined });
  const [cameraSystemMode, setCameraSystemMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingCameraSystemId, setSelectedExistingCameraSystemId] = useState('');
  const [cameraSystemName, setCameraSystemName] = useState('');
  const [cameraBackNames, setCameraBackNames] = useState<string[]>(['Back 1']);
  const [newFilmBackName, setNewFilmBackName] = useState('');
  const [newLens, setNewLens] = useState<Partial<Lens>>({ name: '', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' });
  const [newFilm, setNewFilm] = useState<Partial<FilmStock>>(createDefaultNewFilmDraft());
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
    if (type === 'cameras' && editingCameraId === id) {
      setNewCamera(prev => ({ ...prev, avatarUrl }));
    }
    if (type === 'lenses' && editingLensId === id) {
      setNewLens(prev => ({ ...prev, avatarUrl }));
    }
    if (type === 'filmStocks' && editingFilmId === id) {
      setNewFilm(prev => ({ ...prev, avatarUrl }));
    }
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

  const getCameraSystemName = (systemId?: string) => cameraSystems.find(system => system.id === systemId)?.name || t('gear.unknownSystem');

  // Enter key mobile-like navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        const elements = Array.from(form.elements) as HTMLElement[];
        const index = elements.indexOf(e.currentTarget);
        const nextElement = elements.slice(index + 1).find(el => !el.hidden && !el.hasAttribute('disabled') && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'BUTTON'));
        if (nextElement) {
          if (nextElement.tagName === 'BUTTON' && (nextElement as HTMLButtonElement).type === 'submit') {
            nextElement.click();
          } else {
            nextElement.focus();
          }
        }
      }
    }
  };

  const preventNumberInputWheelChange = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };

  // Actions

  const activeCameraSystemId = editingCameraId
    ? newCamera.cameraSystemId
    : cameraSystemMode === 'existing'
      ? selectedExistingCameraSystemId
      : undefined;

  const activeSystemFilmBacks = activeCameraSystemId
    ? filmBacks.filter(back => back.cameraSystemId === activeCameraSystemId && back.status !== 'archived')
    : [];

  const cameraTypeLabel = newCamera.type === 'digital' ? t('gear.digitalCamera') : t('gear.filmCamera');
  const availableCameraFormats = newCamera.type === 'digital'
    ? ['digital']
    : ['135', '120', 'largeFormat'];
  const cameraFormatLabels: Record<string, string> = {
    '135': '135',
    '120': '120',
    digital: t('gear.digital'),
    largeFormat: t('gear.largeFormat'),
  };
  const cameraBrandOptions = Array.from(new Set(
    COMMON_CAMERAS
      .filter(camera => camera.type === newCamera.type && camera.format === newCamera.format)
      .map(camera => camera.brand)
  )).sort((a, b) => a.localeCompare(b));
  const visibleCameraBrandOptions = cameraBrandOptions.filter(brand =>
    brand.toLowerCase().includes(cameraBrandSearch.trim().toLowerCase())
  );
  const cameraModelOptions = selectedCameraBrand
    ? COMMON_CAMERAS.filter(camera =>
        camera.type === newCamera.type &&
        camera.format === newCamera.format &&
        camera.brand === selectedCameraBrand
      )
    : [];
  const visibleCameraModelOptions = cameraModelOptions.filter(camera =>
    `${camera.brand} ${camera.model}`.toLowerCase().includes(cameraModelSearch.trim().toLowerCase())
  );

  const lensMountOptions = Array.from(new Set(COMMON_LENSES.map(lens => lens.mountKey))).sort((a, b) => a.localeCompare(b));
  const visibleLensMountOptions = lensMountOptions.filter(mount =>
    mount.toLowerCase().includes(lensMountSearch.trim().toLowerCase())
  );
  const filteredLensCatalog = COMMON_LENSES.filter(lens => {
    if (lens.type !== lensTypeFilter) return false;
    if (lensMountFilter !== 'all' && lens.mountKey !== lensMountFilter) return false;
    return true;
  });
  const lensBrandOptions = Array.from(new Set(filteredLensCatalog.map(lens => lens.brand))).sort((a, b) => a.localeCompare(b));
  const visibleLensBrandOptions = lensBrandOptions.filter(brand =>
    brand.toLowerCase().includes(lensBrandSearch.trim().toLowerCase())
  );
  const lensModelOptions = selectedLensBrand
    ? filteredLensCatalog.filter(lens => lens.brand === selectedLensBrand)
    : [];
  const visibleLensModelOptions = lensModelOptions.filter(lens =>
    `${lens.brand} ${lens.model} ${lens.focalLength}mm ${lens.mountKey}`.toLowerCase().includes(lensModelSearch.trim().toLowerCase())
  );
  const filmCatalog = COMMON_FILM_STOCKS.filter(film => film.format === filmFormatFilter);
  const filmBrandOptions = Array.from(new Set(filmCatalog.map(film => film.brand))).sort((a, b) => a.localeCompare(b));
  const visibleFilmBrandOptions = filmBrandOptions.filter(brand =>
    brand.toLowerCase().includes(filmBrandSearch.trim().toLowerCase())
  );
  const filmModelOptions = selectedFilmBrand
    ? filmCatalog.filter(film => film.brand === selectedFilmBrand)
    : [];
  const visibleFilmModelOptions = filmModelOptions.filter(film =>
    `${film.brand} ${film.name} ${film.iso}`.toLowerCase().includes(filmModelSearch.trim().toLowerCase())
  );
  const hasSelectedFilmPreset = !editingFilmId && Boolean(newFilm.brand && newFilm.name);

  const handleAddFilmBack = async () => {
    if (!newFilmBackName.trim() || !user) return;
    if (!editingCameraId || !newCamera.cameraSystemId) {
      setCameraBackNames(prev => [...prev, newFilmBackName.trim()]);
      setNewFilmBackName('');
      return;
    }
    await db.filmBacks.add({
      id: crypto.randomUUID(),
      userId: user.id,
      cameraSystemId: newCamera.cameraSystemId,
      name: newFilmBackName.trim(),
      format: '120',
      status: 'active',
      addedAt: nowTimestamp
    });
    requestImmediateSync('film-back-create');
    setNewFilmBackName('');
  };

  const handleRemoveDraftFilmBack = (index: number) => {
    setCameraBackNames(prev => prev.filter((_, i) => i !== index));
  };

  const addDraftFilmBackName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCameraBackNames(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  };

  const applyCameraSystemPreset = (preset: { name: string; backs: string[] }) => {
    setCameraSystemMode('new');
    setSelectedExistingCameraSystemId('');
    setCameraSystemName(preset.name);
    setCameraBackNames(preset.backs);
  };

  const applyCameraPreset = (preset: CommonCameraPreset) => {
    const currentName = (newCamera.name || '').trim();
    const suffix = currentName.startsWith(preset.brand) && currentName !== preset.brand && !currentName.startsWith(`${preset.brand} ${preset.model}`)
      ? currentName.slice(preset.brand.length).trim()
      : '';
    setNewCamera({
      ...newCamera,
      name: `${preset.brand} ${preset.model}${suffix ? ` ${suffix}` : ''}`,
      type: preset.type,
      format: preset.format,
      backType: preset.backType || (preset.format === '120' ? 'fixed' : undefined),
    });
    setSelectedCameraBrand(preset.brand);
    setSelectedCameraModel(preset.model);

    if (preset.cameraSystemName) {
      setCameraSystemMode('new');
      setSelectedExistingCameraSystemId('');
      setCameraSystemName(preset.cameraSystemName);
      setCameraBackNames(preset.backs && preset.backs.length > 0 ? preset.backs : ['Back 1']);
    } else if (preset.format === '120') {
      setCameraSystemName('');
      setCameraBackNames(['Back 1']);
    }
  };

  const applyLensPreset = (preset: CommonLensPreset) => {
    setNewLens({
      ...newLens,
      name: `${preset.brand} ${preset.model}`,
      focalLength: preset.focalLength,
      maxAperture: preset.maxAperture,
      type: preset.type,
      mountKey: preset.mountKey,
    });
    setSelectedLensBrand(preset.brand);
    setSelectedLensModel(preset.model);
    setLensMountFilter(preset.mountKey);
    setLensTypeFilter(preset.type);
    setLensDictSearch('');
    setLensMountSearch('');
    setLensModelSearch('');
    setIsLensDictDropdownOpen(false);
  };

  const applyFilmPreset = (preset: CommonFilmStockPreset) => {
    setNewFilm({
      ...newFilm,
      brand: preset.brand,
      name: preset.name,
      iso: preset.iso,
      colorType: preset.colorType,
      format: preset.format
    });
    setFilmFormatFilter(preset.format);
    setSelectedFilmBrand(preset.brand);
    setFilmDictSearch('');
    setFilmModelSearch('');
    setIsDictDropdownOpen(false);
    setShowManualFilmForm(false);
  };

  const filteredLensPresets = COMMON_LENSES.filter(lens => {
    const q = lensDictSearch.trim().toLowerCase();
    if (!q) return false;
    if (lens.type !== lensTypeFilter) return false;
    if (lensMountFilter !== 'all' && lens.mountKey !== lensMountFilter) return false;
    return `${lens.brand} ${lens.model} ${lens.focalLength}mm ${lens.mountKey}`.toLowerCase().includes(q);
  }).slice(0, 10);

  const handleArchiveFilmBack = async (id: string) => {
    await db.filmBacks.update(id, { status: 'archived' });
    requestImmediateSync('film-back-archive');
  };

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamera.name) return;

    if (!editingCameraId && !guardTrialResource({ resource: 'cameras', currentCount: allCameras.length })) {
      setIsCameraModalOpen(false);
      return;
    }

    if (
      !editingCameraId &&
      newCamera.format === '120' &&
      newCamera.backType === 'interchangeable' &&
      cameraSystemMode === 'existing' &&
      !selectedExistingCameraSystemId
    ) {
      notify({
        type: 'error',
        title: t('gear.chooseCameraSystemTitle'),
        message: t('gear.chooseCameraSystemMessage')
      });
      return;
    }

    if (!editingCameraId) {
      const exists = allCameras.find(camera => camera.name === newCamera.name);
      if (exists) {
        const confirmed = await confirm({
          title: t('gear.duplicateCameraTitle'),
          message: t('gear.duplicateCameraMessage', { name: newCamera.name }),
          confirmText: t('gear.continueCreate')
        });
        if (!confirmed) {
          return;
        }
      }
    }

    await db.transaction('rw', db.cameras, db.cameraSystems, db.filmBacks, db.ledgerTransactions, async () => {
      const currentUserId = user?.id || 'offline';
      const is120Camera = newCamera.format === '120';
      const isInterchangeable120 = is120Camera && newCamera.backType === 'interchangeable';
      let cameraSystemId = isInterchangeable120 && !editingCameraId && cameraSystemMode === 'existing'
        ? selectedExistingCameraSystemId
        : newCamera.cameraSystemId;

      if (is120Camera && !cameraSystemId) {
        cameraSystemId = crypto.randomUUID();
        await db.cameraSystems.add({
          id: cameraSystemId,
          userId: currentUserId,
          name: isInterchangeable120 ? (cameraSystemName.trim() || `${newCamera.name} System`) : `${newCamera.name} Fixed Back`,
          mountKey: (isInterchangeable120 ? (cameraSystemName.trim() || newCamera.name || '120 System') : `${newCamera.name} Fixed Back`).toLowerCase().replace(/\s+/g, '-'),
          addedAt: nowTimestamp
        });
      }

      if (editingCameraId) {
        // Update mode
        await db.cameras.update(editingCameraId, {
          name: newCamera.name!,
          type: newCamera.type as 'film' | 'digital',
          format: newCamera.format || '135',
          cameraSystemId: is120Camera ? cameraSystemId : undefined,
          backType: isInterchangeable120 ? 'interchangeable' : 'fixed',
          purchasePrice: newCamera.purchasePrice ? Number(newCamera.purchasePrice) : undefined,
        });

        if (is120Camera && cameraSystemId && newCamera.backType !== 'interchangeable') {
          const existingFixedBack = await db.filmBacks
            .where('cameraSystemId')
            .equals(cameraSystemId)
            .filter(back => back.status !== 'archived')
            .first();
          if (!existingFixedBack) {
            await db.filmBacks.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              cameraSystemId,
              name: `${newCamera.name} Fixed Back`,
              format: '120',
              status: 'active',
              notes: 'System generated fixed 120 back',
              addedAt: nowTimestamp
            });
          }
        }

        const existingTx = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(editingCameraId)
          .filter(tx => tx.category === 'camera')
          .first();

        if (newCamera.purchasePrice && Number(newCamera.purchasePrice) > 0) {
          const amt = -Number(newCamera.purchasePrice);
          const notes = t('gear.ledgerPurchaseCamera', { name: newCamera.name! });
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, { amount: amt, notes });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount: amt,
              date: Date.now(),
              type: 'expense',
              category: 'camera',
              relatedEntityId: editingCameraId,
              notes,
              addedAt: Date.now()
            });
          }
        } else if (existingTx && existingTx.id) {
          await db.ledgerTransactions.delete(existingTx.id);
        }
      } else {
        // Create mode
        const id = crypto.randomUUID();
        await db.cameras.add({
          id,
          userId: currentUserId,
          name: newCamera.name!,
          type: newCamera.type as 'film' | 'digital',
          format: newCamera.format || '135',
          cameraSystemId: is120Camera ? cameraSystemId : undefined,
          backType: isInterchangeable120 ? 'interchangeable' : 'fixed',
          purchasePrice: newCamera.purchasePrice ? Number(newCamera.purchasePrice) : undefined,
          addedAt: Date.now()
        });

        if (is120Camera && cameraSystemId) {
          const rawBackNames = cameraBackNames.map(name => name.trim()).filter(Boolean);
          const backNames = isInterchangeable120
            ? (!editingCameraId && cameraSystemMode === 'existing'
                ? rawBackNames.filter(name => name !== 'Back 1')
                : rawBackNames)
            : [];
          const namesToCreate = backNames.length > 0 ? backNames : ['Back 1'];
          const shouldCreateBacks = !isInterchangeable120 || cameraSystemMode !== 'existing' || backNames.length > 0;
          if (shouldCreateBacks) {
            await db.filmBacks.bulkAdd(namesToCreate.map(name => ({
              id: crypto.randomUUID(),
              userId: currentUserId,
              cameraSystemId,
              name: isInterchangeable120 ? name : `${newCamera.name} Fixed Back`,
              format: '120',
              status: 'active' as const,
              notes: isInterchangeable120 ? undefined : 'System generated fixed 120 back',
              addedAt: nowTimestamp
            })));
          }
        }

        if (newCamera.purchasePrice && Number(newCamera.purchasePrice) > 0) {
          await db.ledgerTransactions.add({
            id: crypto.randomUUID(),
            userId: currentUserId,
            amount: -Number(newCamera.purchasePrice),
            date: Date.now(),
            type: 'expense',
            category: 'camera',
            relatedEntityId: id,
            notes: t('gear.ledgerPurchaseCamera', { name: newCamera.name! }),
            addedAt: Date.now()
          });
        }
      }
    });
    requestImmediateSync('camera-save');

    setNewCamera({ name: '', type: 'film', format: '135', purchasePrice: undefined });
    setCameraSystemMode('new');
    setSelectedExistingCameraSystemId('');
    setCameraSystemName('');
    setCameraBackNames(['Back 1']);
    setNewFilmBackName('');
    setSelectedCameraBrand('');
    setSelectedCameraModel('');
    setSelectedCameraModel('');
    setCameraBrandSearch('');
    setCameraModelSearch('');
    setEditingCameraId(null);
    if (!keepModalOpen) setIsCameraModalOpen(false);
  };

  const handleSaveLens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLens.name) return;

    if (!editingLensId && !guardTrialResource({ resource: 'lenses', currentCount: allLenses.length })) {
      setIsLensModalOpen(false);
      return;
    }

    if (!editingLensId) {
      const exists = allLenses.find(lens => lens.name === newLens.name);
      if (exists) {
        const confirmed = await confirm({
          title: t('gear.duplicateLensTitle'),
          message: t('gear.duplicateLensMessage', { name: newLens.name }),
          confirmText: t('gear.continueCreate')
        });
        if (!confirmed) {
          return;
        }
      }
    }

    await db.transaction('rw', db.lenses, db.ledgerTransactions, async () => {
      const currentUserId = user?.id || 'offline';

      if (editingLensId) {
        await db.lenses.update(editingLensId, {
          name: newLens.name!,
          focalLength: Number(newLens.focalLength) || 50,
          maxAperture: newLens.maxAperture || 'f/1.8',
          type: newLens.type || 'prime',
          mountKey: newLens.mountKey,
          purchasePrice: newLens.purchasePrice ? Number(newLens.purchasePrice) : undefined,
        });

        const existingTx = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(editingLensId)
          .filter(tx => tx.category === 'lens')
          .first();

        if (newLens.purchasePrice && Number(newLens.purchasePrice) > 0) {
          const amt = -Number(newLens.purchasePrice);
          const notes = t('gear.ledgerPurchaseLens', { name: newLens.name! });
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, { amount: amt, notes });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount: amt,
              date: Date.now(),
              type: 'expense',
              category: 'lens',
              relatedEntityId: editingLensId,
              notes,
              addedAt: Date.now()
            });
          }
        } else if (existingTx && existingTx.id) {
          await db.ledgerTransactions.delete(existingTx.id);
        }
      } else {
        const id = crypto.randomUUID();
        await db.lenses.add({
          id,
          userId: currentUserId,
          name: newLens.name!,
          focalLength: Number(newLens.focalLength) || 50,
          maxAperture: newLens.maxAperture || 'f/1.8',
          type: newLens.type || 'prime',
          mountKey: newLens.mountKey,
          purchasePrice: newLens.purchasePrice ? Number(newLens.purchasePrice) : undefined,
          addedAt: Date.now()
        });

        if (newLens.purchasePrice && Number(newLens.purchasePrice) > 0) {
          await db.ledgerTransactions.add({
            id: crypto.randomUUID(),
            userId: currentUserId,
            amount: -Number(newLens.purchasePrice),
            date: Date.now(),
            type: 'expense',
            category: 'lens',
            relatedEntityId: id,
            notes: t('gear.ledgerPurchaseLens', { name: newLens.name! }),
            addedAt: Date.now()
          });
        }
      }
    });
    requestImmediateSync('lens-save');

    setNewLens({ name: '', focalLength: 50, maxAperture: 'f/1.8', type: 'prime', purchasePrice: undefined });
    setLensDictSearch('');
    setIsLensDictDropdownOpen(false);
    setSelectedLensBrand('');
    setSelectedLensModel('');
    setLensBrandSearch('');
    setLensModelSearch('');
    setLensTypeFilter('prime');
    setLensMountFilter('all');
    setLensMountSearch('');
    setEditingLensId(null);
    if (!keepModalOpen) setIsLensModalOpen(false);
  };

  const handleSaveFilm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilm.brand || !newFilm.name) return;

    if (!editingFilmId && !guardTrialResource({ resource: 'filmStocks', currentCount: filmStocks.length })) {
      setIsFilmModalOpen(false);
      return;
    }

    if (!editingFilmId) {
      const exists = filmStocks.find(film => film.brand === newFilm.brand && film.name === newFilm.name);
      if (exists) {
        const confirmed = await confirm({
          title: t('gear.duplicateFilmTitle'),
          message: t('gear.duplicateFilmMessage', { name: `${newFilm.brand} ${newFilm.name}` }),
          confirmText: t('gear.continueCreate')
        });
        if (!confirmed) {
          return;
        }
      }
    }

    const stockAdjustment = await db.transaction('rw', db.filmStocks, db.ledgerTransactions, async (): Promise<{ film: Pick<FilmStock, 'id' | 'userId' | 'stockCount'>; delta: number } | null> => {
      const currentUserId = user?.id || 'offline';
      const parsedStockCount = Number(newFilm.stockCount);
      const stockCount = editingFilmId
        ? (Number.isFinite(parsedStockCount) ? Math.max(0, parsedStockCount) : 0)
        : (Number.isFinite(parsedStockCount) ? Math.max(1, parsedStockCount) : 1);
      const pricePerRoll = newFilm.pricePerRoll ? Number(newFilm.pricePerRoll) : undefined;

      if (editingFilmId) {
        const existingFilm = await db.filmStocks.get(editingFilmId);
        if (!existingFilm) return null;
        const currentStock = existingFilm.stockCount || 0;
        await db.filmStocks.update(editingFilmId, {
          brand: newFilm.brand!,
          name: newFilm.name!,
          iso: Number(newFilm.iso) || 400,
          colorType: newFilm.colorType as 'color' | 'bw',
          format: newFilm.format || '135',
          pricePerRoll,
        });
        const adjustment = { film: existingFilm, delta: stockCount - currentStock };

        const existingTx = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(editingFilmId)
          .filter(tx => tx.category === 'film')
          .first();

        if (stockCount > 0 && pricePerRoll && pricePerRoll > 0) {
          const amt = -(stockCount * pricePerRoll);
          const notes = t('gear.ledgerPurchaseFilm', { name: `${newFilm.brand} ${newFilm.name}`, count: stockCount });
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, { amount: amt, notes });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount: amt,
              date: Date.now(),
              type: 'expense',
              category: 'film',
              relatedEntityId: editingFilmId,
              notes,
              addedAt: Date.now()
            });
          }
        } else if (existingTx && existingTx.id) {
          await db.ledgerTransactions.delete(existingTx.id);
        }
        return adjustment;
      } else {
        const id = crypto.randomUUID();
        await db.filmStocks.add({
          id,
          userId: currentUserId,
          brand: newFilm.brand!,
          name: newFilm.name!,
          iso: Number(newFilm.iso) || 400,
          colorType: newFilm.colorType as 'color' | 'bw',
          format: newFilm.format || '135',
          isSystem: 0,
          stockCount: 0,
          pricePerRoll,
          addedAt: Date.now()
        });

        if (stockCount > 0 && pricePerRoll && pricePerRoll > 0) {
          await db.ledgerTransactions.add({
            id: crypto.randomUUID(),
            userId: currentUserId,
            amount: -(stockCount * pricePerRoll),
            date: Date.now(),
            type: 'expense',
            category: 'film',
            relatedEntityId: id,
            notes: t('gear.ledgerPurchaseFilm', { name: `${newFilm.brand} ${newFilm.name}`, count: stockCount }),
            addedAt: Date.now()
          });
        }
        return {
          film: { id, userId: currentUserId, stockCount: 0 },
          delta: stockCount,
        };
      }
    });
    if (stockAdjustment && stockAdjustment.delta !== 0) {
      await adjustFilmStock(stockAdjustment.film, stockAdjustment.delta);
    } else {
      requestImmediateSync('film-stock-save');
    }

    setNewFilm(createDefaultNewFilmDraft());
    setFilmDictSearch('');
    setIsDictDropdownOpen(false);
    setFilmFormatFilter('135');
    setSelectedFilmBrand('');
    setFilmBrandSearch('');
    setFilmModelSearch('');
    setShowManualFilmForm(false);
    setEditingFilmId(null);
    if (!keepModalOpen) setIsFilmModalOpen(false);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipment.name) return;

    if (!editingEquipmentId && !guardTrialResource({ resource: 'otherEquipments', currentCount: otherEquipments.length })) {
      setIsEquipmentModalOpen(false);
      return;
    }

    if (!editingEquipmentId) {
      const exists = otherEquipments.find(equipment => equipment.name === newEquipment.name);
      if (exists) {
        const confirmed = await confirm({
          title: t('gear.duplicateGearTitle'),
          message: t('gear.duplicateGearMessage', { name: newEquipment.name }),
          confirmText: t('gear.continueCreate')
        });
        if (!confirmed) {
          return;
        }
      }
    }

    await db.transaction('rw', db.otherEquipments, db.ledgerTransactions, async () => {
      const currentUserId = user?.id || 'offline';
      const catMap: Record<string, any> = {
        'chemical': 'chemical',
        'tripod': 'accessory',
        'cleaner': 'accessory',
        'other': 'other'
      };

      if (editingEquipmentId) {
        await db.otherEquipments.update(editingEquipmentId, {
          name: newEquipment.name!,
          type: newEquipment.type as OtherEquipment['type'],
          notes: newEquipment.notes || '',
          purchaseDate: newEquipment.purchaseDate,
          expiryDate: newEquipment.expiryDate,
          purchasePrice: newEquipment.purchasePrice ? Number(newEquipment.purchasePrice) : undefined,
        });

        const existingTx = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(editingEquipmentId)
          .first();

        if (newEquipment.purchasePrice && Number(newEquipment.purchasePrice) > 0) {
          const amt = -Number(newEquipment.purchasePrice);
          const notes = t('gear.ledgerPurchaseAccessory', { name: newEquipment.name! });
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, {
              amount: amt,
              category: catMap[newEquipment.type!] || 'other',
              notes
            });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount: amt,
              date: newEquipment.purchaseDate || Date.now(),
              type: 'expense',
              category: catMap[newEquipment.type!] || 'other',
              relatedEntityId: editingEquipmentId,
              notes,
              addedAt: Date.now()
            });
          }
        } else if (existingTx && existingTx.id) {
          await db.ledgerTransactions.delete(existingTx.id);
        }
      } else {
        const id = crypto.randomUUID();
        await db.otherEquipments.add({
          id,
          userId: currentUserId,
          name: newEquipment.name!,
          type: newEquipment.type as OtherEquipment['type'],
          notes: newEquipment.notes || '',
          purchaseDate: newEquipment.purchaseDate,
          expiryDate: newEquipment.expiryDate,
          purchasePrice: newEquipment.purchasePrice ? Number(newEquipment.purchasePrice) : undefined,
          addedAt: Date.now()
        });

        if (newEquipment.purchasePrice && Number(newEquipment.purchasePrice) > 0) {
          await db.ledgerTransactions.add({
            id: crypto.randomUUID(),
            userId: currentUserId,
            amount: -Number(newEquipment.purchasePrice),
            date: newEquipment.purchaseDate || Date.now(),
            type: 'expense',
            category: catMap[newEquipment.type!] || 'other',
            relatedEntityId: id,
            notes: t('gear.ledgerPurchaseAccessory', { name: newEquipment.name! }),
            addedAt: Date.now()
          });
        }
      }
    });
    requestImmediateSync('other-equipment-save');

    setNewEquipment({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined, purchasePrice: undefined });
    setEditingEquipmentId(null);
    if (!keepModalOpen) setIsEquipmentModalOpen(false);
  };

  const handleDeleteCamera = async (id: string) => {
    const confirmed = await confirm({
      title: t('gear.deleteCameraTitle'),
      message: t('gear.deleteCameraMessage'),
      confirmText: t('gear.confirmDelete'),
      isDanger: true
    });
    if (confirmed) {
      await db.cameras.delete(id);
      requestImmediateSync('camera-delete');
    }
  };

  const handleDeleteLens = async (id: string) => {
    const confirmed = await confirm({
      title: t('gear.deleteLensTitle'),
      message: t('gear.deleteLensMessage'),
      confirmText: t('gear.confirmDelete'),
      isDanger: true
    });
    if (confirmed) {
      await db.lenses.delete(id);
      requestImmediateSync('lens-delete');
    }
  };

  const handleArchiveConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveTarget) return;

    const { id, type, name } = archiveTarget;
    await db.transaction('rw', db.cameras, db.lenses, db.ledgerTransactions, async () => {
      // 1. Update status
      if (type === 'camera') {
        await db.cameras.update(id, { status: 'archived' });
      } else {
        await db.lenses.update(id, { status: 'archived' });
      }

      // 2. Add income transaction if sold
      if (archivePrice !== '' && Number(archivePrice) > 0) {
        await db.ledgerTransactions.add({
          id: crypto.randomUUID(),
          userId: user?.id || 'offline',
          amount: Number(archivePrice), // Positive = Income
          date: Date.now(),
          type: 'income',
          category: type === 'camera' ? 'camera' : 'lens',
          relatedEntityId: id,
          notes: type === 'camera'
            ? t('gear.ledgerSoldCamera', { name })
            : t('gear.ledgerSoldLens', { name }),
          addedAt: Date.now()
        });
      }
    });
    requestImmediateSync('gear-archive');

    setArchiveTarget(null);
    setArchivePrice('');
  };

  const handleDeleteFilm = async (id: string) => {
    const confirmed = await confirm({
      title: t('gear.deleteFilmTitle'),
      message: t('gear.deleteFilmMessage'),
      confirmText: t('gear.confirmDelete'),
      isDanger: true
    });
    if (confirmed) {
      await db.filmStocks.delete(id);
      requestImmediateSync('film-stock-delete');
    }
  };

  const handleUpdateStock = async (id: string, change: number) => {
    const film = filmStocks.find(stock => stock.id === id);
    if (!film) return;
    await adjustFilmStock(film, change);
  };

  const handleDeleteEquipment = async (id: string) => {
    const confirmed = await confirm({
      title: t('gear.deleteGearTitle'),
      message: t('gear.deleteGearMessage'),
      confirmText: t('gear.confirmDelete'),
      isDanger: true
    });
    if (confirmed) {
      await db.otherEquipments.delete(id);
      requestImmediateSync('other-equipment-delete');
    }
  };

  const openEditCamera = (c: Camera) => {
    setEditingCameraId(c.id!);
    setNewCamera(c);
    setCameraSystemMode('existing');
    setSelectedExistingCameraSystemId(c.cameraSystemId || '');
    setCameraSystemName(getCameraSystemName(c.cameraSystemId));
    setCameraBackNames([]);
    setNewFilmBackName('');
    setIsCameraModalOpen(true);
  };

  const openEditLens = (l: Lens) => {
    setEditingLensId(l.id!);
    setNewLens(l);
    setSelectedLensBrand('');
    setSelectedLensModel('');
    setLensBrandSearch('');
    setLensModelSearch('');
    setLensDictSearch('');
    setIsLensModalOpen(true);
  };

  const openEditFilm = (f: FilmStock) => {
    setEditingFilmId(f.id!);
    setNewFilm(f);
    setSelectedFilmBrand('');
    setFilmBrandSearch('');
    setFilmModelSearch('');
    setFilmDictSearch('');
    setShowManualFilmForm(false);
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
  ) => {
    if (!id) return null;
    const avatarFullUrl = getAvatarFullUrl(avatarUrl);

    return (
      <div className="edit-avatar-panel">
        <div className="edit-avatar-preview" onClick={() => avatarFullUrl && setPreviewAvatarUrl(avatarFullUrl)}>
          {avatarFullUrl ? (
            <img src={avatarFullUrl} alt={label} />
          ) : (
            <div className="edit-avatar-placeholder">{placeholder}</div>
          )}
        </div>
        <div className="edit-avatar-content">
          <div>
            <h4>{t('gear.coverTitle')}</h4>
            <p>{avatarFullUrl ? t('gear.coverCustom') : t('gear.coverDefault')}</p>
          </div>
          <div className="edit-avatar-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => avatarFullUrl ? openAvatarPreview(avatarFullUrl) : triggerAvatarUpload(id, type)}
              disabled={uploadingEntityId === id}
            >
              {uploadingEntityId === id ? t('common.loading') : avatarFullUrl ? t('gear.viewCover') : t('gear.uploadCover')}
            </button>
            {avatarFullUrl && (
              <>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => triggerAvatarUpload(id, type)}
                  disabled={uploadingEntityId === id}
                >
                  {t('gear.changeCover')}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleRemoveAvatar(id, type, label)}
                >
                  {t('gear.removeCover')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const openNewCamera = () => {
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
  };

  const openNewLens = () => {
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
  };

  const openNewFilm = () => {
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
            <button className="primary" onClick={() => {
              setEditingCameraId(null);
              setNewCamera({ name: '', type: 'film', format: '135', purchasePrice: undefined });
              setCameraSystemMode('new');
              setSelectedExistingCameraSystemId('');
              setCameraSystemName('');
              setCameraBackNames(['Back 1']);
              setNewFilmBackName('');
              setSelectedCameraBrand('');
              setSelectedCameraModel('');
              setSelectedCameraModel('');
              setCameraBrandSearch('');
              setCameraModelSearch('');
              setIsCameraModalOpen(true);
            }}>
              <Plus size={16} /> <span>{t('gear.addCamera')}</span>
            </button>
          )}
          {subTab === 'lenses' && (
            <button className="primary" onClick={() => {
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
            }}>
              <Plus size={16} /> <span>{t('gear.addLens')}</span>
            </button>
          )}
          {subTab === 'filmStocks' && enableFilmMode && (
            <button className="primary" onClick={() => {
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
            }}>
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
      <Modal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)}>
        <h3>{editingCameraId ? t('gear.editCamera') : t('gear.addCamera')}</h3>
        <form className="gear-modal-form" onSubmit={handleSaveCamera}>
          {!editingCameraId && (
            <div className="gear-preset-panel camera-builder-panel">
              <div className="builder-panel-heading">
                <div>
                  <strong>{t('gear.quickAddCameraTitle')}</strong>
                  <p>{t('gear.quickAddCameraHelp')}</p>
                </div>
                <span className="builder-status-pill">{cameraTypeLabel} · {cameraFormatLabels[newCamera.format || '135'] || newCamera.format}</span>
              </div>

              {selectedCameraModel && newCamera.name ? (
                <div className="selected-builder-summary selected-gear-summary builder-collapsed-summary">
                  <span>{newCamera.name}</span>
                  <small>{cameraTypeLabel} · {cameraFormatLabels[newCamera.format || '135'] || newCamera.format}</small>
                  <button
                    type="button"
                    className="secondary btn-sm"
                    onClick={() => {
                      setSelectedCameraBrand('');
                      setSelectedCameraModel('');
                      setCameraBrandSearch('');
                      setCameraModelSearch('');
                    }}
                  >
                    {t('gear.reselectCamera')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="builder-step">
                    <div className="builder-step-label">1. {t('gear.cameraType')}</div>
                    <div className="preset-chip-grid">
                      {[
                        { value: 'film' as const, label: t('gear.filmCamera') },
                        { value: 'digital' as const, label: t('gear.digitalCamera') },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={`preset-chip ${newCamera.type === option.value ? 'active' : ''}`}
                      onClick={() => {
                        setNewCamera({
                          ...newCamera,
                          type: option.value,
                          format: option.value === 'digital' ? 'digital' : '135',
                          backType: undefined,
                          name: ''
                        });
                        setSelectedCameraBrand('');
                        setSelectedCameraModel('');
                        setCameraBrandSearch('');
                        setCameraModelSearch('');
                        setCameraSystemName('');
                        setCameraBackNames(['Back 1']);
                      }}
                    >
                      {option.label}
                    </button>
                      ))}
                    </div>
                  </div>

                  <div className="builder-step">
                    <div className="builder-step-label">2. {t('gear.formatStep')}</div>
                    <div className="preset-chip-grid">
                      {availableCameraFormats.map(format => (
                        <button
                          key={format}
                          type="button"
                          className={`preset-chip ${newCamera.format === format ? 'active' : ''}`}
                      onClick={() => {
                        setNewCamera({
                          ...newCamera,
                          format,
                          backType: format === '120' ? 'fixed' : undefined,
                          name: ''
                        });
                        setSelectedCameraBrand('');
                        setSelectedCameraModel('');
                        setCameraModelSearch('');
                        setCameraSystemName('');
                        setCameraBackNames(['Back 1']);
                      }}
                    >
                      {cameraFormatLabels[format] || format}
                    </button>
                      ))}
                    </div>
                  </div>

                  <div className="builder-step">
                    <div className="builder-step-label">3. {t('gear.recommendedBrand', { count: cameraBrandOptions.length })}</div>
                    {selectedCameraBrand ? (
                      <div className="selected-builder-summary">
                        <span>{selectedCameraBrand}</span>
                        <button
                          type="button"
                          className="secondary btn-sm"
                      onClick={() => {
                        setSelectedCameraBrand('');
                        setSelectedCameraModel('');
                        setCameraBrandSearch('');
                        setCameraModelSearch('');
                      }}
                    >
                      {t('gear.changeBrand')}
                    </button>
                  </div>
                    ) : (
                      <>
                        {cameraBrandOptions.length > 10 && (
                          <input
                            type="text"
                            className="form-control builder-option-search"
                            placeholder={t('gear.searchCameraBrand')}
                            value={cameraBrandSearch}
                            onChange={e => setCameraBrandSearch(e.target.value)}
                          />
                        )}
                        <div className="preset-chip-grid builder-scroll-grid">
                          {visibleCameraBrandOptions.map(brand => (
                            <button
                              key={brand}
                              type="button"
                              className="preset-chip"
                          onClick={() => {
                            setSelectedCameraBrand(brand);
                            setCameraModelSearch('');
                            setNewCamera(prev => ({
                              ...prev,
                              name: prev.name?.trim() ? prev.name : brand,
                            }));
                          }}
                        >
                          {brand}
                        </button>
                          ))}
                          {visibleCameraBrandOptions.length === 0 && (
                            <span className="gear-preset-empty">{t('gear.noBrandMatch')}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

	                  {selectedCameraBrand && (
	                    <div className="builder-step">
	                      <div className="builder-step-label">4. {t('gear.selectRecommendedModel', { count: cameraModelOptions.length })}</div>
	                      {cameraModelOptions.length > 8 && (
	                        <input
	                          type="text"
	                          className="form-control builder-option-search"
	                          placeholder={t('gear.searchCameraModel', { brand: selectedCameraBrand })}
	                          value={cameraModelSearch}
	                          onChange={e => setCameraModelSearch(e.target.value)}
	                        />
                      )}
                      <div className="preset-chip-grid builder-scroll-grid model-grid">
                        {visibleCameraModelOptions.map(preset => (
                          <button
                            key={`${preset.brand}-${preset.model}`}
                            type="button"
                            className={`preset-chip ${newCamera.name === `${preset.brand} ${preset.model}` ? 'active' : ''}`}
                            onClick={() => applyCameraPreset(preset)}
                          >
                            {preset.model}
                            {preset.backType === 'interchangeable' ? ` · ${t('gear.interchangeableBack')}` : ''}
                          </button>
	                        ))}
	                        {visibleCameraModelOptions.length === 0 && (
	                          <span className="gear-preset-empty">{t('gear.noCameraModelMatch')}</span>
	                        )}
	                      </div>
	                    </div>
	                  )}
	                  <div className="film-back-empty">{t('gear.cameraPresetHelp')}</div>
                </>
              )}
            </div>
          )}
          {renderAvatarEditor(
            editingCameraId,
            'cameras',
            newCamera.avatarUrl,
            newCamera.name || t('gear.addCamera'),
            getPlaceholderText(newCamera.name || 'Camera')
          )}
          <div className="form-group">
            <label>{t('gear.cameraName')}</label>
            <input
              type="text"
              className="form-control"
              placeholder={t('gear.cameraNamePlaceholder')}
              value={newCamera.name}
              onChange={e => {
                setNewCamera({...newCamera, name: e.target.value});
                setSelectedCameraModel('');
              }}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
              required
            />
          </div>
          {editingCameraId && (
            <>
              <div className="form-group">
                <label>{t('gear.cameraType')}</label>
                <select
                  className="form-control"
                  value={newCamera.type}
                  onChange={e => {
                    const nextType = e.target.value as 'film' | 'digital';
                    setNewCamera({
                      ...newCamera,
                      type: nextType,
                      format: nextType === 'digital' ? 'digital' : (newCamera.format === 'digital' ? '135' : newCamera.format),
                      backType: nextType === 'digital' ? undefined : newCamera.backType,
                    });
                    setSelectedCameraBrand('');
                    setSelectedCameraModel('');
                  }}
                  onKeyDown={handleKeyDown}
                >
                  <option value="film">{t('gear.filmCamera')}</option>
                  <option value="digital">{t('gear.digitalCamera')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('gear.formatStep')}</label>
                <select
                  className="form-control"
                  value={newCamera.format}
                  onChange={e => {
                    const nextFormat = e.target.value;
                    setNewCamera({
                      ...newCamera,
                      format: nextFormat,
                      type: nextFormat === 'digital' ? 'digital' : newCamera.type,
                      backType: nextFormat === '120' ? (newCamera.backType || 'fixed') : undefined,
                    });
                    setSelectedCameraBrand('');
                    setSelectedCameraModel('');
                  }}
                  onKeyDown={handleKeyDown}
                >
                  <option value="135">{t('gear.format135')}</option>
                  <option value="120">{t('gear.format120')}</option>
                  <option value="largeFormat">{t('gear.largeFormat')}</option>
                  <option value="digital">{t('gear.digitalFormat')}</option>
                </select>
              </div>
            </>
          )}

          {newCamera.format === '120' && (
            <div className="form-group">
              <label>{t('gear.backMode')}</label>
              <select
                className="form-control"
                value={newCamera.backType || 'fixed'}
                onChange={e => setNewCamera({
                  ...newCamera,
                  backType: e.target.value as 'fixed' | 'interchangeable'
                })}
              >
                <option value="fixed">{t('gear.fixedBackOption')}</option>
                <option value="interchangeable">{t('gear.interchangeableBackOption')}</option>
              </select>
            </div>
          )}

          {newCamera.format === '120' && newCamera.backType === 'interchangeable' && (
            <div className="form-group">
              <div className="camera-system-guide">
                <strong>{t('gear.backGuideTitle')}</strong>
                <p>{t('gear.backGuideDesc')}</p>
              </div>

              <label>{t('gear.chooseCameraSystem')}</label>
              {!editingCameraId && cameraSystems.length > 0 && (
                <div className="camera-system-mode-toggle">
                  <button
                    type="button"
                    className={`system-mode-btn ${cameraSystemMode === 'new' ? 'active' : ''}`}
                    onClick={() => {
                      setCameraSystemMode('new');
                      setSelectedExistingCameraSystemId('');
                      setCameraBackNames(prev => prev.length > 0 ? prev : ['Back 1']);
                    }}
                  >
                    {t('gear.newSystem')}
                  </button>
                  <button
                    type="button"
                    className={`system-mode-btn ${cameraSystemMode === 'existing' ? 'active' : ''}`}
                    onClick={() => {
                      setCameraSystemMode('existing');
                      setCameraBackNames([]);
                    }}
                  >
                    {t('gear.existingSystem')}
                  </button>
                </div>
              )}

              {editingCameraId || cameraSystemMode === 'new' ? (
                <>
                  {!editingCameraId && (
                    <div className="preset-chip-grid">
                      {CAMERA_SYSTEM_PRESETS.map(preset => (
                        <button
                          key={preset.name}
                          type="button"
                          className="preset-chip"
                          onClick={() => applyCameraSystemPreset(preset)}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t('gear.cameraSystemPlaceholder')}
                    value={cameraSystemName}
                    onChange={e => setCameraSystemName(e.target.value)}
                    disabled={Boolean(editingCameraId && newCamera.cameraSystemId)}
                  />
                </>
              ) : (
                <select
                  className="form-control"
                  value={selectedExistingCameraSystemId}
                  onChange={e => setSelectedExistingCameraSystemId(e.target.value)}
                >
                  <option value="">{t('gear.selectExistingSystem')}</option>
                  {cameraSystems.map(system => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </select>
              )}

              {!editingCameraId && (
                <div className="film-back-manager">
                  {cameraSystemMode === 'existing' && selectedExistingCameraSystemId && (
                    <div className="film-back-list">
                      {activeSystemFilmBacks.length === 0 ? (
                        <div className="film-back-empty">{t('gear.noBacksInSystem')}</div>
                      ) : (
                        activeSystemFilmBacks.map(back => (
                          <div key={back.id} className="film-back-row">
                            <span>{back.name}</span>
                            <small>{t('gear.existing')}</small>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <label>{t('gear.filmBackStep')}</label>
                  {cameraSystemMode === 'new' && (
                    <div className="preset-chip-grid">
                      {COMMON_FILM_BACK_NAMES.map(name => (
                        <button
                          key={name}
                          type="button"
                          className="preset-chip"
                          onClick={() => addDraftFilmBackName(name)}
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="film-back-list">
                    {cameraBackNames.map((name, index) => (
                      <div key={`${name}-${index}`} className="film-back-row">
                        <span>{name}</span>
                        <button type="button" className="secondary btn-sm" onClick={() => handleRemoveDraftFilmBack(index)}>
                          {t('gear.remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="film-back-add-row">
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('gear.filmBackPlaceholder')}
                      value={newFilmBackName}
                      onChange={e => setNewFilmBackName(e.target.value)}
                    />
                    <button type="button" className="secondary" onClick={handleAddFilmBack}>{t('gear.addCustomBack')}</button>
                  </div>
                  <div className="film-back-empty">{t('gear.backShareHint')}</div>
                </div>
              )}
              {editingCameraId && newCamera.cameraSystemId && (
                <div className="film-back-manager">
                  <div className="film-back-list">
                    {activeSystemFilmBacks
                      .map(back => (
                        <div key={back.id} className="film-back-row">
                          <span>{back.name}</span>
                          <button type="button" className="secondary btn-sm" onClick={() => handleArchiveFilmBack(back.id!)}>
                            {t('gear.remove')}
                          </button>
                        </div>
                      ))}
                  </div>
                  <div className="film-back-add-row">
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('gear.newBackName')}
                      value={newFilmBackName}
                      onChange={e => setNewFilmBackName(e.target.value)}
                    />
                    <button type="button" className="secondary" onClick={handleAddFilmBack}>{t('gear.addBack')}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label>{t('gear.purchasePrice', { symbol: currencySymbol })}</label>
            <input
              type="number"
              className="form-control"
              placeholder={t('gear.purchasePriceCameraPlaceholder')}
              value={newCamera.purchasePrice || ''}
              onChange={e => setNewCamera({...newCamera, purchasePrice: e.target.value ? Number(e.target.value) : undefined})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
            />
          </div>
          <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
              {t('gear.saveAndAddNext')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsCameraModalOpen(false)}>{t('common.cancel')}</button>
              <button type="submit" className="primary">{editingCameraId ? t('gear.saveChanges') : t('gear.add')}</button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isLensModalOpen} onClose={() => setIsLensModalOpen(false)}>
        <h3>{editingLensId ? t('gear.editLens') : t('gear.addLens')}</h3>
        <form className="gear-modal-form" onSubmit={handleSaveLens}>
          {!editingLensId && (
            <div className="gear-preset-panel">
              <div className="builder-panel-heading">
                <div>
                  <strong>{t('gear.quickAddLensTitle')}</strong>
                  <p>{t('gear.quickAddLensHelp')}</p>
                </div>
                {newLens.name && <span className="builder-status-pill">{newLens.name}</span>}
              </div>
              {selectedLensModel && newLens.name ? (
                <div className="selected-builder-summary selected-gear-summary builder-collapsed-summary lens-builder-collapsed">
                  <span>{newLens.name}</span>
                  <small>{newLens.focalLength}mm · {newLens.maxAperture} · {newLens.mountKey || t('gear.noMount')}</small>
                  <button
                    type="button"
                    className="secondary btn-sm"
                    onClick={() => {
                      setSelectedLensBrand('');
                      setSelectedLensModel('');
                      setLensMountFilter('all');
                      setLensBrandSearch('');
                      setLensModelSearch('');
                      setLensDictSearch('');
                    }}
                  >
                    {t('gear.reselectLens')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="builder-step">
                    <div className="builder-step-label">1. {t('gear.lensType')}</div>
                    <div className="preset-chip-grid">
                      {[
                        { value: 'prime' as const, label: t('gear.prime') },
                        { value: 'zoom' as const, label: t('gear.zoom') },
                      ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`preset-chip ${lensTypeFilter === option.value ? 'active' : ''}`}
                      onClick={() => {
                        setLensTypeFilter(option.value);
                        setNewLens(prev => ({ ...prev, type: option.value }));
                        setSelectedLensBrand('');
                        setSelectedLensModel('');
                        setLensModelSearch('');
                      }}
                    >
                      {option.label}
                    </button>
                      ))}
                    </div>
                  </div>
                  <div className="builder-step">
                    <div className="builder-step-label">2. {t('gear.mountSystem')}</div>
	                    {lensMountFilter !== 'all' ? (
	                      <div className="selected-builder-summary">
	                        <span>{lensMountFilter}</span>
	                        <button
	                          type="button"
                          className="secondary btn-sm"
	                          onClick={() => {
	                            setLensMountFilter('all');
	                            setLensMountSearch('');
	                            setSelectedLensBrand('');
	                            setSelectedLensModel('');
	                            setLensBrandSearch('');
	                            setLensModelSearch('');
                          }}
                        >
                          {t('gear.changeMount')}
                        </button>
	                      </div>
	                    ) : (
	                      <>
	                        {lensMountOptions.length > 10 && (
	                          <input
	                            type="text"
	                            className="form-control builder-option-search"
	                            placeholder={t('gear.searchMount')}
	                            value={lensMountSearch}
	                            onChange={e => setLensMountSearch(e.target.value)}
	                          />
	                        )}
	                        <div className="preset-chip-grid compact builder-scroll-grid">
	                          {visibleLensMountOptions.map(mount => (
	                            <button
	                              key={mount}
	                              type="button"
	                              className="preset-chip"
	                              onClick={() => {
	                                setLensMountFilter(mount);
	                                setLensMountSearch('');
	                                setSelectedLensBrand('');
	                                setSelectedLensModel('');
	                                setLensModelSearch('');
	                              }}
	                            >
	                              {mount}
	                            </button>
	                          ))}
	                          {visibleLensMountOptions.length === 0 && (
	                            <span className="gear-preset-empty">{t('gear.noMountMatch')}</span>
	                          )}
	                        </div>
	                      </>
	                    )}
	                  </div>

                  <div className="builder-step">
                    <div className="builder-step-label">3. {t('gear.recommendedBrand', { count: lensBrandOptions.length })}</div>
                    {selectedLensBrand ? (
                      <div className="selected-builder-summary">
                        <span>{selectedLensBrand}</span>
                        <button
                          type="button"
                          className="secondary btn-sm"
                          onClick={() => {
                            setSelectedLensBrand('');
                            setSelectedLensModel('');
                            setLensBrandSearch('');
                            setLensModelSearch('');
                          }}
                        >
                          {t('gear.changeBrand')}
                        </button>
                      </div>
                    ) : (
                      <>
                        {lensBrandOptions.length > 10 && (
                          <input
                            type="text"
                            className="form-control builder-option-search"
                            placeholder={t('gear.searchLensBrand')}
                            value={lensBrandSearch}
                            onChange={e => setLensBrandSearch(e.target.value)}
                          />
                        )}
                        <div className="preset-chip-grid builder-scroll-grid">
                          {visibleLensBrandOptions.map(brand => (
                            <button
                              key={brand}
                              type="button"
                              className="preset-chip"
                              onClick={() => {
                                setSelectedLensBrand(brand);
                                setSelectedLensModel('');
                                setLensModelSearch('');
                              }}
                            >
                              {brand}
                            </button>
                          ))}
                          {visibleLensBrandOptions.length === 0 && (
                            <span className="gear-preset-empty">{t('gear.noBrandMatch')}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {selectedLensBrand && (
                    <div className="builder-step">
                      <div className="builder-step-label">4. {t('gear.recommendedModel', { count: lensModelOptions.length })}</div>
                      {lensModelOptions.length > 8 && (
                        <input
                          type="text"
                          className="form-control builder-option-search"
                          placeholder={t('gear.searchLensModel', { brand: selectedLensBrand })}
                          value={lensModelSearch}
                          onChange={e => setLensModelSearch(e.target.value)}
                        />
                      )}
                      <div className="preset-chip-grid builder-scroll-grid model-grid">
                        {visibleLensModelOptions.map(preset => (
                          <button
                            key={`${preset.brand}-${preset.model}`}
                            type="button"
                            className={`preset-chip ${newLens.name === `${preset.brand} ${preset.model}` ? 'active' : ''}`}
                            onClick={() => applyLensPreset(preset)}
                          >
                            {preset.model} · {preset.focalLength}mm
                          </button>
                        ))}
                        {visibleLensModelOptions.length === 0 && (
                          <span className="gear-preset-empty">{t('gear.noLensModelMatch')}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <details className="builder-fallback-search">
                    <summary>{t('gear.directSearchLens')}</summary>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                      <Search className="search-icon" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-control"
                        style={{ paddingLeft: 36, backgroundColor: 'var(--bg-secondary)' }}
                        placeholder={t('gear.searchLensPlaceholder')}
                        value={lensDictSearch}
                        onChange={e => {
                          setLensDictSearch(e.target.value);
                          setIsLensDictDropdownOpen(true);
                        }}
                        onFocus={() => setIsLensDictDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsLensDictDropdownOpen(false), 200)}
                      />
                      {isLensDictDropdownOpen && lensDictSearch && (
                        <ul className="custom-dropdown-menu gear-preset-dropdown">
                          {filteredLensPresets.length === 0 ? (
                            <li className="gear-preset-empty">{t('gear.noPresetFound')}</li>
                          ) : (
                            filteredLensPresets.map((preset, idx) => (
                              <li key={`${preset.brand}-${preset.model}-${idx}`} onClick={() => applyLensPreset(preset)}>
                                <div style={{ fontWeight: 700 }}>{preset.brand} {preset.model}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {preset.focalLength}mm · {preset.maxAperture} · {preset.type === 'prime' ? t('gear.prime') : t('gear.zoom')} · {preset.mountKey}
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  </details>
                </>
              )}
              <div className="film-back-empty">{t('gear.presetDraftOnly')}</div>
            </div>
          )}
          {renderAvatarEditor(
            editingLensId,
            'lenses',
            newLens.avatarUrl,
            newLens.name || t('gear.addLens'),
            <LensSvgAvatar focalLength={Number(newLens.focalLength) || 50} type={newLens.type || 'prime'} size={72} />
          )}
          <div className="form-group">
            <label>{t('gear.lensModel')}</label>
            <input
              type="text"
              className="form-control"
              placeholder={t('gear.lensModelPlaceholder')}
              value={newLens.name}
              onChange={e => {
                setNewLens({...newLens, name: e.target.value});
                setSelectedLensModel('');
              }}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
              required
            />
          </div>
          <div className="form-group">
            <label>{t('gear.focalLength')} (mm)</label>
            <input
              type="number"
              className="form-control"
              value={newLens.focalLength}
              onChange={e => setNewLens({...newLens, focalLength: Number(e.target.value)})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
              required
            />
          </div>
          <div className="form-group">
            <label>{t('gear.maxAperture')}</label>
            <input
              type="text"
              className="form-control"
              placeholder={t('gear.aperturePlaceholder')}
              value={newLens.maxAperture}
              onChange={e => setNewLens({...newLens, maxAperture: e.target.value})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
              required
            />
          </div>
          {editingLensId && (
            <div className="form-group">
              <label>{t('gear.lensType')}</label>
              <select
                className="form-control"
                value={newLens.type}
                onChange={e => setNewLens({...newLens, type: e.target.value})}
                onKeyDown={handleKeyDown}
              >
                <option value="prime">{t('gear.prime')}</option>
                <option value="zoom">{t('gear.zoom')}</option>
              </select>
            </div>
          )}
          <div className="form-group">
            <label>{t('gear.purchasePrice', { symbol: currencySymbol })}</label>
            <input
              type="number"
              className="form-control"
              placeholder={t('gear.purchasePriceLensPlaceholder')}
              value={newLens.purchasePrice || ''}
              onChange={e => setNewLens({...newLens, purchasePrice: e.target.value ? Number(e.target.value) : undefined})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
            />
          </div>
          <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
              {t('gear.saveAndAddNext')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsLensModalOpen(false)}>{t('common.cancel')}</button>
              <button type="submit" className="primary">{editingLensId ? t('gear.saveChanges') : t('gear.add')}</button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isFilmModalOpen} onClose={() => setIsFilmModalOpen(false)}>
        <h3>{editingFilmId ? t('gear.editFilmStock') : t('gear.stockFilm')}</h3>
        <form className="gear-modal-form" onSubmit={handleSaveFilm}>
          {renderAvatarEditor(
            editingFilmId,
            'filmStocks',
            newFilm.avatarUrl,
            `${newFilm.brand || ''} ${newFilm.name || t('common.unknownFilm')}`.trim(),
            <FilmSvgAvatar brand={newFilm.brand || 'Film'} name={newFilm.name || 'Stock'} format={newFilm.format || '135'} size={72} />
          )}
          {!editingFilmId && (
            <div className="gear-preset-panel">
              <div className="builder-panel-heading">
                <div>
                  <strong>{t('gear.quickAddFilmTitle')}</strong>
                  <p>{t('gear.quickAddFilmHelp')}</p>
                </div>
                {newFilm.brand && newFilm.name && (
                  <span className="builder-status-pill">{newFilm.brand} {newFilm.name}</span>
                )}
              </div>
              {newFilm.brand && newFilm.name ? (
                <div className="selected-builder-summary selected-gear-summary builder-collapsed-summary">
                  <span>{newFilm.brand} {newFilm.name}</span>
                  <small>ISO {newFilm.iso} · {newFilm.colorType === 'color' ? t('gear.color') : t('gear.bw')} · {newFilm.format}</small>
                  <button
                    type="button"
                    className="secondary btn-sm"
                    onClick={() => {
                      setNewFilm({
                        ...createDefaultNewFilmDraft(filmFormatFilter),
                        stockCount: newFilm.stockCount,
                        pricePerRoll: newFilm.pricePerRoll,
                      });
                      setSelectedFilmBrand('');
                      setFilmBrandSearch('');
                      setFilmModelSearch('');
                      setShowManualFilmForm(false);
                    }}
                  >
                    {t('gear.reselectFilm')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="builder-step">
                    <div className="builder-step-label">1. {t('gear.formatStep')}</div>
                    <div className="preset-chip-grid">
                      {[
                        { value: '135' as const, label: '135' },
                        { value: '120' as const, label: '120' },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={`preset-chip ${filmFormatFilter === option.value ? 'active' : ''}`}
                          onClick={() => {
                            setFilmFormatFilter(option.value);
                            setNewFilm(prev => ({ ...prev, format: option.value }));
                            setSelectedFilmBrand('');
                            setFilmBrandSearch('');
                            setFilmModelSearch('');
                            setFilmDictSearch('');
                            if (!newFilm.brand || !newFilm.name) {
                              setShowManualFilmForm(false);
                            }
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="builder-step">
                    <div className="builder-step-label">2. {t('gear.recommendedBrand', { count: filmBrandOptions.length })}</div>
                    {selectedFilmBrand ? (
                      <div className="selected-builder-summary">
                        <span>{selectedFilmBrand}</span>
                        <button
                          type="button"
                          className="secondary btn-sm"
                          onClick={() => {
                            setSelectedFilmBrand('');
                            setFilmBrandSearch('');
                            setFilmModelSearch('');
                          }}
                        >
                          {t('gear.changeBrand')}
                        </button>
                      </div>
                    ) : (
                      <>
                        {filmBrandOptions.length > 10 && (
                          <input
                            type="text"
                            className="form-control builder-option-search"
                            placeholder={t('gear.searchFilmBrand')}
                            value={filmBrandSearch}
                            onChange={e => setFilmBrandSearch(e.target.value)}
                          />
                        )}
                        <div className="preset-chip-grid builder-scroll-grid">
                          {visibleFilmBrandOptions.map(brand => (
                            <button
                              key={brand}
                              type="button"
                              className="preset-chip"
                              onClick={() => {
                                setSelectedFilmBrand(brand);
                                setFilmModelSearch('');
                              }}
                            >
                              {brand}
                            </button>
                          ))}
                          {visibleFilmBrandOptions.length === 0 && (
                            <span className="gear-preset-empty">{t('gear.noBrandMatch')}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {selectedFilmBrand && (
                    <div className="builder-step">
                      <div className="builder-step-label">3. {t('gear.recommendedModel', { count: filmModelOptions.length })}</div>
                      {filmModelOptions.length > 8 && (
                        <input
                          type="text"
                          className="form-control builder-option-search"
                          placeholder={t('gear.searchFilmModel', { brand: selectedFilmBrand })}
                          value={filmModelSearch}
                          onChange={e => setFilmModelSearch(e.target.value)}
                        />
                      )}
                      <div className="preset-chip-grid builder-scroll-grid model-grid">
                        {visibleFilmModelOptions.map(film => (
                          <button
                            key={`${film.brand}-${film.name}-${film.format}`}
                            type="button"
                            className="preset-chip"
                            onClick={() => applyFilmPreset(film)}
                          >
                            {film.name} · ISO {film.iso}
                          </button>
                        ))}
                        {visibleFilmModelOptions.length === 0 && (
                          <span className="gear-preset-empty">{t('gear.noFilmModelMatch')}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <details className="builder-fallback-search">
                    <summary>{t('gear.directSearchFilm')}</summary>
                    <div className="search-input-wrapper">
                      <Search className="search-icon" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-control"
                        style={{ paddingLeft: 36, backgroundColor: 'var(--bg-tertiary)' }}
                        placeholder={t('gear.searchFilmPlaceholder')}
                        value={filmDictSearch}
                        onChange={e => {
                          setFilmDictSearch(e.target.value);
                          setIsDictDropdownOpen(true);
                        }}
                        onFocus={() => setIsDictDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsDictDropdownOpen(false), 200)}
                      />
                    </div>
                    {isDictDropdownOpen && filmDictSearch && (
                      <ul className="custom-dropdown-menu gear-preset-dropdown">
                        {COMMON_FILM_STOCKS
                          .filter(f => `${f.brand} ${f.name} ${f.format}`.toLowerCase().includes(filmDictSearch.toLowerCase()))
                          .slice(0, 10)
                          .map((f, idx) => (
                            <li key={idx} style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={() => applyFilmPreset(f)}>
                              <div style={{ fontWeight: 600 }}>{f.brand} {f.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ISO {f.iso} • {f.colorType === 'color' ? t('gear.color') : t('gear.bw')} • {f.format}</div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </details>
                </>
              )}
            </div>
          )}
                    <div className="form-group">
            <label htmlFor="film-stock-count">
              {editingFilmId ? t('gear.stockCount') : t('gear.addStockCount')}
            </label>
            <input
              id="film-stock-count"
              type="number"
              className="form-control"
              min={editingFilmId ? '0' : '1'}
              placeholder={editingFilmId ? t('gear.stockCountPlaceholder') : t('gear.addStockCountPlaceholder')}
              value={newFilm.stockCount === undefined ? '' : newFilm.stockCount}
              onChange={e => setNewFilm({...newFilm, stockCount: e.target.value === '' ? undefined : parseInt(e.target.value, 10)})}
              onWheel={preventNumberInputWheelChange}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
            />
          </div>
          <div className="form-group">
            <label>{t('gear.averagePricePerRoll', { symbol: currencySymbol })}</label>
            <input
              type="number"
              className="form-control"
              placeholder={t('gear.pricePerRollPlaceholder')}
              value={newFilm.pricePerRoll || ''}
              onChange={e => setNewFilm({...newFilm, pricePerRoll: e.target.value ? Number(e.target.value) : undefined})}
              onWheel={preventNumberInputWheelChange}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
            />
          </div>

          {(!editingFilmId && !showManualFilmForm) ? (
            hasSelectedFilmPreset ? (
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('gear.manualFilmConfig')}</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{newFilm.brand} {newFilm.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      ISO {newFilm.iso} · {newFilm.colorType === 'color' ? t('gear.color') : t('gear.bw')} · {newFilm.format}
                    </div>
                  </div>
                  <button type="button" className="text-btn" onClick={() => setShowManualFilmForm(true)}>
                    {t('gear.customizeFilmDetails')}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', margin: '8px 0 24px 0' }}>
                <button type="button" className="text-btn" onClick={() => setShowManualFilmForm(true)}>{t('gear.manualFilmToggle')}</button>
              </div>
            )
          ) : (editingFilmId && !showManualFilmForm) ? (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('gear.manualFilmConfig')}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{newFilm.brand} {newFilm.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    ISO {newFilm.iso} · {newFilm.colorType === 'color' ? t('gear.color') : t('gear.bw')} · {newFilm.format}
                  </div>
                </div>
                <button type="button" className="text-btn" onClick={() => setShowManualFilmForm(true)}>
                  {t('gear.customizeFilmDetails')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('gear.manualFilmConfig')}</span>
                <button type="button" className="text-btn" style={{ fontSize: '12px' }} onClick={() => setShowManualFilmForm(false)}>{t('gear.collapse')}</button>
              </div>
              <div className="form-group">
                <label>{t('gear.brandMaker')}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('rolls.filmBrandPlaceholder')}
                  value={newFilm.brand}
                  onChange={e => setNewFilm({...newFilm, brand: e.target.value})}
                  onKeyDown={handleKeyDown}
                  enterKeyHint="next"
                  required={showManualFilmForm || !!editingFilmId}
                />
              </div>
              <div className="form-group">
                <label>{t('gear.modelName')}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('rolls.filmModelPlaceholder')}
                  value={newFilm.name}
                  onChange={e => setNewFilm({...newFilm, name: e.target.value})}
                  onKeyDown={handleKeyDown}
                  enterKeyHint="next"
                  required={showManualFilmForm || !!editingFilmId}
                />
              </div>
              <div className="form-group">
                <label>{t('gear.isoSpeed')}</label>
                <input
                  type="number"
                  className="form-control"
                  value={newFilm.iso}
                  onChange={e => setNewFilm({...newFilm, iso: Number(e.target.value)})}
                  onKeyDown={handleKeyDown}
                  enterKeyHint="next"
                  required={showManualFilmForm || !!editingFilmId}
                />
              </div>
              <div className="form-group">
                <label>{t('gear.colorType')}</label>
                <select
                  className="form-control"
                  value={newFilm.colorType}
                  onChange={e => setNewFilm({...newFilm, colorType: e.target.value as any})}
                  onKeyDown={handleKeyDown}
                >
                  <option value="color">{t('gear.colorFilm')}</option>
                  <option value="bw">{t('gear.bwFilm')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('gear.formatSize')}</label>
                <select
                  className="form-control"
                  value={newFilm.format}
                  onChange={e => {
                    const nextFormat = e.target.value as '135' | '120';
                    setNewFilm({...newFilm, format: nextFormat});
                    if (!editingFilmId) {
                      setFilmFormatFilter(nextFormat);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                >
                  <option value="135">{t('gear.format135')}</option>
                  <option value="120">{t('gear.format120')}</option>
                </select>
              </div>
            </div>
          )}
          <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
              {t('gear.saveAndAddNext')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsFilmModalOpen(false)}>{t('common.cancel')}</button>
              <button type="submit" className="primary">{editingFilmId ? t('gear.saveChanges') : t('gear.add')}</button>
            </div>
          </div>
        </form>
      </Modal>

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
