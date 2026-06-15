import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db';

export const getLenses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lenses = await prisma.lens.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ lenses });
  } catch (error) {
    console.error('Failed to fetch lenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createLens = async (req: AuthenticatedRequest, res: Response) => {
  const { name, focalLength, maxAperture, type } = req.body;
  if (!name || !focalLength || !maxAperture || !type) {
    return res.status(400).json({ error: 'Name, focalLength, maxAperture, and type are required' });
  }

  try {
    const newLens = await prisma.lens.create({
      data: {
        name,
        focalLength: Number(focalLength),
        maxAperture,
        type
      }
    });
    res.status(201).json(newLens);
  } catch (error) {
    console.error('Failed to create lens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
