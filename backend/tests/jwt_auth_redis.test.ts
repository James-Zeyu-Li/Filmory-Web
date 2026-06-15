import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/db';
import jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } from '../src/middleware/auth';

const mockStore = (global as any).redisMockStore;

describe('JWT Dual-Token Auth and Redis Integration Tests', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('POST /api/auth/login - should issue access and refresh tokens, and store refresh token in Redis', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    expect(response.body).toHaveProperty('token'); // alias
    expect(response.body.expiresIn).toBe(900);

    const refreshToken = response.body.refreshToken;
    // Verify refresh token signature
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: number };
    expect(decoded.id).toBe(1);

    // Verify it was saved to our mock Redis store
    expect(mockStore.has(`refresh_token:${refreshToken}`)).toBe(true);
    expect(mockStore.get(`refresh_token:${refreshToken}`)).toBe('1');
  });

  test('Expired/Invalid Access Token - should fail with 403 when accessing protected routes', async () => {
    // 1. Invalid Token
    const resInvalid = await request(app)
      .get('/api/cameras')
      .set('Authorization', 'Bearer invalid-token');
    expect(resInvalid.status).toBe(403);
    expect(resInvalid.body.error).toContain('Forbidden');

    // 2. Expired Token
    const expiredToken = jwt.sign(
      { id: 1, username: 'admin' },
      JWT_ACCESS_SECRET,
      { expiresIn: '-1s' } // already expired
    );
    const resExpired = await request(app)
      .get('/api/cameras')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(resExpired.status).toBe(403);
    expect(resExpired.body.error).toContain('Forbidden');
  });

  test('POST /api/auth/refresh - should rotate refresh token and issue new access token', async () => {
    // 1. Login first to get initial tokens
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });
    
    const initialAccessToken = loginRes.body.accessToken;
    const initialRefreshToken = loginRes.body.refreshToken;

    // 2. Request refresh using initial refresh token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('accessToken');
    expect(refreshRes.body).toHaveProperty('refreshToken');
    expect(refreshRes.body.expiresIn).toBe(900);

    const newAccessToken = refreshRes.body.accessToken;
    const newRefreshToken = refreshRes.body.refreshToken;

    expect(newAccessToken).not.toBe(initialAccessToken);
    expect(newRefreshToken).not.toBe(initialRefreshToken);

    // 3. Verify Redis has new token and deleted old token
    expect(mockStore.has(`refresh_token:${newRefreshToken}`)).toBe(true);
    expect(mockStore.has(`refresh_token:${initialRefreshToken}`)).toBe(false);

    // 4. Using old refresh token again should fail (RTR check)
    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefreshToken });
    expect(replayRes.status).toBe(403);
  });

  test('POST /api/auth/logout - should delete session from Redis and invalidate refresh token', async () => {
    // 1. Login to get tokens
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });
    
    const refreshToken = loginRes.body.refreshToken;
    expect(mockStore.has(`refresh_token:${refreshToken}`)).toBe(true);

    // 2. Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });
    
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toContain('success');

    // 3. Verify deleted from mock Redis
    expect(mockStore.has(`refresh_token:${refreshToken}`)).toBe(false);

    // 4. Try refresh, should fail
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(403);
  });
});
