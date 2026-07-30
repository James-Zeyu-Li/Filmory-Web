import { describe, it, expect, vi } from 'vitest';
import {
  ROLL_COVER_PREVIEW_MAX_EDGE,
  compressImageToWebP,
  getBoundedImageSize,
} from '../utils/imageService';

// Mock window.URL
window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
window.URL.revokeObjectURL = vi.fn();

describe('Image Compression Service', () => {
  it('should constrain landscape images by the longest edge', () => {
    expect(getBoundedImageSize(4000, 3000, 400)).toEqual({ width: 400, height: 300 });
  });

  it('should constrain portrait images by the longest edge', () => {
    expect(getBoundedImageSize(3000, 4000, 400)).toEqual({ width: 300, height: 400 });
  });

  it('should preserve square images as square thumbnails', () => {
    expect(getBoundedImageSize(1200, 1200, 400)).toEqual({ width: 400, height: 400 });
  });

  it('should not upscale small images', () => {
    expect(getBoundedImageSize(320, 240, 400)).toEqual({ width: 320, height: 240 });
  });

  it('should compress a File into a WebP file using Canvas', async () => {
    // Create a fake large file
    const fakeContent = new Uint8Array(1024 * 1024 * 5); // 5MB
    const file = new File([fakeContent], 'test_photo.jpg', { type: 'image/jpeg' });

    // Since vitest-canvas-mock is active, we can just call it
    // Wait, Image loading is async, so we need to mock the Image constructor 
    // to instantly trigger 'onload' in jsdom.
    const originalImage = window.Image;
    window.Image = class extends originalImage {
      constructor() {
        super();
        setTimeout(() => {
          this.width = 4000;
          this.height = 3000;
          if (this.onload) this.onload(new Event('load'));
        }, 10);
      }
    };

    const compressedFile = await compressImageToWebP(file, ROLL_COVER_PREVIEW_MAX_EDGE);

    expect(compressedFile).toBeDefined();
    expect(compressedFile.type).toBe('image/webp');
    // Ensure original file name is preserved but extension changed
    expect(compressedFile.name).toBe('test_photo.webp');
    
    // Restore original Image
    window.Image = originalImage;
  });
});
