import { describe, it, expect, vi } from 'vitest';
import { compressImageToWebP } from '../utils/imageService';

// Mock window.URL
window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
window.URL.revokeObjectURL = vi.fn();

describe('Image Compression Service', () => {
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

    const compressedFile = await compressImageToWebP(file);

    expect(compressedFile).toBeDefined();
    expect(compressedFile.type).toBe('image/webp');
    // Ensure original file name is preserved but extension changed
    expect(compressedFile.name).toBe('test_photo.webp');
    
    // Restore original Image
    window.Image = originalImage;
  });
});
