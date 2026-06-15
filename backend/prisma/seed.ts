import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clear existing data
  await prisma.photoAsset.deleteMany();
  await prisma.roll.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.lens.deleteMany();
  await prisma.filmStock.deleteMany();

  // 2. Create default cameras
  const m6 = await prisma.camera.create({
    data: {
      name: 'Leica M6',
      type: 'film',
      format: '135',
      notes: 'Classic rangefinder camera'
    }
  });

  const h500 = await prisma.camera.create({
    data: {
      name: 'Hasselblad 500CM',
      type: 'film',
      format: '120',
      notes: 'Medium format modular SLR'
    }
  });

  console.log(`✅ Created cameras: ${m6.name}, ${h500.name}`);

  // 3. Create default film stocks
  const gold200 = await prisma.filmStock.create({
    data: {
      brand: 'Kodak',
      name: 'Gold 200',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 0,
      stockCount: 5 // Default inventory
    }
  });

  const hp5 = await prisma.filmStock.create({
    data: {
      brand: 'Ilford',
      name: 'HP5 Plus 400',
      iso: 400,
      colorType: 'bw',
      format: '120',
      isSystem: 0,
      stockCount: 2 // Default inventory
    }
  });

  // Digital system placeholder
  const digitalPlaceholder = await prisma.filmStock.create({
    data: {
      brand: 'Generic',
      name: 'Digital',
      iso: 200,
      colorType: 'color',
      format: '135',
      isSystem: 1,
      systemKey: 'digital',
      stockCount: 999999 // System placeholder is infinite
    }
  });

  console.log(`✅ Created film stocks: ${gold200.brand} ${gold200.name}, ${hp5.brand} ${hp5.name}, ${digitalPlaceholder.name} (system)`);
  console.log('🌱 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
