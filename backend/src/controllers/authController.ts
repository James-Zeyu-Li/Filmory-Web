import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'filmory-super-secret-key';

/**
 * Handles user authentication and issues a JWT token.
 * This matches the structure that you can modify for your custom JWT study.
 */
export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Simple mock credentials check
  if (username === 'admin' && password === 'password') {
    const token = jwt.sign(
      { id: 1, username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      expiresIn: 86400, // 24 hours
    });
  }

  res.status(401).json({ error: 'Invalid username or password' });
};
