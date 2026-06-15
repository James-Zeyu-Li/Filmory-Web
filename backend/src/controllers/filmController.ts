import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../db';

/**
 * Gets all standard film stocks (excluding placeholders if required, or all).
 */
export const getFilms = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filmStocks = await prisma.filmStock.findMany({
      orderBy: { brand: 'asc' }
    });
    res.json({ filmStocks });
  } catch (error) {
    console.error('Failed to get film stocks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Updates/Adds inventory count for a specific FilmStock.
 */
export const updateFilmStock = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { amount } = req.body;

    if (isNaN(id) || amount === undefined || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Valid filmStock ID and amount (number) are required' });
    }

    const filmStock = await prisma.filmStock.findUnique({
      where: { id }
    });

    if (!filmStock) {
      return res.status(404).json({ error: 'Film stock not found' });
    }

    // Atomic update of stockCount
    const updated = await prisma.filmStock.update({
      where: { id },
      data: {
        stockCount: {
          increment: amount // Positive to increase, negative to decrease
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update film stock count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
