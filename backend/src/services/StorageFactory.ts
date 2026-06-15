import { IStorageService } from './IStorageService';
import { LocalDiskStorageService } from './LocalDiskStorageService';
import { S3StorageService } from './S3StorageService';

export class StorageFactory {
  private static instance: IStorageService | null = null;

  /**
   * Retrieves or instantiates the configured storage service singleton.
   */
  public static getStorageService(): IStorageService {
    if (!StorageFactory.instance) {
      const provider = process.env.STORAGE_PROVIDER || 'local';
      
      if (provider.toLowerCase() === 's3') {
        StorageFactory.instance = new S3StorageService();
      } else {
        StorageFactory.instance = new LocalDiskStorageService();
      }
    }
    
    return StorageFactory.instance;
  }
}
