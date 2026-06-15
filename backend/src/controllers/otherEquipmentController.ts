import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db';

/**
 * Get all other equipments. Supports filtering expired chemicals.
 */
export const getEquipments = async (req: AuthenticatedRequest, res: Response) => {
  const { expired } = req.query;
  try {
    let whereClause: any = {};
    if (expired === 'true') {
      whereClause = {
        type: 'chemical',
        expiryDate: {
          lt: new Date()
        }
      };
    }
    const equipments = await prisma.otherEquipment.findMany({
      where: whereClause,
      orderBy: { addedAt: 'desc' }
    });
    res.json({ equipments });
  } catch (error) {
    console.error('Failed to fetch equipments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a new other equipment.
 */
export const createEquipment = async (req: AuthenticatedRequest, res: Response) => {
  const { name, type, notes, purchaseDate, expiryDate } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  try {
    const equipment = await prisma.otherEquipment.create({
      data: {
        name,
        type,
        notes,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null
      }
    });
    res.status(201).json(equipment);
  } catch (error) {
    console.error('Failed to create equipment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update an existing other equipment.
 */
export const updateEquipment = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, type, notes, purchaseDate, expiryDate } = req.body;

  try {
    const equipment = await prisma.otherEquipment.update({
      where: { id: Number(id) },
      data: {
        name,
        type,
        notes,
        purchaseDate: purchaseDate !== undefined ? (purchaseDate ? new Date(purchaseDate) : null) : undefined,
        expiryDate: expiryDate !== undefined ? (expiryDate ? new Date(expiryDate) : null) : undefined
      }
    });
    res.json(equipment);
  } catch (error) {
    console.error('Failed to update equipment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete an other equipment.
 */
export const deleteEquipment = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.otherEquipment.delete({
      where: { id: Number(id) }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete equipment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
