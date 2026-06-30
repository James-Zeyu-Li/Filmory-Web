import React, { useState, useRef, useEffect } from 'react';
import { db, type Camera, type Lens, type FilmStock, type OtherEquipment } from '../../db/schema';
import { Camera as CameraIcon, Plus, Trash2, SlidersHorizontal, Upload, X, Archive, Search, Aperture, Film, Package } from 'lucide-react';
import { COMMON_FILM_STOCKS } from './commonFilmStocks';
import { LensSvgAvatar } from '../../components/LensSvgAvatar';
import { FilmSvgAvatar } from '../../components/FilmSvgAvatar';
import './GearView.css';
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCameras, useLenses, useFilmStocks, useOtherEquipments } from '../../hooks/useData';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { IconButton } from '../../components/ui/IconButton';
import { motion } from 'framer-motion';
import { compressImageToBase64 } from '../../utils/imageService';
interface GearViewProps {
  enableFilmMode: boolean;
}

type SubTab = 'cameras' | 'lenses' | 'filmStocks' | 'otherEquipments';

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
  const [subTab, setSubTab] = useState<SubTab>('cameras');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isLensModalOpen, setIsLensModalOpen] = useState(false);
  const [isFilmModalOpen, setIsFilmModalOpen] = useState(false);
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
  const [showManualFilmForm, setShowManualFilmForm] = useState(false);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);

  // Forms state
  const [newCamera, setNewCamera] = useState<Partial<Camera>>({ name: '', type: 'film', format: '135', purchasePrice: undefined });
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
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const getAvatarFullUrl = (url?: string) => {
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

  const allCameras = useCameras();
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

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamera.name) return;

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
    
    await db.transaction('rw', db.cameras, db.ledgerTransactions, async () => {
      const currentUserId = user?.id || 'offline';
      
      if (editingCameraId) {
        // Update mode
        await db.cameras.update(editingCameraId, {
          name: newCamera.name!,
          type: newCamera.type as 'film' | 'digital',
          format: newCamera.format || '135',
          purchasePrice: newCamera.purchasePrice ? Number(newCamera.purchasePrice) : undefined,
        });

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
          purchasePrice: newCamera.purchasePrice ? Number(newCamera.purchasePrice) : undefined,
          addedAt: Date.now()
        });

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
      message: '确认彻底删除这台相机吗？财务流水可能受影响。\n提示：如果是闲鱼卖出，请使用归档(Archive)功能。',
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
      message: '确认彻底删除这支镜头吗？财务流水可能受影响。',
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
      message: '确认彻底删除这款胶卷吗？财务流水可能受影响。',
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
      message: '确认彻底删除这个器材吗？财务流水可能受影响。',
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
    setIsCameraModalOpen(true);
  };

  const openEditLens = (l: Lens) => {
    setEditingLensId(l.id!);
    setNewLens(l);
    setIsLensModalOpen(true);
  };

  const openEditFilm = (f: FilmStock) => {
    setEditingFilmId(f.id!);
    setNewFilm(f);
    setIsFilmModalOpen(true);
  };

  const openEditEquipment = (eq: OtherEquipment) => {
    setEditingEquipmentId(eq.id!);
    setNewEquipment(eq);
    setIsEquipmentModalOpen(true);
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
                {subTab === 'cameras' ? '相机 (Cameras)' : subTab === 'lenses' ? '镜头 (Lenses)' : subTab === 'filmStocks' ? '胶卷 (Film Stocks)' : '其他器材 (Accessories)'}
              </h1>
              <p className="view-header-subtitle">
                {subTab === 'cameras' ? '管理您的相机设备与机身。' : subTab === 'lenses' ? '管理您的镜头群与相关参数。' : subTab === 'filmStocks' ? '管理您的胶片库存与耗材。' : '管理三脚架、冲洗药水等附件。'}
              </p>
            </div>
          </motion.div>
        </div>
        <div className="view-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {subTab === 'cameras' && (
            <button className="primary" onClick={() => {
              setEditingCameraId(null);
              setNewCamera({ name: '', type: 'film', format: '135', purchasePrice: undefined });
              setIsCameraModalOpen(true);
            }}>
              <Plus size={16} /> <span>添加相机</span>
            </button>
          )}
          {subTab === 'lenses' && (
            <button className="primary" onClick={() => {
              setEditingLensId(null);
              setNewLens({ name: '', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' });
              setIsLensModalOpen(true);
            }}>
              <Plus size={16} /> <span>添加镜头</span>
            </button>
          )}
          {subTab === 'filmStocks' && enableFilmMode && (
            <button className="primary" onClick={() => {
              setEditingFilmId(null);
              setNewFilm({ brand: '', name: '', iso: 400, colorType: 'color', format: '135', stockCount: 0 });
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
                  action={<button className="primary" onClick={() => { setEditingCameraId(null); setIsCameraModalOpen(true); }}><Plus size={16} /> 添加相机</button>}
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
                  action={<button className="primary" onClick={() => { setEditingLensId(null); setIsLensModalOpen(true); }}><Plus size={16} /> 添加镜头</button>}
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
                  action={<button className="primary" onClick={() => { setEditingFilmId(null); setIsFilmModalOpen(true); }}><Plus size={16} /> 添加胶卷</button>}
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
          <div className="grid-layout">
            {otherEquipments.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
                <EmptyState 
                  icon={SlidersHorizontal}
                  title="整理摄影附件周边"
                  description="从暗房药水到三脚架，全面管理您的摄影耗材。"
                  action={<button className="primary" onClick={() => { setEditingEquipmentId(null); setIsEquipmentModalOpen(true); }}><Plus size={16} /> 登记附件</button>}
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
        )}
          </motion.div>
        </div>
      </div>

      {/* --- MODALS --- */}
      <Modal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)}>
        <h3>{editingCameraId ? '编辑相机' : '添加相机'}</h3>
        <form onSubmit={handleSaveCamera}>
          <div className="form-group">
            <label>相机名称</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="例如: Minolta X-700" 
              value={newCamera.name}
              onChange={e => setNewCamera({...newCamera, name: e.target.value})}
              onKeyDown={handleKeyDown}
              enterKeyHint="next"
              required 
            />
          </div>
          <div className="form-group">
            <label>相机类型</label>
            <select 
              className="form-control"
              value={newCamera.type}
              onChange={e => setNewCamera({...newCamera, type: e.target.value as any})}
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
              onChange={e => setNewCamera({...newCamera, format: e.target.value})}
              onKeyDown={handleKeyDown}
            >
              <option value="135">135 画幅</option>
              <option value="120">120 画幅</option>
              <option value="largeFormat">大画幅</option>
              <option value="digital">数码全画幅/残幅</option>
            </select>
          </div>
          <div className="form-group">
            <label>购入价格 (￥)</label>
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
        <form onSubmit={handleSaveLens}>
          <div className="form-group">
            <label>镜头型号</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="例如: MD 50mm f/1.7" 
              value={newLens.name}
              onChange={e => setNewLens({...newLens, name: e.target.value})}
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
          <div className="form-group">
            <label>购入价格 (￥)</label>
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
        <form onSubmit={handleSaveFilm}>
          {!editingFilmId && (
            <div className="form-group" style={{ position: 'relative', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <label>快速填入预设胶卷</label>
              <div className="search-input-wrapper">
                <Search className="search-icon" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ paddingLeft: 36, backgroundColor: 'var(--bg-tertiary)' }}
                  placeholder="搜索常见胶卷型号自动填入 (可选)..." 
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
                <ul className="custom-dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 1000, padding: 0, margin: 0, listStyle: 'none', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                  {COMMON_FILM_STOCKS.filter((f: any) => `${f.brand} ${f.name}`.toLowerCase().includes(filmDictSearch.toLowerCase())).map((f: any, idx: number) => (
                    <li key={idx} style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={() => {
                      setNewFilm({ ...newFilm, brand: f.brand, name: f.name, iso: f.iso, colorType: f.colorType as 'color'|'bw' });
                      setFilmDictSearch('');
                      setIsDictDropdownOpen(false);
                      setShowManualFilmForm(true);
                    }}>
                      <div style={{ fontWeight: 600 }}>{f.brand} {f.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ISO {f.iso} • {f.colorType === 'color' ? '彩色' : '黑白'}</div>
                    </li>
                  ))}
                </ul>
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
          <div className="form-group">
            <label>购入均价/卷 (￥)</label>
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
            <label>购入价格 (￥)</label>
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
              归档后，此设备将被隐藏，但相关联的拍摄卷依然可见。
            </p>
            <form onSubmit={handleArchiveConfirm}>
              <div className="form-group">
                <label>售出回血价格 (￥)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="如果售出，可填入回血金额 (选填)" 
                  value={archivePrice}
                  onChange={e => setArchivePrice(e.target.value ? Number(e.target.value) : '')}
                />
                <small style={{ color: 'var(--text-muted)' }}>填入金额将在财务账单中生成一笔收入流水。如果是损坏直接归档则留空即可。</small>
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
