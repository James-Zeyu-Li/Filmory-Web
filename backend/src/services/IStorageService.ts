export interface IStorageService {
  /**
   * Uploads a file buffer to storage.
   * @param key Unique key/path for the file in storage (e.g. "avatars/camera_1.jpg")
   * @param fileBuffer File binary buffer
   * @param mimeType MIME type of the file (e.g. "image/jpeg")
   * @returns Absolute or relative URL/path to access the uploaded file
   */
  uploadFile(key: string, fileBuffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Deletes a file from storage by its key.
   * @param key Key/path of the file in storage
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Generates a temporary access URL for secure uploading or viewing.
   * @param key Key/path of the file in storage
   * @returns Pre-signed URL string
   */
  getPresignedUrl(key: string): Promise<string>;
}
