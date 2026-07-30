export const IMAGE_OUTPUT_MIME_TYPE = 'image/webp';
export const ROLL_COVER_PREVIEW_MAX_EDGE = 1920;
export const ROLL_COVER_PREVIEW_WEBP_QUALITY = 0.8;
export const GEAR_AVATAR_MAX_EDGE = 800;
export const GEAR_AVATAR_WEBP_QUALITY = 0.8;

export const getBoundedImageSize = (
  originalWidth: number,
  originalHeight: number,
  maxEdge: number
): { width: number; height: number } => {
  if (originalWidth <= 0 || originalHeight <= 0 || maxEdge <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(1, maxEdge / Math.max(originalWidth, originalHeight));

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  };
};

export const compressImageToWebP = async (
  file: File,
  maxEdge = ROLL_COVER_PREVIEW_MAX_EDGE,
  quality = ROLL_COVER_PREVIEW_WEBP_QUALITY
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const { width, height } = getBoundedImageSize(img.width, img.height, maxEdge);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: IMAGE_OUTPUT_MIME_TYPE,
                lastModified: Date.now(),
              });
              resolve(newFile);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          IMAGE_OUTPUT_MIME_TYPE,
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const compressImageToBase64 = async (
  file: File,
  maxEdge = GEAR_AVATAR_MAX_EDGE,
  quality = GEAR_AVATAR_WEBP_QUALITY
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const { width, height } = getBoundedImageSize(img.width, img.height, maxEdge);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Return Base64 data URL
        const dataUrl = canvas.toDataURL(IMAGE_OUTPUT_MIME_TYPE, quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};
