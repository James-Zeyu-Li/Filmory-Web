import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db';

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
