import { supabase, supabaseUrl } from './supabaseClient';
import * as tus from 'tus-js-client';
import { getBoundedImageSize, IMAGE_OUTPUT_MIME_TYPE } from '../utils/imageService';

export interface UploadResult {
  storageKey: string;
  previewUrl: string;
  thumbnailUrl: string;
}

const PHOTO_BUCKET = 'grainfolio-assets';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const PHOTO_THUMBNAIL_MAX_EDGE = 400;
export const PHOTO_THUMBNAIL_WEBP_QUALITY = 0.6;

/**
 * 压缩图片，生成轻量级 Base64 缩略图
 */
export const generateThumbnail = (
  file: File,
  maxEdge = PHOTO_THUMBNAIL_MAX_EDGE,
  quality = PHOTO_THUMBNAIL_WEBP_QUALITY
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const { width, height } = getBoundedImageSize(img.width, img.height, maxEdge);
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 绘制压缩图
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(IMAGE_OUTPUT_MIME_TYPE, quality));
        } else {
          reject(new Error('Canvas context not available'));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * 核心引擎：将原图推上云端，并在本地生成极速缩略图
 * @param file 要上传的高清原文件
 * @param userId 租户 ID，用于云端隔离
 * @param rollId 归属的胶卷 ID
 */
export const uploadPhotoToCloud = async (
  file: File, 
  userId: string, 
  rollId: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> => {
  
  try {
    // 1. 生成极速缩略图
    const thumbnailUrl = await generateThumbnail(file);

    // 2. 构造绝对防冲撞的云端隔离路径: {userId}/{rollId}/{timestamp}_{filename}
    // 过滤掉文件名中可能引起 URL 解析错误的特殊字符
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${userId}/${rollId}/${Date.now()}_${safeFileName}`;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${token}`,
          'x-upsert': 'true',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: PHOTO_BUCKET,
          objectName: storageKey,
          contentType: file.type,
          cacheControl: '31536000',
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks
        onError: function (error) {
          reject(new Error(`[TUS Upload Failed] ${error.message}`));
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          if (onProgress) {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
            onProgress(percentage);
          }
        },
        onSuccess: function () {
          getSignedPhotoUrl(storageKey)
            .then((previewUrl) => {
              resolve({
                storageKey,
                previewUrl,
                thumbnailUrl
              });
            })
            .catch(reject);
        }
      });

      // 检查是否有之前未完成的上传
      upload.findPreviousUploads().then(function (previousUploads) {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  } catch (err) {
    console.error('Upload Error:', err);
    throw err;
  }
};

/**
 * 为私有 bucket 中的照片生成短期访问 URL。
 */
export const getSignedPhotoUrl = async (
  storageKey: string,
  expiresIn = SIGNED_URL_TTL_SECONDS
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(storageKey, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || '无法生成照片访问链接');
  }

  return data.signedUrl;
};

/**
 * 删除云端大图文件
 */
export const deletePhotoFromCloud = async (storageKey: string): Promise<void> => {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([storageKey]);
  if (error) {
    console.error('[Supabase Delete Failed]', error.message);
  }
};
