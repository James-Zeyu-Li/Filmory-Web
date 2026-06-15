import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageService } from './IStorageService';

export class S3StorageService implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private endpoint?: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET || 'filmory';
    this.endpoint = process.env.S3_ENDPOINT; // e.g. "http://localhost:9000" for MinIO

    this.s3Client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
      // Force path style is crucial for MinIO to resolve bucket URLs correctly (http://localhost:9000/bucket)
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' || !!this.endpoint,
    });
  }

  async uploadFile(key: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );

    // If using a public bucket, we can construct the direct URL.
    // Otherwise, we could generate a presigned URL, or return the standard path.
    if (this.endpoint) {
      // Local MinIO format: http://localhost:9000/bucket/key
      return `${this.endpoint}/${this.bucketName}/${key}`;
    }
    
    // AWS S3 standard URL format: https://bucket.s3.region.amazonaws.com/key
    const region = process.env.S3_REGION || 'us-east-1';
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
    );
  }

  async getPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    
    // Generates a link valid for 1 hour (3600 seconds)
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }
}
