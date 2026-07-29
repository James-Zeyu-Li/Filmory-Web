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
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { useCameraSystems, useCameras, useFilmBacks, useLenses, useFilmStocks, useOtherEquipments } from '../../hooks/useData';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { IconButton } from '../../components/ui/IconButton';
import { motion } from 'framer-motion';
import { compressImageToBase64 } from '../../utils/imageService';
import { removeGearAvatar, type GearAvatarTableName } from '../../services/gearAvatarService';
import { useLocation, useNavigate } from 'react-router-dom';
import { GEAR_SUB_TAB_KEY } from '../../services/workspacePreferences';
interface GearViewProps {
  enableFilmMode: boolean;
}

type SubTab = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';

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
  const [newFilm, setNewFilm] = useState<Partial<FilmStock>>({ brand: '', name: '', iso: 400, colorType: 'color', format: '135', stockCount: 0 });
  const [newEquipment, setNewEquipment] = useState<Partial<OtherEquipment>>({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined });
  const [nowTimestamp] = useState(Date.now);

  // Upload and Lightbox states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadEntity, setActiveUploadEntity] = useState<{ id: string, type: 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments' } | null>(null);
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
    const apiBaseUrl = localStorage.getItem('filmory_api_base_url') || 'http://localhost:8080';
    return (url.startsWith('http') || url.startsWith('data:')) ? url : `${apiBaseUrl}${url}`;
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

  const triggerAvatarUpload = (id: string, type: 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments') => {
    setActiveUploadEntity({ id, type });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
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
      // Create an 800px WebP Base64 string
      // This provides excellent click-to-enlarge quality while staying under ~50KB
      const base64DataUrl = await compressImageToBase64(file, 800, 0.8);

      // Save directly to Local Database based on entity type
      const table = (db as any)[activeUploadEntity.type];
      await table.update(activeUploadEntity.id, { avatarUrl: base64DataUrl });
      updateEditingAvatarState(activeUploadEntity.id, activeUploadEntity.type, base64DataUrl);

    } catch (err) {
      console.error(err);
      notify({
        type: 'error',
        title: '头像处理失败',
        message: err instanceof Error ? err.message : '请稍后重试。'
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
      title: '移除器材封面',
      message: `确认移除「${label}」的封面吗？这只会清空封面图片，不会删除器材记录。`,
      confirmText: '移除封面'
    });
    if (!confirmed) return;

    try {
      await removeGearAvatar(type, id);
      updateEditingAvatarState(id, type, null);
      notify({
        type: 'success',
        title: '封面已移除',
        message: '器材记录已恢复为默认占位图。'
      });
    } catch (err) {
      notify({
        type: 'error',
        title: '移除封面失败',
        message: err instanceof Error ? err.message : '请稍后重试。'
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

  // Actions

  // Filter and Sort logic
  const filterAndSort = (items: any[]) => {
    let filtered = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = items.filter(i =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.brand && i.brand.toLowerCase().includes(q)) ||
        (i.type && i.type.toLowerCase().includes(q))
      );
    }
    return filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      } else {
        const nameA = a.name || a.brand || '';
        const nameB = b.name || b.brand || '';
        return nameA.localeCompare(nameB);
      }
    });
  };

  const displayCameras = filterAndSort(cameras);
  const displayLenses = filterAndSort(lenses);
  const displayFilms = filterAndSort(filmStocks);
  const displayEquipments = filterAndSort(otherEquipments);

  const getCameraSystemName = (systemId?: string) => {
    return cameraSystems.find(system => system.id === systemId)?.name || '未分配系统';
  };

  const getFilmBacksForCamera = (camera: Camera) => {
    if (!camera.cameraSystemId) return [];
    return filmBacks.filter(back => back.cameraSystemId === camera.cameraSystemId && back.status !== 'archived');
  };

  const activeCameraSystemId = editingCameraId
    ? newCamera.cameraSystemId
    : cameraSystemMode === 'existing'
      ? selectedExistingCameraSystemId
      : undefined;

  const activeSystemFilmBacks = activeCameraSystemId
    ? filmBacks.filter(back => back.cameraSystemId === activeCameraSystemId && back.status !== 'archived')
    : [];

  const cameraTypeLabel = newCamera.type === 'digital' ? '数码相机' : '胶片相机';
  const availableCameraFormats = newCamera.type === 'digital'
    ? ['digital']
    : ['135', '120', 'largeFormat'];
  const cameraFormatLabels: Record<string, string> = {
    '135': '135',
    '120': '120',
    digital: '数码',
    largeFormat: '大画幅',
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
    setShowManualFilmForm(true);
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
  };

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamera.name) return;

    if (
      !editingCameraId &&
      newCamera.format === '120' &&
      newCamera.backType === 'interchangeable' &&
      cameraSystemMode === 'existing' &&
      !selectedExistingCameraSystemId
    ) {
      notify({
        type: 'error',
        title: '请选择相机系统',
        message: '使用已有 120 系统时，需要先选择一个系统来共享后背。'
      });
      return;
    }

    if (!editingCameraId) {
      const exists = allCameras.find(camera => camera.name === newCamera.name);
      if (exists) {
        const confirmed = await confirm({
          title: '相机已存在',
          message: `仓库中已存在名为 "${newCamera.name}" 的相机。是否继续创建第二台？`,
          confirmText: '继续创建'
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
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, { amount: amt, notes: `购入机身: ${newCamera.name}` });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount: amt,
              date: Date.now(),
              type: 'expense',
              category: 'camera',
              relatedEntityId: editingCameraId,
              notes: `购入机身: ${newCamera.name}`,
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
            notes: `购入机身: ${newCamera.name}`,
            addedAt: Date.now()
          });
        }
      }
    });

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

    if (!editingLensId) {
      const exists = allLenses.find(lens => lens.name === newLens.name);
      if (exists) {
        const confirmed = await confirm({
          title: '镜头已存在',
          message: `仓库中已存在名为 "${newLens.name}" 的镜头。是否继续创建第二支？`,
          confirmText: '继续创建'
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
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, { amount: amt, notes: `购入镜头: ${newLens.name}` });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount: amt,
              date: Date.now(),
              type: 'expense',
              category: 'lens',
              relatedEntityId: editingLensId,
              notes: `购入镜头: ${newLens.name}`,
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
            notes: `购入镜头: ${newLens.name}`,
            addedAt: Date.now()
          });
        }
      }
    });

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

    if (!editingFilmId) {
      const exists = filmStocks.find(film => film.brand === newFilm.brand && film.name === newFilm.name);
      if (exists) {
        const confirmed = await confirm({
          title: '胶卷已存在',
          message: `仓库中已存在型号为 "${newFilm.brand} ${newFilm.name}" 的胶卷。是否继续创建新的条目？\n\n提示：如果您只是想补充库存，可以直接在已有胶卷上点击"库存变动"来增加数量。`,
          confirmText: '继续创建'
        });
        if (!confirmed) {
          return;
        }
      }
    }

    await db.transaction('rw', db.filmStocks, db.ledgerTransactions, async () => {
      const currentUserId = user?.id || 'offline';
      const stockCount = Number(newFilm.stockCount) || 0;
      const pricePerRoll = newFilm.pricePerRoll ? Number(newFilm.pricePerRoll) : undefined;

      if (editingFilmId) {
        // Find existing to get old stockCount if needed, or just overwrite (since we don't allow modifying stockCount freely via Edit normally, but if they do, we accept it)
        await db.filmStocks.update(editingFilmId, {
          brand: newFilm.brand!,
          name: newFilm.name!,
          iso: Number(newFilm.iso) || 400,
          colorType: newFilm.colorType as 'color' | 'bw',
          format: newFilm.format || '135',
          stockCount,
          pricePerRoll,
        });

        const existingTx = await db.ledgerTransactions
          .where('relatedEntityId')
          .equals(editingFilmId)
          .filter(tx => tx.category === 'film')
          .first();

        if (stockCount > 0 && pricePerRoll && pricePerRoll > 0) {
          const amt = -(stockCount * pricePerRoll);
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, { amount: amt, notes: `购入胶片: ${newFilm.brand} ${newFilm.name} x${stockCount}` });
          } else {
            await db.ledgerTransactions.add({
              id: crypto.randomUUID(),
              userId: currentUserId,
              amount: amt,
              date: Date.now(),
              type: 'expense',
              category: 'film',
              relatedEntityId: editingFilmId,
              notes: `购入胶片: ${newFilm.brand} ${newFilm.name} x${stockCount}`,
              addedAt: Date.now()
            });
          }
        } else if (existingTx && existingTx.id) {
          await db.ledgerTransactions.delete(existingTx.id);
        }
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
          stockCount,
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
            notes: `购入胶片: ${newFilm.brand} ${newFilm.name} x${stockCount}`,
            addedAt: Date.now()
          });
        }
      }
    });

    setNewFilm({ brand: '', name: '', iso: 400, colorType: 'color', format: '135', stockCount: 0, pricePerRoll: undefined });
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

    if (!editingEquipmentId) {
      const exists = otherEquipments.find(equipment => equipment.name === newEquipment.name);
      if (exists) {
        const confirmed = await confirm({
          title: '器材已存在',
          message: `仓库中已存在名为 "${newEquipment.name}" 的器材。是否继续创建新的条目？`,
          confirmText: '继续创建'
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
          if (existingTx && existingTx.id) {
            await db.ledgerTransactions.update(existingTx.id, {
              amount: amt,
              category: catMap[newEquipment.type!] || 'other',
              notes: `购入耗材/配件: ${newEquipment.name}`
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
              notes: `购入耗材/配件: ${newEquipment.name}`,
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
            notes: `购入耗材/配件: ${newEquipment.name}`,
            addedAt: Date.now()
          });
        }
      }
    });

    setNewEquipment({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined, purchasePrice: undefined });
    setEditingEquipmentId(null);
    if (!keepModalOpen) setIsEquipmentModalOpen(false);
  };

  const handleDeleteCamera = async (id: string) => {
    const confirmed = await confirm({
      title: '删除相机',
      message: '确认彻底删除这台相机吗？收支记录可能会受影响。\n提示：如果是卖出器材，建议使用归档功能。',
      confirmText: '确认删除',
      isDanger: true
    });
    if (confirmed) {
      await db.cameras.delete(id);
    }
  };

  const handleDeleteLens = async (id: string) => {
    const confirmed = await confirm({
      title: '删除镜头',
      message: '确认彻底删除这支镜头吗？收支记录可能会受影响。',
      confirmText: '确认删除',
      isDanger: true
    });
    if (confirmed) {
      await db.lenses.delete(id);
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
          notes: `售出 ${type === 'camera' ? '机身' : '镜头'}: ${name}`,
          addedAt: Date.now()
        });
      }
    });

    setArchiveTarget(null);
    setArchivePrice('');
  };

  const handleDeleteFilm = async (id: string) => {
    const confirmed = await confirm({
      title: '删除胶卷',
      message: '确认彻底删除这款胶卷吗？收支记录可能会受影响。',
      confirmText: '确认删除',
      isDanger: true
    });
    if (confirmed) {
      await db.filmStocks.delete(id);
    }
  };

  const handleUpdateStock = async (id: string, current: number, change: number) => {
    const next = Math.max(0, current + change);
    await db.filmStocks.update(id, { stockCount: next });
  };

  const handleDeleteEquipment = async (id: string) => {
    const confirmed = await confirm({
      title: '删除器材',
      message: '确认彻底删除这个器材吗？收支记录可能会受影响。',
      confirmText: '确认删除',
      isDanger: true
    });
    if (confirmed) {
      await db.otherEquipments.delete(id);
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
    setShowManualFilmForm(true);
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
            <img src={avatarFullUrl} alt={`${label} 封面`} />
          ) : (
            <div className="edit-avatar-placeholder">{placeholder}</div>
          )}
        </div>
        <div className="edit-avatar-content">
          <div>
            <h4>器材封面</h4>
            <p>{avatarFullUrl ? '当前记录已有自定义封面。' : '当前记录使用默认占位图。'}</p>
          </div>
          <div className="edit-avatar-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => triggerAvatarUpload(id, type)}
              disabled={uploadingEntityId === id}
            >
              {uploadingEntityId === id ? '处理中...' : '更换封面'}
            </button>
            {avatarFullUrl && (
              <button
                type="button"
                className="danger"
                onClick={() => handleRemoveAvatar(id, type, label)}
              >
                移除封面
              </button>
            )}
          </div>
        </div>
      </div>
    );
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
                {subTab === 'cameras' ? '相机设备' : subTab === 'lenses' ? '镜头' : subTab === 'filmStocks' ? '胶卷库存' : '其他器材'}
              </h1>
              <p className="view-header-subtitle">
                {subTab === 'cameras' ? '整理你正在使用和收藏的相机机身。' : subTab === 'lenses' ? '整理镜头焦段、光圈和使用情况。' : subTab === 'filmStocks' ? '查看手上还有哪些胶卷可拍。' : '整理三脚架、闪光灯和冲洗用品等辅助器材。'}
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
              <Plus size={16} /> <span>添加相机</span>
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
              <Plus size={16} /> <span>添加镜头</span>
            </button>
          )}
          {subTab === 'filmStocks' && enableFilmMode && (
            <button className="primary" onClick={() => {
              setEditingFilmId(null);
              setNewFilm({ brand: '', name: '', iso: 400, colorType: 'color', format: '135', stockCount: 0 });
              setFilmDictSearch('');
              setIsDictDropdownOpen(false);
              setFilmFormatFilter('135');
              setSelectedFilmBrand('');
              setFilmBrandSearch('');
              setFilmModelSearch('');
              setShowManualFilmForm(false);
              setIsFilmModalOpen(true);
            }}>
              <Plus size={16} /> <span>添加胶卷</span>
            </button>
          )}
          {subTab === 'otherEquipments' && (
            <button className="primary" onClick={() => {
              setEditingEquipmentId(null);
              setNewEquipment({ name: '', type: 'chemical', notes: '', purchaseDate: undefined, expiryDate: undefined });
              setIsEquipmentModalOpen(true);
            }}>
              <Plus size={16} /> <span>添加器材</span>
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
              <CameraIcon size={16} /> 相机库 ({cameras.length})
            </button>
            <button
              className={`tab-btn ${subTab === 'lenses' ? 'active' : ''}`}
              onClick={() => setSubTab('lenses')}
            >
              <Aperture size={16} /> 镜头库 ({lenses.length})
            </button>
            {enableFilmMode && (
              <button
                className={`tab-btn ${subTab === 'filmStocks' ? 'active' : ''}`}
                onClick={() => setSubTab('filmStocks')}
              >
                <Film size={16} /> 胶卷库 ({filmStocks.length})
              </button>
            )}
            <button
              className={`tab-btn ${subTab === 'otherEquipments' ? 'active' : ''}`}
              onClick={() => setSubTab('otherEquipments')}
            >
              <Package size={16} /> 附件耗材 ({otherEquipments.length})
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
                placeholder="全局搜索..."
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
                  title="记录您的专属测光伙伴"
                  description="工欲善其事，必先利其器。把你心爱的主力机身录入进来，开启属于你的光影之旅。"
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
                  }}><Plus size={16} /> 添加相机</button>}
                />
              </div>
            ) : displayCameras.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={CameraIcon}
                  title="未找到匹配的相机"
                  description="尝试清除搜索条件或换个关键词试试。"
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
                          title="点击预览大图"
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
                        onClick={(e) => { e.stopPropagation(); triggerAvatarUpload(camera.id!, 'cameras'); }}
                        disabled={uploadingEntityId === camera.id}
                        title="上传相机封面"
                      >
                        {uploadingEntityId === camera.id ? (
                          <span className="avatar-loading-spinner" />
                        ) : (
                          <Upload size={14} />
                        )}
                      </button>
                    </div>

                    <div className="camera-card-content">
                      <div className="gear-card-header">
                        <span className={`tag ${camera.type}`}>{camera.type === 'film' ? '胶片' : '数码'}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <IconButton variant="success" icon={<Archive size={16} />} title="售出/归档" onClick={(e) => { e.stopPropagation(); setArchiveTarget({ id: camera.id!, type: 'camera', name: camera.name }); }} />
                          <IconButton variant="danger" icon={<Trash2 size={16} />} title="彻底删除" onClick={(e) => { e.stopPropagation(); handleDeleteCamera(camera.id!); }} />
                        </div>
                      </div>
                      <h3>{camera.name}</h3>
                      <div className="gear-details">
                        <div><strong>画幅：</strong>{camera.format}</div>
                        {camera.format === '120' && (
                          <div><strong>后背：</strong>{camera.backType === 'interchangeable' ? `${getFilmBacksForCamera(camera).length} 个 · ${getCameraSystemName(camera.cameraSystemId)}` : '固定后背'}</div>
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
                  title="不同的视角，不同的世界"
                  description="无论是 35mm 的街头纪实还是 85mm 的人像特写，在这里建立您的专属镜头矩阵。"
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
                  }}><Plus size={16} /> 添加镜头</button>}
                />
              </div>
            ) : displayLenses.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={SlidersHorizontal}
                  title="未找到匹配的镜头"
                  description="尝试清除搜索条件或换个关键词试试。"
                />
              </div>
            ) : (
              displayLenses.map(lens => (
                <div key={lens.id} className="gear-card lens-card-horizontal" onClick={(e) => { e.stopPropagation(); openEditLens(lens); }} style={{ cursor: "pointer" }}>
                  <div className="camera-avatar-container" style={{ width: '80px', height: '80px' }}>
                    {getAvatarFullUrl(lens.avatarUrl) ? (
                      <img
                        src={getAvatarFullUrl(lens.avatarUrl)!}
                        alt={lens.name}
                        className="camera-avatar-img"
                        onClick={(e) => { e.stopPropagation(); setPreviewAvatarUrl(getAvatarFullUrl(lens.avatarUrl)!); }}
                        title="点击预览大图"
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
                      onClick={(e) => { e.stopPropagation(); triggerAvatarUpload(lens.id!, 'lenses'); }}
                      disabled={uploadingEntityId === lens.id}
                      title="上传镜头封面"
                    >
                      {uploadingEntityId === lens.id ? (
                        <span className="avatar-loading-spinner" />
                      ) : (
                        <Upload size={14} />
                      )}
                    </button>
                  </div>
                  <div className="lens-card-content">
                    <div className="gear-card-header">
                      <span className={`tag lens-${lens.type || 'prime'}`}>
                        {lens.type === 'prime' ? '定焦' : '变焦'}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <IconButton variant="success" icon={<Archive size={16} />} title="售出/归档" onClick={(e) => { e.stopPropagation(); setArchiveTarget({ id: lens.id!, type: 'lens', name: lens.name }); }} />
                        <IconButton variant="danger" icon={<Trash2 size={16} />} title="彻底删除" onClick={(e) => { e.stopPropagation(); handleDeleteLens(lens.id!); }} />
                      </div>
                    </div>
                    <h3>{lens.name}</h3>
                    <div className="gear-details">
                      <div><strong>焦段：</strong>{lens.focalLength}mm</div>
                      <div><strong>最大光圈：</strong>{lens.maxAperture}</div>
                    </div>
                  </div>
                </div>
              ))
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
                  title="记录您的每一卷胶片"
                  description="将您购买的胶片录入库存，Filmory 会为您追踪库存数量与消耗情况。"
                  action={<button className="primary" onClick={() => {
                    setEditingFilmId(null);
                    setNewFilm({ brand: '', name: '', iso: 400, colorType: 'color', format: '135', stockCount: 0 });
                    setFilmDictSearch('');
                    setIsDictDropdownOpen(false);
                    setFilmFormatFilter('135');
                    setSelectedFilmBrand('');
                    setFilmBrandSearch('');
                    setFilmModelSearch('');
                    setShowManualFilmForm(false);
                    setIsFilmModalOpen(true);
                  }}><Plus size={16} /> 添加胶卷</button>}
                />
              </div>
            ) : displayFilms.length === 0 ? (
              <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState
                  icon={Film}
                  title="未找到匹配的胶卷"
                  description="尝试清除搜索条件或换个关键词试试。"
                />
              </div>
            ) : (
              displayFilms.map(film => (
                <div key={film.id} className="gear-card lens-card-horizontal" onClick={() => openEditFilm(film)} style={{ cursor: "pointer" }}>
                  <div className="camera-avatar-container" style={{ width: '80px', height: '80px' }}>
                    {getAvatarFullUrl(film.avatarUrl) ? (
                      <img
                        src={getAvatarFullUrl(film.avatarUrl)!}
                        alt={film.name}
                        className="camera-avatar-img"
                        onClick={(e) => { e.stopPropagation(); setPreviewAvatarUrl(getAvatarFullUrl(film.avatarUrl)!); }}
                        title="点击预览大图"
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
                      onClick={(e) => { e.stopPropagation(); triggerAvatarUpload(film.id!, 'filmStocks'); }}
                      disabled={uploadingEntityId === film.id}
                      title="上传胶卷封面"
                    >
                      {uploadingEntityId === film.id ? (
                        <span className="avatar-loading-spinner" />
                      ) : (
                        <Upload size={14} />
                      )}
                    </button>
                  </div>
                  <div className="lens-card-content">
                    <div className="gear-card-header">
                      <span className={`tag ${film.colorType === 'color' ? 'color' : 'bw'}`}>
                        {film.colorType === 'color' ? '彩色' : '黑白'}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <IconButton variant="danger" icon={<Trash2 size={16} />} title="彻底删除" onClick={(e) => { e.stopPropagation(); handleDeleteFilm(film.id!); }} />
                      </div>
                    </div>
                    <h3 style={{ margin: '4px 0' }}>{film.brand} {film.name}</h3>
                    <div className="gear-details" style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: 'none', paddingTop: '0', marginTop: '0' }}>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                        <div><strong>ISO：</strong>{film.iso}</div>
                        <div><strong>画幅：</strong>{film.format}</div>
                      </div>
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <strong>库存数量：</strong>{film.stockCount || 0} 卷
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="secondary"
                            style={{ padding: '2px 8px', fontSize: '11px', minWidth: '22px', height: '22px', width: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="减少库存"
                            onClick={() => handleUpdateStock(film.id!, film.stockCount || 0, -1)}
                          >
                            -
                          </button>
                          <button
                            className="secondary"
                            style={{ padding: '2px 8px', fontSize: '11px', minWidth: '22px', height: '22px', width: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="增加库存"
                            onClick={() => handleUpdateStock(film.id!, film.stockCount || 0, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 4. OTHER EQUIPMENTS TAB */}
        {subTab === 'otherEquipments' && (
          <>
            <div className="gear-context-note">
              120 后背/片盒属于相机系统，会影响正在进行的卷和装片统计；请在相机库的 120 可换后背机身中管理。这里仅记录药水、三脚架、清洁工具等附件耗材。
            </div>
            <div className="grid-layout">
              {otherEquipments.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                  <EmptyState
                    icon={SlidersHorizontal}
                    title="整理摄影附件周边"
                    description="从暗房药水到三脚架，全面管理您的摄影耗材。120 后背请在相机系统中管理。"
                    action={<button className="primary" onClick={() => { setEditingEquipmentId(null); setIsEquipmentModalOpen(true); }}><Plus size={16} /> 登记附件</button>}
                  />
                </div>
              ) : displayEquipments.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                  <EmptyState
                    icon={SlidersHorizontal}
                    title="未找到匹配的附件"
                    description="尝试清除搜索条件或换个关键词试试。"
                  />
                </div>
              ) : (
                displayEquipments.map(eq => {
                  const isExpired = eq.type === 'chemical' && eq.expiryDate && eq.expiryDate < nowTimestamp;
                  return (
                    <div key={eq.id} className={`gear-card equipment-card ${isExpired ? 'expired-alert' : ''}`} onClick={() => openEditEquipment(eq)} style={{ cursor: 'pointer' }}>
                      <div className="gear-card-header">
                        <span className={`tag eq-${eq.type}`}>
                          {eq.type === 'chemical' ? '药水' :
                           eq.type === 'tripod' ? '三脚架' :
                           eq.type === 'cleaner' ? '清洁工具' : '其它'}
                        </span>
                        {isExpired && <span className="tag expired-tag">已过期</span>}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <IconButton variant="danger" icon={<Trash2 size={16} />} title="彻底删除" onClick={(e) => { e.stopPropagation(); handleDeleteEquipment(eq.id!); }} />
                        </div>
                      </div>
                      <h3>{eq.name}</h3>
                      <div className="gear-details">
                        {eq.purchaseDate && (
                          <div><strong>购买日期：</strong>{new Date(eq.purchaseDate).toLocaleDateString()}</div>
                        )}
                        {eq.type === 'chemical' && eq.expiryDate && (
                          <div className={isExpired ? 'expired-text' : ''}>
                            <strong>过期日期：</strong>{new Date(eq.expiryDate).toLocaleDateString()}
                          </div>
                        )}
                        {eq.notes && <div><strong>备注：</strong>{eq.notes}</div>}
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
      <Modal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)}>
        <h3>{editingCameraId ? '编辑相机' : '添加相机'}</h3>
        <form className="gear-modal-form" onSubmit={handleSaveCamera}>
          {!editingCameraId && (
            <div className="gear-preset-panel camera-builder-panel">
              <div className="builder-panel-heading">
                <div>
                  <strong>快速添加相机</strong>
                  <p>先选类型和画幅，再选品牌与型号；名称会自动填入，下方仍可继续补版本、颜色或昵称。</p>
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
                    重新选择相机
                  </button>
                </div>
              ) : (
                <>
                  <div className="builder-step">
                    <div className="builder-step-label">1. 相机类型</div>
                    <div className="preset-chip-grid">
                      {[
                        { value: 'film' as const, label: '胶片相机' },
                        { value: 'digital' as const, label: '数码相机' },
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
                    <div className="builder-step-label">2. 画幅格式</div>
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
                    <div className="builder-step-label">3. 推荐品牌 ({cameraBrandOptions.length})</div>
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
                      更换品牌
                    </button>
                  </div>
                    ) : (
                      <>
                        {cameraBrandOptions.length > 10 && (
                          <input
                            type="text"
                            className="form-control builder-option-search"
                            placeholder="搜索品牌，例如 Hasselblad / Nikon"
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
                            <span className="gear-preset-empty">没有匹配品牌。可以直接在下方手动输入。</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

	                  {selectedCameraBrand && (
	                    <div className="builder-step">
	                      <div className="builder-step-label">4. 选择推荐型号 ({cameraModelOptions.length})</div>
	                      {cameraModelOptions.length > 8 && (
	                        <input
	                          type="text"
	                          className="form-control builder-option-search"
	                          placeholder={`筛选 ${selectedCameraBrand} 推荐型号，不会保存输入`}
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
                            {preset.backType === 'interchangeable' ? ' · 可换后背' : ''}
                          </button>
	                        ))}
	                        {visibleCameraModelOptions.length === 0 && (
	                          <span className="gear-preset-empty">没有匹配型号。请在下方“相机名称”填写。</span>
	                        )}
	                      </div>
	                    </div>
	                  )}
	                  <div className="film-back-empty">推荐型号只是快速填入；没有对应型号时，直接在下方填写相机名称。</div>
                </>
              )}
            </div>
          )}
          {renderAvatarEditor(
            editingCameraId,
            'cameras',
            newCamera.avatarUrl,
            newCamera.name || '相机',
            getPlaceholderText(newCamera.name || 'Camera')
          )}
          <div className="form-group">
            <label>相机名称</label>
            <input
              type="text"
              className="form-control"
              placeholder="例如: Minolta X-700"
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
                <label>相机类型</label>
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
                  <option value="film">胶片相机</option>
                  <option value="digital">数码相机</option>
                </select>
              </div>
              <div className="form-group">
                <label>画幅格式</label>
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
                  <option value="135">135 画幅</option>
                  <option value="120">120 画幅</option>
                  <option value="largeFormat">大画幅</option>
                  <option value="digital">数码全画幅/残幅</option>
                </select>
              </div>
            </>
          )}

          {newCamera.format === '120' && (
            <div className="form-group">
              <label>120 后背模式</label>
              <select
                className="form-control"
                value={newCamera.backType || 'fixed'}
                onChange={e => setNewCamera({
                  ...newCamera,
                  backType: e.target.value as 'fixed' | 'interchangeable'
                })}
              >
                <option value="fixed">固定/非可换后背</option>
                <option value="interchangeable">可换后背/片盒</option>
              </select>
            </div>
          )}

          {newCamera.format === '120' && newCamera.backType === 'interchangeable' && (
            <div className="form-group">
              <div className="camera-system-guide">
                <strong>可换后背怎么记录？</strong>
                <p>同一套 120 系统下的多台机身会共享后背。新系统用于第一台机身；如果已经有同系统机身，就从已拥有系统中选择。</p>
              </div>

              <label>1. 选择相机系统</label>
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
                    新建一套系统
                  </button>
                  <button
                    type="button"
                    className={`system-mode-btn ${cameraSystemMode === 'existing' ? 'active' : ''}`}
                    onClick={() => {
                      setCameraSystemMode('existing');
                      setCameraBackNames([]);
                    }}
                  >
                    从已拥有系统中选择
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
                    placeholder="例如: Hasselblad V / Mamiya RB67"
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
                  <option value="">选择已有系统</option>
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
                        <div className="film-back-empty">这个系统还没有后背。</div>
                      ) : (
                        activeSystemFilmBacks.map(back => (
                          <div key={back.id} className="film-back-row">
                            <span>{back.name}</span>
                            <small>已存在</small>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <label>2. 后背/片盒</label>
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
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="film-back-add-row">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="例如: A12 Back"
                      value={newFilmBackName}
                      onChange={e => setNewFilmBackName(e.target.value)}
                    />
                    <button type="button" className="secondary" onClick={handleAddFilmBack}>+ 添加自定义后背</button>
                  </div>
                  <div className="film-back-empty">不新增也可以；如果使用已有系统，会直接共享该系统现有后背。</div>
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
                            移除
                          </button>
                        </div>
                      ))}
                  </div>
                  <div className="film-back-add-row">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="新增后背名称"
                      value={newFilmBackName}
                      onChange={e => setNewFilmBackName(e.target.value)}
                    />
                    <button type="button" className="secondary" onClick={handleAddFilmBack}>+ 添加后背</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label>购入价格 ({currencySymbol})</label>
            <input
              type="number"
              className="form-control"
              placeholder="例如: 3500 (选填)"
              value={newCamera.purchasePrice || ''}
              onChange={e => setNewCamera({...newCamera, purchasePrice: e.target.value ? Number(e.target.value) : undefined})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
            />
          </div>
          <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
              保存后继续添加
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsCameraModalOpen(false)}>取消</button>
              <button type="submit" className="primary">{editingCameraId ? '保存更改' : '添加'}</button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isLensModalOpen} onClose={() => setIsLensModalOpen(false)}>
        <h3>{editingLensId ? '编辑镜头' : '添加镜头'}</h3>
        <form className="gear-modal-form" onSubmit={handleSaveLens}>
          {!editingLensId && (
            <div className="gear-preset-panel">
              <div className="builder-panel-heading">
                <div>
                  <strong>快速添加镜头</strong>
                  <p>先缩小类型和卡口，再选品牌与型号；也可直接搜索焦段或型号。</p>
                </div>
                {newLens.name && <span className="builder-status-pill">{newLens.name}</span>}
              </div>
              {selectedLensModel && newLens.name ? (
                <div className="selected-builder-summary selected-gear-summary builder-collapsed-summary lens-builder-collapsed">
                  <span>{newLens.name}</span>
                  <small>{newLens.focalLength}mm · {newLens.maxAperture} · {newLens.mountKey || '未指定卡口'}</small>
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
                    重新选择镜头
                  </button>
                </div>
              ) : (
                <>
                  <div className="builder-step">
                    <div className="builder-step-label">1. 镜头类型</div>
                    <div className="preset-chip-grid">
                      {[
                        { value: 'prime' as const, label: '定焦' },
                        { value: 'zoom' as const, label: '变焦' },
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
                    <div className="builder-step-label">2. 卡口/系统</div>
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
                          更换卡口
                        </button>
	                      </div>
	                    ) : (
	                      <>
	                        {lensMountOptions.length > 10 && (
	                          <input
	                            type="text"
	                            className="form-control builder-option-search"
	                            placeholder="搜索卡口，例如 Leica M / Micro Four Thirds"
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
	                            <span className="gear-preset-empty">没有匹配卡口。可直接填写下方字段。</span>
	                          )}
	                        </div>
	                      </>
	                    )}
	                  </div>

                  <div className="builder-step">
                    <div className="builder-step-label">3. 推荐品牌 ({lensBrandOptions.length})</div>
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
                          更换品牌
                        </button>
                      </div>
                    ) : (
                      <>
                        {lensBrandOptions.length > 10 && (
                          <input
                            type="text"
                            className="form-control builder-option-search"
                            placeholder="搜索品牌，例如 Nikon / Leica"
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
                            <span className="gear-preset-empty">没有匹配品牌。可直接填写下方字段。</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {selectedLensBrand && (
                    <div className="builder-step">
                      <div className="builder-step-label">4. 推荐型号 ({lensModelOptions.length})</div>
                      {lensModelOptions.length > 8 && (
                        <input
                          type="text"
                          className="form-control builder-option-search"
                          placeholder={`在 ${selectedLensBrand} 中搜索型号、焦段或卡口`}
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
                          <span className="gear-preset-empty">没有匹配型号。可直接填写下方字段。</span>
                        )}
                      </div>
                    </div>
                  )}

                  <details className="builder-fallback-search">
                    <summary>直接搜索镜头</summary>
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                      <Search className="search-icon" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-control"
                        style={{ paddingLeft: 36, backgroundColor: 'var(--bg-secondary)' }}
                        placeholder="搜索品牌、型号或焦段，例如 50mm / Planar / Summicron"
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
                            <li className="gear-preset-empty">没有找到预设。可直接填写下方字段。</li>
                          ) : (
                            filteredLensPresets.map((preset, idx) => (
                              <li key={`${preset.brand}-${preset.model}-${idx}`} onClick={() => applyLensPreset(preset)}>
                                <div style={{ fontWeight: 700 }}>{preset.brand} {preset.model}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {preset.focalLength}mm · {preset.maxAperture} · {preset.type === 'prime' ? '定焦' : '变焦'} · {preset.mountKey}
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
              <div className="film-back-empty">预设只填表，保存后才入库。</div>
            </div>
          )}
          {renderAvatarEditor(
            editingLensId,
            'lenses',
            newLens.avatarUrl,
            newLens.name || '镜头',
            <LensSvgAvatar focalLength={Number(newLens.focalLength) || 50} type={newLens.type || 'prime'} size={72} />
          )}
          <div className="form-group">
            <label>镜头型号</label>
            <input
              type="text"
              className="form-control"
              placeholder="例如: MD 50mm f/1.7"
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
            <label>焦段 (mm)</label>
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
            <label>最大光圈</label>
            <input
              type="text"
              className="form-control"
              placeholder="例如: f/1.4"
              value={newLens.maxAperture}
              onChange={e => setNewLens({...newLens, maxAperture: e.target.value})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
              required
            />
          </div>
          {editingLensId && (
            <div className="form-group">
              <label>镜头类型</label>
              <select
                className="form-control"
                value={newLens.type}
                onChange={e => setNewLens({...newLens, type: e.target.value})}
                onKeyDown={handleKeyDown}
              >
                <option value="prime">定焦镜头 (Prime)</option>
                <option value="zoom">变焦镜头</option>
              </select>
            </div>
          )}
          <div className="form-group">
            <label>购入价格 ({currencySymbol})</label>
            <input
              type="number"
              className="form-control"
              placeholder="例如: 800 (选填)"
              value={newLens.purchasePrice || ''}
              onChange={e => setNewLens({...newLens, purchasePrice: e.target.value ? Number(e.target.value) : undefined})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
            />
          </div>
          <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
              保存后继续添加
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsLensModalOpen(false)}>取消</button>
              <button type="submit" className="primary">{editingLensId ? '保存更改' : '添加'}</button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isFilmModalOpen} onClose={() => setIsFilmModalOpen(false)}>
        <h3>{editingFilmId ? '编辑胶卷库存' : '入库胶卷'}</h3>
        <form className="gear-modal-form" onSubmit={handleSaveFilm}>
          {renderAvatarEditor(
            editingFilmId,
            'filmStocks',
            newFilm.avatarUrl,
            `${newFilm.brand || ''} ${newFilm.name || '胶卷'}`.trim(),
            <FilmSvgAvatar brand={newFilm.brand || 'Film'} name={newFilm.name || 'Stock'} format={newFilm.format || '135'} size={72} />
          )}
          {!editingFilmId && (
            <div className="gear-preset-panel">
              <div className="builder-panel-heading">
                <div>
                  <strong>快速添加胶卷</strong>
                  <p>先选画幅，再选品牌和型号；命中后收起选择区，继续填库存细节。</p>
                </div>
                {newFilm.brand && newFilm.name && (
                  <span className="builder-status-pill">{newFilm.brand} {newFilm.name}</span>
                )}
              </div>
              {newFilm.brand && newFilm.name ? (
                <div className="selected-builder-summary selected-gear-summary builder-collapsed-summary">
                  <span>{newFilm.brand} {newFilm.name}</span>
                  <small>ISO {newFilm.iso} · {newFilm.colorType === 'color' ? '彩色' : '黑白'} · {newFilm.format}</small>
                  <button
                    type="button"
                    className="secondary btn-sm"
                    onClick={() => {
                      setNewFilm({ brand: '', name: '', iso: 400, colorType: 'color', format: filmFormatFilter, stockCount: newFilm.stockCount, pricePerRoll: newFilm.pricePerRoll });
                      setSelectedFilmBrand('');
                      setFilmBrandSearch('');
                      setFilmModelSearch('');
                      setShowManualFilmForm(false);
                    }}
                  >
                    重新选择胶卷
                  </button>
                </div>
              ) : (
                <>
                  <div className="builder-step">
                    <div className="builder-step-label">1. 画幅格式</div>
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
                    <div className="builder-step-label">2. 推荐品牌 ({filmBrandOptions.length})</div>
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
                          更换品牌
                        </button>
                      </div>
                    ) : (
                      <>
                        {filmBrandOptions.length > 10 && (
                          <input
                            type="text"
                            className="form-control builder-option-search"
                            placeholder="搜索品牌，例如 Kodak / Ilford"
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
                            <span className="gear-preset-empty">没有匹配品牌。可直接填写下方字段。</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {selectedFilmBrand && (
                    <div className="builder-step">
                      <div className="builder-step-label">3. 推荐型号 ({filmModelOptions.length})</div>
                      {filmModelOptions.length > 8 && (
                        <input
                          type="text"
                          className="form-control builder-option-search"
                          placeholder={`在 ${selectedFilmBrand} 中搜索型号或 ISO`}
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
                          <span className="gear-preset-empty">没有匹配型号。可直接填写下方字段。</span>
                        )}
                      </div>
                    </div>
                  )}

                  <details className="builder-fallback-search">
                    <summary>直接搜索胶卷</summary>
                    <div className="search-input-wrapper">
                      <Search className="search-icon" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-control"
                        style={{ paddingLeft: 36, backgroundColor: 'var(--bg-tertiary)' }}
                        placeholder="搜索常见胶卷，例如 Gold 200 / HP5"
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
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ISO {f.iso} • {f.colorType === 'color' ? '彩色' : '黑白'} • {f.format}</div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </details>
                </>
              )}
            </div>
          )}

          {(!editingFilmId && !showManualFilmForm) ? (
            <div style={{ textAlign: 'center', margin: '8px 0 24px 0' }}>
              <button type="button" className="text-btn" onClick={() => setShowManualFilmForm(true)}>+ 找不到型号？展开手动填写</button>
            </div>
          ) : (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>手动配置参数</span>
                {!editingFilmId && <button type="button" className="text-btn" style={{ fontSize: '12px' }} onClick={() => setShowManualFilmForm(false)}>收起</button>}
              </div>
              <div className="form-group">
                <label>品牌/厂商</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="例如: Kodak"
                  value={newFilm.brand}
                  onChange={e => setNewFilm({...newFilm, brand: e.target.value})}
                  onKeyDown={handleKeyDown}
                  enterKeyHint="next"
                  required={showManualFilmForm || !!editingFilmId}
                />
              </div>
              <div className="form-group">
                <label>型号名称</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="例如: Gold 200"
                  value={newFilm.name}
                  onChange={e => setNewFilm({...newFilm, name: e.target.value})}
                  onKeyDown={handleKeyDown}
                  enterKeyHint="next"
                  required={showManualFilmForm || !!editingFilmId}
                />
              </div>
              <div className="form-group">
                <label>ISO 速度</label>
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
            </div>
          )}
          <div className="form-group">
            <label>初始库存数量</label>
            <input
              type="number"
              className="form-control"
              min="0"
              placeholder="可留空，默认为 0"
              value={newFilm.stockCount === undefined ? '' : newFilm.stockCount}
              onChange={e => setNewFilm({...newFilm, stockCount: e.target.value === '' ? undefined : parseInt(e.target.value, 10)})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
            />
          </div>
          <div className="form-group">
            <label>色彩类别</label>
            <select
              className="form-control"
              value={newFilm.colorType}
              onChange={e => setNewFilm({...newFilm, colorType: e.target.value as any})}
              onKeyDown={handleKeyDown}
            >
              <option value="color">彩色 (Color)</option>
              <option value="bw">黑白胶片</option>
            </select>
          </div>
          {editingFilmId && (
            <div className="form-group">
              <label>画幅大小</label>
              <select
                className="form-control"
                value={newFilm.format}
                onChange={e => setNewFilm({...newFilm, format: e.target.value})}
                onKeyDown={handleKeyDown}
              >
                <option value="135">135 画幅</option>
                <option value="120">120 中画幅</option>
              </select>
            </div>
          )}
          <div className="form-group">
            <label>购入均价/卷 ({currencySymbol})</label>
            <input
              type="number"
              className="form-control"
              placeholder="单卷价格, 例如: 85 (选填)"
              value={newFilm.pricePerRoll || ''}
              onChange={e => setNewFilm({...newFilm, pricePerRoll: e.target.value ? Number(e.target.value) : undefined})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
            />
          </div>
          <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
              保存后继续添加
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsFilmModalOpen(false)}>取消</button>
              <button type="submit" className="primary">{editingFilmId ? '保存更改' : '添加'}</button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEquipmentModalOpen} onClose={() => setIsEquipmentModalOpen(false)}>
        <h3>{editingEquipmentId ? '编辑器材' : '添加新器材'}</h3>
        <form onSubmit={handleSaveEquipment}>
          <div className="gear-context-note">
            如果要记录 120 后背或片盒，请回到相机库添加或编辑 120 可换后背机身；不要把它当作普通附件添加，否则装片统计无法关联到胶卷记录。
          </div>
          {renderAvatarEditor(
            editingEquipmentId,
            'otherEquipments',
            newEquipment.avatarUrl,
            newEquipment.name || '器材',
            <Package size={34} />
          )}
          <div className="form-group">
            <label>器材名称</label>
            <input
              type="text"
              className="form-control"
              placeholder="例如: D-76 显影粉 / 捷信三脚架"
              value={newEquipment.name}
              onChange={e => setNewEquipment({...newEquipment, name: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>器材类型</label>
            <select
              className="form-control"
              value={newEquipment.type}
              onChange={e => setNewEquipment({...newEquipment, type: e.target.value as any})}
              required
            >
              <option value="chemical">药水 / 化学品</option>
              <option value="tripod">三脚架</option>
              <option value="cleaner">清洁工具</option>
              <option value="other">其它</option>
            </select>
          </div>
          <div className="form-group">
            <label>购买时间</label>
            <input
              type="date"
              className="form-control"
              value={newEquipment.purchaseDate ? new Date(newEquipment.purchaseDate).toISOString().substring(0, 10) : ''}
              onChange={e => setNewEquipment({...newEquipment, purchaseDate: e.target.value ? new Date(e.target.value).getTime() : undefined})}
            />
          </div>
          {newEquipment.type === 'chemical' && (
            <div className="form-group">
              <label>药水保质期 / 过期日期</label>
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
            <label>购入价格 ({currencySymbol})</label>
            <input
              type="number"
              className="form-control"
              placeholder="例如: 350 (选填)"
              value={newEquipment.purchasePrice || ''}
              onChange={e => setNewEquipment({...newEquipment, purchasePrice: e.target.value ? Number(e.target.value) : undefined})}
            />
          </div>
          <div className="form-group">
            <label>备注 / 说明</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="关于该器材的额外备注..."
              value={newEquipment.notes}
              onChange={e => setNewEquipment({...newEquipment, notes: e.target.value})}
            />
          </div>
          <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={keepModalOpen} onChange={e => setKeepModalOpen(e.target.checked)} />
              保存后继续添加
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsEquipmentModalOpen(false)}>取消</button>
              <button type="submit" className="primary">{editingEquipmentId ? '保存更改' : '添加'}</button>
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
            <h3>归档或售出 ({archiveTarget?.name})</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
              归档后，此设备会被隐藏，但已关联的胶卷记录仍然可见。
            </p>
            <form onSubmit={handleArchiveConfirm}>
              <div className="form-group">
                <label>售出回血价格 ({currencySymbol})</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="如果售出，可填入回血金额 (选填)"
                  value={archivePrice}
                  onChange={e => setArchivePrice(e.target.value ? Number(e.target.value) : '')}
                />
                <small style={{ color: 'var(--text-muted)' }}>填入金额后，会在摄影账本里生成一笔收入记录。如果只是损坏后归档，可以留空。</small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => { setArchiveTarget(null); setArchivePrice(''); }}>取消</button>
                <button type="submit" className="warning">确认归档</button>
              </div>
            </form>
      </Modal>
    </div>
  );
};
