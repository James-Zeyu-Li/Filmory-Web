import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/db';

let token = '';

beforeAll(async () => {
  // Set testing environment
  process.env.NODE_ENV = 'test';

  // 1. Clear database
  await prisma.photoAsset.deleteMany();
  await prisma.roll.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.filmStock.deleteMany();

  // 2. Create seed data for testing
  await prisma.camera.create({
    data: {
      id: 1,
      name: 'Test Leica M6',
      type: 'film',
      format: '135'
    }
  });

  await prisma.filmStock.create({
    data: {
      id: 1,
      brand: 'Kodak',
      name: 'Gold 200',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 1 // Start with exactly 1 in inventory
    }
  });

  await prisma.filmStock.create({
    data: {
      id: 2,
      brand: 'Generic',
      name: 'Digital',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 1,
      systemKey: 'digital',
      stockCount: 9999
    }
  });

  // 3. Log in to get JWT token
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'password' });
  
  token = response.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Film Stock Inventory & Transactional Roll Creation Tests', () => {
  
  test('Accessing protected endpoint without token should return 401', async () => {
    const response = await request(app).get('/api/cameras');
    expect(response.status).toBe(401);
  });

  test('Accessing protected endpoint with valid token should return 200', async () => {
    const response = await request(app)
      .get('/api/cameras')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.cameras.length).toBe(1);
  });

  test('Should list initial film stocks and verify Kodak Gold 200 stock is 1', async () => {
    const response = await request(app)
      .get('/api/films')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    const gold = response.body.filmStocks.find((f: any) => f.id === 1);
    expect(gold.stockCount).toBe(1);
  });

  test('Creating a Roll under normal stock should decrement stockCount and succeed', async () => {
    // Attempt creation
    const response = await request(app)
      .post('/api/rolls')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Normal Roll Test',
        cameraId: 1,
        filmStockId: 1
      });
    
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Normal Roll Test');

    // Verify stockCount is now 0
    const filmStock = await prisma.filmStock.findUnique({ where: { id: 1 } });
    expect(filmStock?.stockCount).toBe(0);
  });

  test('Creating a Roll when stockCount is 0 should fail with 400 (Transaction Rollback)', async () => {
    // Attempt creation again (stockCount is now 0)
    const response = await request(app)
      .post('/api/rolls')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Out of Stock Roll Test',
        cameraId: 1,
        filmStockId: 1
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Selected film stock is out of stock');

    // Verify that the second roll was NOT created in the DB (Transaction Rollback verified)
    const rollCount = await prisma.roll.count();
    expect(rollCount).toBe(1); // Only the first roll exists
  });

  test('Updating film stock via endpoint should modify stockCount correctly', async () => {
    const response = await request(app)
      .post('/api/films/1/stock')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5 });
    
    expect(response.status).toBe(200);
    expect(response.body.stockCount).toBe(5);

    const filmStock = await prisma.filmStock.findUnique({ where: { id: 1 } });
    expect(filmStock?.stockCount).toBe(5);
  });

  test('Creating roll with digital system stock should succeed and not decrement it', async () => {
    const response = await request(app)
      .post('/api/rolls')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Digital Roll Test',
        cameraId: 1,
        filmStockId: 2 // Digital
      });
    
    expect(response.status).toBe(201);

    // Verify digital stock did not change (isSystem === 1)
    const digitalStock = await prisma.filmStock.findUnique({ where: { id: 2 } });
    expect(digitalStock?.stockCount).toBe(9999);
  });
});
