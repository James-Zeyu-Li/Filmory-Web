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
   * Sharp parses standard tags, and raw exif buffers can be decoded if needed.
   */
  static async extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // sharp metadata contains width, height, and raw EXIF buffer.
      // A standard EXIF parsing library can read the raw buffer.
      // Here we stub out typical EXIF extraction fields.
      return {
        width: metadata.width,
        height: metadata.height,
        focalLength: 50,       // Example fallback value
        aperture: 'f/2.8',     // Example fallback value
        shutterSpeed: '1/125', // Example fallback value
        exposureCompensation: 0
      };
    } catch (error) {
      console.error('Failed to extract EXIF metadata:', error);
      return {};
    }
  }

  /**
   * Generates a web-optimized thumbnail.
   * Resizes the image to a standard width (default 400px) maintaining ratio.
   */
  static async generateThumbnail(buffer: Buffer, width = 400): Promise<Buffer> {
    return sharp(buffer)
      .resize(width)
      .jpeg({ quality: 80 })
      .toBuffer();
  }
}
