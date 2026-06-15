import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db';
import { ImageService } from '../services/imageService';
import { StorageFactory } from '../services/StorageFactory';

export const getCameras = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cameras = await prisma.camera.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ cameras });
  } catch (error) {
    console.error('Failed to fetch cameras:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCamera = async (req: AuthenticatedRequest, res: Response) => {
  const { name, type, format, notes } = req.body;
  if (!name || !type || !format) {
    return res.status(400).json({ error: 'Name, type, and format are required' });
  }

  try {
    const newCamera = await prisma.camera.create({
      data: {
        name,
        type,
        format,
        notes
      }
    });
    res.status(201).json(newCamera);
  } catch (error) {
    console.error('Failed to create camera:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle camera avatar image upload.
 */
export const uploadCameraAvatar = async (req: AuthenticatedRequest, res: any) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No avatar file provided' });
  }

  try {
    // 1. Verify camera exists
    const camera = await prisma.camera.findUnique({
      where: { id: Number(id) }
    });
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    // 2. Process image buffer to 200x200 jpeg
    const processedBuffer = await ImageService.processAvatar(req.file.buffer);

    // 3. Upload to storage
    const storageService = StorageFactory.getStorageService();
    const filename = `camera_${id}_${Date.now()}.jpg`;
    const key = `avatars/${filename}`;
    const avatarUrl = await storageService.uploadFile(key, processedBuffer, 'image/jpeg');

    // 4. Delete old avatar file to avoid leaks
    if (camera.avatarUrl) {
      const oldKey = camera.avatarUrl.includes('/uploads/') 
        ? camera.avatarUrl.split('/uploads/')[1] 
        : camera.avatarUrl.split('/').slice(-2).join('/');
      
      try {
        await storageService.deleteFile(oldKey);
      } catch (delError) {
        console.error('Failed to delete old avatar file:', delError);
      }
    }

    // 5. Update database record
    const updatedCamera = await prisma.camera.update({
      where: { id: Number(id) },
      data: { avatarUrl }
    });

    res.json(updatedCamera);
  } catch (error) {
    console.error('Failed to upload camera avatar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
