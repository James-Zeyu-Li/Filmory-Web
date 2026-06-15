import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from '../db/redis';
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } from '../middleware/auth';

const ACCESS_TOKEN_EXPIRY = 900; // 15 minutes (in seconds)
const REFRESH_TOKEN_EXPIRY_SEC = 7 * 24 * 60 * 60; // 7 days (in seconds)

/**
 * Handles user authentication and issues an Access Token & Refresh Token.
 */
export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Simple mock credentials check
  if (username === 'admin' && password === 'password') {
    const userId = 1;
    const accessToken = jwt.sign(
      { id: userId, username, rnd: Math.random().toString(36).substring(2) },
      JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: userId, rnd: Math.random().toString(36).substring(2) },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Save refresh token to Redis with 7 days expiration
    await redis.set(`refresh_token:${refreshToken}`, String(userId), 'EX', REFRESH_TOKEN_EXPIRY_SEC);

    return res.json({
      accessToken,
      refreshToken,
      token: accessToken, // Alias for backward compatibility with existing tests
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  }

  res.status(401).json({ error: 'Invalid username or password' });
};

/**
 * Rotates the Refresh Token and issues a new Access Token.
 */
export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    // 1. Verify the signature of the refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: number };
    const userId = decoded.id;

    // 2. Check if the refresh token exists in Redis
    const tokenExists = await redis.get(`refresh_token:${refreshToken}`);
    if (!tokenExists) {
      return res.status(403).json({ error: 'Forbidden: Invalid or expired refresh token' });
    }

    // 3. Perform Refresh Token Rotation (RTR)
    const newAccessToken = jwt.sign(
      { id: userId, username: 'admin', rnd: Math.random().toString(36).substring(2) },
      JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { id: userId, rnd: Math.random().toString(36).substring(2) },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Store new token in Redis and delete the old one
    await redis.set(`refresh_token:${newRefreshToken}`, String(userId), 'EX', REFRESH_TOKEN_EXPIRY_SEC);
    await redis.del(`refresh_token:${refreshToken}`);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired refresh token' });
  }
};

/**
 * Revokes the Refresh Token session in Redis.
 */
export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  // Delete the refresh token from Redis
  await redis.del(`refresh_token:${refreshToken}`);

  return res.json({ message: 'Logged out successfully' });
};
