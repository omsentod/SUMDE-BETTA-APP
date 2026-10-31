import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  console.log('--- Migrating & Splitting Molly and Guppy ---');

  // Find Ikan Hias department
  const ikanHiasDept = await prisma.department.findUnique({
    where: { slug: 'ikan-hias' },
    include: { subCategories: true },
  });

  if (!ikanHiasDept) {
    console.log('Department ikan-hias not found. Nothing to migrate.');
    return;
  }

  // Check if old molly-guppy exists
  const combined = await prisma.subCategory.findUnique({
    where: {
      departmentId_slug: {
        departmentId: ikanHiasDept.id,
        slug: 'molly-guppy',
      },
    },
  });

  // Ensure Guppy exists
  const guppy = await prisma.subCategory.upsert({
    where: {
      departmentId_slug: {
        departmentId: ikanHiasDept.id,
        slug: 'guppy',
      },
    },
    update: {
      name: 'Guppy',
      image: '/img/tab-guppy.svg',
      orderIndex: 2,
    },
    create: {
      departmentId: ikanHiasDept.id,
      name: 'Guppy',
      slug: 'guppy',
      image: '/img/tab-guppy.svg',
      orderIndex: 2,
      description: 'Guppy strain murni (Albino Full Red, Dumbo Ear, Blue Diamond) dengan sirip ekor megah.',
    },
  });
  console.log(`- SubCategory Guppy ensured: ${guppy.id}`);

  // Ensure Molly exists
  const molly = await prisma.subCategory.upsert({
    where: {
      departmentId_slug: {
        departmentId: ikanHiasDept.id,
        slug: 'molly',
      },
    },
    update: {
      name: 'Molly',
      image: '/img/tab-molly.svg',
      orderIndex: 3,
    },
    create: {
      departmentId: ikanHiasDept.id,
      name: 'Molly',
      slug: 'molly',
      image: '/img/tab-molly.svg',
      orderIndex: 3,
      description: 'Balloon molly dan sailfin molly sehat dengan bentuk tubuh membulat dan warna cerah.',
    },
  });
  console.log(`- SubCategory Molly ensured: ${molly.id}`);

  // Also ensure Betta and Channa have their image paths
  await prisma.subCategory.updateMany({
    where: { departmentId: ikanHiasDept.id, slug: 'cupang-betta' },
    data: { image: '/img/tab-betta-multicolor.svg' },
  });
  await prisma.subCategory.updateMany({
    where: { departmentId: ikanHiasDept.id, slug: 'channa' },
    data: { image: '/img/tab-channa.svg' },
  });

  // If old combined exists and has products, reassign or remove
  if (combined) {
    const productsCount = await prisma.product.count({
      where: { subCategoryId: combined.id },
    });
    console.log(`Old molly-guppy has ${productsCount} products.`);
    if (productsCount > 0) {
      await prisma.product.updateMany({
        where: { subCategoryId: combined.id },
        data: { subCategoryId: guppy.id },
      });
      console.log(`Reassigned ${productsCount} products from molly-guppy to guppy.`);
    }
    await prisma.subCategory.delete({
      where: { id: combined.id },
    });
    console.log('Removed old combined molly-guppy subcategory.');
  }

  // Ensure department icons
  await prisma.department.updateMany({
    where: { slug: 'ikan-hias' },
    data: { icon: '/img/tab-dept-fish.svg' },
  });
  await prisma.department.updateMany({
    where: { slug: 'peralatan' },
    data: { icon: '/img/tab-dept-equipment.svg' },
  });
  await prisma.department.updateMany({
    where: { slug: 'pakan-obat' },
    data: { icon: '/img/tab-dept-feed.svg' },
  });

  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
  })
  .finally(() => prisma.$disconnect());

