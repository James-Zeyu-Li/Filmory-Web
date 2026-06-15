import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/db';

let token = '';
let createdEquipmentId = 0;
let createdRollId = 0;

beforeAll(async () => {
  // Set testing environment
  process.env.NODE_ENV = 'test';

  // 1. Clear database
  await prisma.photoAsset.deleteMany();
  await prisma.roll.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.filmStock.deleteMany();
  await prisma.otherEquipment.deleteMany();

  // 2. Create testing camera and film stock for Roll creation reference
  await prisma.camera.create({
    data: {
      id: 1,
      name: 'Test Camera',
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
      stockCount: 10
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

describe('Other Equipment CRUD & Roll Notepad Integration Tests', () => {

  test('POST /api/equipments - should create a new equipment asset', async () => {
    const response = await request(app)
      .post('/api/equipments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'D-76 Developer',
        type: 'chemical',
        notes: 'Classic black and white developer',
        purchaseDate: new Date('2026-06-01').toISOString(),
        expiryDate: new Date('2026-12-01').toISOString()
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('D-76 Developer');
    expect(response.body.type).toBe('chemical');
    createdEquipmentId = response.body.id;
  });

  test('POST /api/equipments - should fail to create if name or type is missing', async () => {
    const response = await request(app)
      .post('/api/equipments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        notes: 'Missing name and type'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Name and type are required');
  });

  test('GET /api/equipments - should list all equipment assets', async () => {
    const response = await request(app)
      .get('/api/equipments')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.equipments.length).toBe(1);
    expect(response.body.equipments[0].id).toBe(createdEquipmentId);
  });

  test('GET /api/equipments?expired=true - should filter expired chemicals', async () => {
    // 1. Create an expired chemical (expiryDate set in past relative to 2026-06)
    await request(app)
      .post('/api/equipments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Expired Rodinal',
        type: 'chemical',
        notes: 'Old developer',
        purchaseDate: new Date('2025-01-01').toISOString(),
        expiryDate: new Date('2025-06-01').toISOString()
      });

    // 2. Fetch all
    const allResponse = await request(app)
      .get('/api/equipments')
      .set('Authorization', `Bearer ${token}`);
    expect(allResponse.body.equipments.length).toBe(2);

    // 3. Fetch only expired
    const expiredResponse = await request(app)
      .get('/api/equipments?expired=true')
      .set('Authorization', `Bearer ${token}`);
    expect(expiredResponse.status).toBe(200);
    expect(expiredResponse.body.equipments.length).toBe(1);
    expect(expiredResponse.body.equipments[0].name).toBe('Expired Rodinal');
  });

  test('PUT /api/equipments/:id - should update an equipment asset', async () => {
    const response = await request(app)
      .put(`/api/equipments/${createdEquipmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'D-76 Developer (Updated)',
        notes: 'Updated notes'
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('D-76 Developer (Updated)');
    expect(response.body.notes).toBe('Updated notes');
  });

  test('DELETE /api/equipments/:id - should delete an equipment asset', async () => {
    const response = await request(app)
      .delete(`/api/equipments/${createdEquipmentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const check = await prisma.otherEquipment.findUnique({ where: { id: createdEquipmentId } });
    expect(check).toBeNull();
  });

  test('Roll developNotes integration - should create and then update developNotes via PUT /api/rolls/:id', async () => {
    // 1. Create a roll
    const createRes = await request(app)
      .post('/api/rolls')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Roll to test Notepad',
        cameraId: 1,
        filmStockId: 1
      });
    expect(createRes.status).toBe(201);
    createdRollId = createRes.body.id;
    expect(createRes.body.developNotes).toBeNull();

    // 2. Update roll developNotes
    const updateRes = await request(app)
      .put(`/api/rolls/${createdRollId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        developNotes: 'D-76 1:1, 20C, 9:30min',
        location: 'Updated location'
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.developNotes).toBe('D-76 1:1, 20C, 9:30min');
    expect(updateRes.body.location).toBe('Updated location');

    // 3. Verify in database
    const dbRoll = await prisma.roll.findUnique({ where: { id: createdRollId } });
    expect(dbRoll?.developNotes).toBe('D-76 1:1, 20C, 9:30min');
  });
});
