import fs from 'fs/promises';
import path from 'path';
import { IStorageService } from './IStorageService';

export class LocalDiskStorageService implements IStorageService {
  private baseDir: string;
  private relativeUrlPrefix: string;

  constructor() {
    // Save to <backend-root>/uploads
    this.baseDir = path.join(process.cwd(), 'uploads');
    this.relativeUrlPrefix = '/uploads';
  }

  /**
   * Helper to ensure the directory for a given key exists.
   */
  private async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async uploadFile(key: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    const fullPath = path.join(this.baseDir, key);
    await this.ensureDir(fullPath);
    await fs.writeFile(fullPath, fileBuffer);
    
    // Return relative URL e.g. "/uploads/avatars/camera_1.jpg"
    return `${this.relativeUrlPrefix}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    const fullPath = path.join(this.baseDir, key);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.code !== 'ENOENT') {
        console.error(`Failed to delete local file: ${fullPath}`, error);
        throw error;
      }
    }
  }

  async getPresignedUrl(key: string): Promise<string> {
    // Local disk serves files directly, no true pre-signing.
    // Return relative path or host URL.
    const port = process.env.PORT || 8080;
    return `http://localhost:${port}${this.relativeUrlPrefix}/${key}`;
  }
}
