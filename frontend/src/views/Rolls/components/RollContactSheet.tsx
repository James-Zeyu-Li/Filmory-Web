import React, { useRef, useState } from 'react';
import { Film as FilmIcon, ImagePlus } from 'lucide-react';
import { EmptyState } from '../../../components/EmptyState';
import { Modal } from '../../../components/Modal';
import { StarRating } from '../../../components/StarRating';
import { useAuth } from '../../../contexts/useAuth';
import { useFeedback } from '../../../contexts/useFeedback';
import { useTrialGate } from '../../../contexts/useTrialGate';
import { useLanguage } from '../../../contexts/useLanguage';
import { usePhotoAssets, useFilmStocks } from '../../../hooks/useData';
import { db, type Roll, type PhotoAsset } from '../../../db/schema';
import {
  ROLL_COVER_PREVIEW_MAX_EDGE,
  ROLL_COVER_PREVIEW_WEBP_QUALITY,
  compressImageToWebP,
} from '../../../utils/imageService';
import { deletePhotoFromCloud, uploadPhotoToCloud } from '../../../services/storageService';
import {
  commitUploadedContactSheetPhoto,
  saveDeferredContactSheetPhoto,
} from '../../../services/photoUploadRecoveryService';
import { SyncService } from '../../../services/syncService';
import { requestImmediateSync } from '../../../services/syncEvents';
import { resolveFilmEdgePreset } from '../../../services/filmEdgePresetService';
import './RollContactSheet.css';

interface RollContactSheetProps {
  roll: Roll;
}

export const RollContactSheet: React.FC<RollContactSheetProps> = ({ roll }) => {
  const { user, authMode } = useAuth();
  const { notify } = useFeedback();
  const { requireRegistration } = useTrialGate();
  const { t } = useLanguage();
  const allPhotos = usePhotoAssets();
  const filmStocks = useFilmStocks();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);

  // The cover photo (isPinned: 1) is a separate single-slot concept managed by
  // the existing cover-upload section above this view — never show it twice.
  const photos = allPhotos
    .filter(photo => photo.rollId === roll.id && photo.isPinned !== 1)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const { format, preset } = resolveFilmEdgePreset(roll, filmStocks);
  const previewPhoto = photos.find(photo => photo.id === previewPhotoId) ?? null;

  const handleRate = (photo: PhotoAsset, rating: number | undefined) => {
    if (!photo.id) return;
    void db.photoAssets.update(photo.id, { rating });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !roll.id) return;
    if (authMode === 'trial') {
      requireRegistration('photos');
      return;
    }

    setIsUploading(true);
    let uploadedStorageKey: string | undefined;
    let cloudAssetCommitted = false;

    try {
      const webpFile = await compressImageToWebP(file, ROLL_COVER_PREVIEW_MAX_EDGE, ROLL_COVER_PREVIEW_WEBP_QUALITY);
      const photoId = crypto.randomUUID();
      const currentUserId = user?.id || 'offline';

      let uploadResult: Awaited<ReturnType<typeof uploadPhotoToCloud>> | null = null;
      const cloudUploadPending = Boolean(user && SyncService.isAutoSyncEnabled());
      let isDeferredCloudUpload = false;
      if (user) {
        try {
          uploadResult = await uploadPhotoToCloud(webpFile, user.id, roll.id, undefined, photoId);
          uploadedStorageKey = uploadResult.storageKey;
        } catch (err) {
          isDeferredCloudUpload = cloudUploadPending;
          if (isDeferredCloudUpload) {
            console.error('Cloud upload failed; keeping this photo local until it can be retried.', err);
            notify({
              type: 'error',
              title: t('rollContactSheet.uploadFailedTitle'),
              message: t('rollContactSheet.uploadDeferredMessage'),
            });
          }
        }
      }

      const photoAsset: PhotoAsset = {
        id: photoId,
        userId: currentUserId,
        rollId: roll.id,
        originalFileName: file.name,
        fileSize: webpFile.size,
        blob: uploadResult ? undefined : webpFile,
        cloudUploadPending: isDeferredCloudUpload,
        cloudUploadError: isDeferredCloudUpload ? t('rollContactSheet.uploadDeferredMessage') : undefined,
        storageKey: uploadResult?.storageKey,
        previewUrl: uploadResult?.previewUrl,
        thumbnailUrl: uploadResult?.thumbnailUrl,
        addedAt: Date.now(),
        isPinned: 0,
        orderIndex: photos.length,
      };

      if (!uploadResult) {
        await saveDeferredContactSheetPhoto(photoAsset);
      } else {
        await commitUploadedContactSheetPhoto(photoAsset);
        cloudAssetCommitted = true;
        requestImmediateSync('roll-contact-sheet-upload');
      }
    } catch (error) {
      console.error(error);
      if (uploadedStorageKey && !cloudAssetCommitted) {
        try {
          await deletePhotoFromCloud(uploadedStorageKey);
        } catch (cleanupError) {
          console.error('Failed to roll back an uncommitted contact-sheet upload:', cleanupError);
        }
      }
      notify({
        type: 'error',
        title: t('rollContactSheet.uploadFailedTitle'),
        message: t('rollContactSheet.uploadProcessingFailedMessage'),
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`roll-contact-sheet roll-contact-sheet-${format}`}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => { void handleFileSelect(event); }} hidden />

      {photos.length === 0 ? (
        <EmptyState
          compact
          icon={FilmIcon}
          title={t('rollContactSheet.emptyTitle')}
          description={t('rollContactSheet.emptyDescription')}
          action={
            <button
              type="button"
              className="primary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <ImagePlus size={16} />
              {isUploading ? t('rollContactSheet.uploading') : t('rollContactSheet.addPhoto')}
            </button>
          }
        />
      ) : (
        <>
          <div className="roll-contact-sheet-toolbar">
            <span className="roll-contact-sheet-count">{t('rollContactSheet.photoCount', { count: photos.length })}</span>
            <button
              type="button"
              className="secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <ImagePlus size={16} />
              {isUploading ? t('rollContactSheet.uploading') : t('rollContactSheet.addPhoto')}
            </button>
          </div>
          <div className="roll-contact-sheet-strip">
            {photos.map(photo => (
              <div key={photo.id} className="roll-contact-sheet-frame">
                <span className="roll-contact-sheet-edge-text" aria-hidden="true">{preset.topText}</span>
                <button
                  type="button"
                  className="roll-contact-sheet-frame-image"
                  onClick={() => setPreviewPhotoId(photo.id ?? null)}
                  aria-label={t('rollContactSheet.openPreview')}
                >
                  {(photo.thumbnailUrl || photo.previewUrl) && (
                    <img src={photo.thumbnailUrl || photo.previewUrl} alt="" decoding="async" />
                  )}
                </button>
                <span className="roll-contact-sheet-edge-text" aria-hidden="true">{preset.bottomText}</span>
                <StarRating
                  rating={photo.rating}
                  onChange={(rating) => handleRate(photo, rating)}
                  groupLabel={t('rollContactSheet.rateGroupLabel')}
                  getStarLabel={(value) => t('rollContactSheet.rateStarLabel', { count: value })}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <Modal isOpen={Boolean(previewPhoto)} onClose={() => setPreviewPhotoId(null)}>
        {previewPhoto && (
          <div className="roll-contact-sheet-preview">
            {(previewPhoto.previewUrl || previewPhoto.thumbnailUrl) && (
              <img src={previewPhoto.previewUrl || previewPhoto.thumbnailUrl} alt="" decoding="async" />
            )}
            <StarRating
              rating={previewPhoto.rating}
              onChange={(rating) => handleRate(previewPhoto, rating)}
              size={22}
              groupLabel={t('rollContactSheet.rateGroupLabel')}
              getStarLabel={(value) => t('rollContactSheet.rateStarLabel', { count: value })}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
