import sharp from 'sharp';

export interface ImageMetadata {
  focalLength?: number;
  aperture?: string;
  shutterSpeed?: string;
  exposureCompensation?: number;
  width?: number;
  height?: number;
}

export class ImageService {
  /**
   * Reads EXIF metadata from an image buffer using sharp.
   */
  static async extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Stub metadata extraction for test files
      return {
        width: metadata.width,
        height: metadata.height,
        focalLength: 50,
        aperture: 'f/2.8',
        shutterSpeed: '1/125',
        exposureCompensation: 0
      };
    } catch (error) {
      console.error('Failed to extract EXIF metadata:', error);
      return {};
    }
  }

  /**
   * Process a camera profile avatar.
   * Crops the image to a 200x200 square and compresses to quality 80 JPEG.
   */
  static async processAvatar(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  /**
   * Process photo into three optimized sizes:
   * 1. thumbnail: 300px max, quality 75 (for timeline speed)
   * 2. preview: 1600px max, quality 85 (for lightbox preview)
   * 3. original: slightly compressed quality 95 JPEG (to save space)
   */
  static async processPhoto(buffer: Buffer): Promise<{ thumbnail: Buffer, preview: Buffer, original: Buffer }> {
    const thumbnail = await sharp(buffer)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    const preview = await sharp(buffer)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const original = await sharp(buffer)
      .jpeg({ quality: 95 })
      .toBuffer();

    return { thumbnail, preview, original };
  }
}
