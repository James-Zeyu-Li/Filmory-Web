import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db';

/**
 * Gets all rolls ordered by id descending.
 */
export const getRolls = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rolls = await prisma.roll.findMany({
      orderBy: { id: 'desc' }
    });
    res.json({ rolls });
  } catch (error) {
    console.error('Failed to fetch rolls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Creates a new roll with transactional verification on film stock inventory.
 */
export const createRoll = async (req: AuthenticatedRequest, res: Response) => {
  const { name, cameraId, filmStockId, location, notes, filmPrice, developPrice } = req.body;

  if (!name || !cameraId || !filmStockId) {
    return res.status(400).json({ error: 'Name, cameraId, and filmStockId are required' });
  }

  try {
    // Run within database transaction to guarantee ACID atomic stock decrement and roll creation
    const newRoll = await prisma.$transaction(async (tx) => {
      // 1. Verify camera exists
      const camera = await tx.camera.findUnique({
        where: { id: Number(cameraId) }
      });
      if (!camera) {
        throw new Error('CAMERA_NOT_FOUND');
      }

      // 2. Verify film stock exists
      const film = await tx.filmStock.findUnique({
        where: { id: Number(filmStockId) }
      });
      if (!film) {
        throw new Error('FILM_NOT_FOUND');
      }

      // 3. Inventory checks:
      // Skip stock decrement if the film stock is a digital system placeholder.
      if (film.isSystem === 0) {
        if (film.stockCount <= 0) {
          throw new Error('OUT_OF_STOCK');
        }

        // Decrement inventory by 1
        await tx.filmStock.update({
          where: { id: film.id },
          data: {
            stockCount: {
              decrement: 1
            }
          }
        });
      }

      // 4. Create the Roll
      return tx.roll.create({
        data: {
          name,
          cameraId: Number(cameraId),
          filmStockId: Number(filmStockId),
          status: 'active',
          location,
          notes,
          filmPrice: filmPrice ? Number(filmPrice) : null,
          developPrice: developPrice ? Number(developPrice) : null
        }
      });
    });

    res.status(201).json(newRoll);
  } catch (error: any) {
    console.error('Error creating roll inside transaction:', error);

    // Map error identifiers to client JSON responses
    if (error.message === 'CAMERA_NOT_FOUND') {
      return res.status(400).json({ error: 'Selected camera not found' });
    }
    if (error.message === 'FILM_NOT_FOUND') {
      return res.status(400).json({ error: 'Selected film stock not found' });
    }
    if (error.message === 'OUT_OF_STOCK') {
      return res.status(400).json({ error: 'Selected film stock is out of stock' });
    }

    res.status(500).json({ error: 'Internal server error during transaction processing' });
  }
};

/**
 * Update an existing roll.
 */
export const updateRoll = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, cameraId, filmStockId, status, location, notes, developNotes, rating, filmPrice, developPrice } = req.body;

  try {
    const updatedRoll = await prisma.roll.update({
      where: { id: Number(id) },
      data: {
        name,
        cameraId: cameraId !== undefined ? Number(cameraId) : undefined,
        filmStockId: filmStockId !== undefined ? Number(filmStockId) : undefined,
        status,
        location,
        notes,
        developNotes,
        rating: rating !== undefined ? (rating ? Number(rating) : null) : undefined,
        filmPrice: filmPrice !== undefined ? (filmPrice ? Number(filmPrice) : null) : undefined,
        developPrice: developPrice !== undefined ? (developPrice ? Number(developPrice) : null) : undefined
      }
    });
    res.json(updatedRoll);
  } catch (error) {
    console.error('Failed to update roll:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

