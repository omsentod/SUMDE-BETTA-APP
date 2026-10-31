import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding 3-tier hierarchy (Department -> SubCategory -> Products)...');

  // 1. Departments (Level 1)
  const departmentsData = [
    {
      name: 'Ikan Hias',
      slug: 'ikan-hias',
      icon: '/img/tab-dept-fish.svg',
      isLiveFish: true,
      orderIndex: 0,
      description: 'Koleksi ikan hias pilihan berkualitas prima dengan garansi 100% aman (DOA).',
    },
    {
      name: 'Peralatan & Aquarium',
      slug: 'peralatan',
      icon: '/img/tab-dept-equipment.svg',
      isLiveFish: false,
      orderIndex: 1,
      description: 'Soliter kaca, sistem filtrasi, lampu LED, dan aksesoris perawatan aquarium.',
    },
    {
      name: 'Pakan & Obat',
      slug: 'pakan-obat',
      icon: '/img/tab-dept-feed.svg',
      isLiveFish: false,
      orderIndex: 2,
      description: 'Nutrisi pakan harian berprotein tinggi, ekstrak ketapang, dan vitamin perawatan air.',
    },
  ];

  const deptMap = {};

  for (const dept of departmentsData) {
    const record = await prisma.department.upsert({
      where: { slug: dept.slug },
      update: {
        name: dept.name,
        icon: dept.icon,
        isLiveFish: dept.isLiveFish,
        orderIndex: dept.orderIndex,
        description: dept.description,
      },
      create: dept,
    });
    deptMap[dept.slug] = record;
    console.log(`- Department: ${record.name} (${record.id})`);
  }

  // 2. SubCategories (Level 2)
  const subCategoriesData = [
    // Ikan Hias
    {
      departmentSlug: 'ikan-hias',
      name: 'Cupang (Betta)',
      slug: 'cupang-betta',
      image: '/img/tab-betta-multicolor.svg',
      orderIndex: 0,
      description: 'Koleksi cupang hias indukan murni, plakat, rosetail, halfmoon, dan crown tail.',
    },
    {
      departmentSlug: 'ikan-hias',
      name: 'Channa',
      slug: 'channa',
      image: '/img/tab-channa.svg',
      orderIndex: 1,
      description: 'Channa limbata, auranti, maru, dan pulchra grade pilihan dengan mental aktif.',
    },
    {
      departmentSlug: 'ikan-hias',
      name: 'Guppy',
      slug: 'guppy',
      image: '/img/tab-guppy.svg',
      orderIndex: 2,
      description: 'Guppy strain murni (Albino Full Red, Dumbo Ear, Blue Diamond) dengan sirip ekor megah.',
    },
    {
      departmentSlug: 'ikan-hias',
      name: 'Molly',
      slug: 'molly',
      image: '/img/tab-molly.svg',
      orderIndex: 3,
      description: 'Balloon molly dan sailfin molly sehat dengan bentuk tubuh membulat dan warna cerah.',
    },

    // Peralatan & Aquarium
    {
      departmentSlug: 'peralatan',
      name: 'Soliter & Aquarium',
      slug: 'soliter-aquarium',
      image: '/img/tab-sub-soliter.svg',
      orderIndex: 0,
      description: 'Soliter kaca bending, rimless glass aquarium, dan sekat cupang berkualitas.',
    },
    {
      departmentSlug: 'peralatan',
      name: 'Filter & Aerator',
      slug: 'filter-aerator',
      image: '/img/tab-sub-filter.svg',
      orderIndex: 1,
      description: 'Hang-on back filter, sponge filter, dan pompa udara silent hemat daya.',
    },
    {
      departmentSlug: 'peralatan',
      name: 'Lampu LED & Aksesoris',
      slug: 'lampu-led',
      image: null,
      orderIndex: 2,
      description: 'Lampu LED spektrum warna, jaring halus, dan selang aerasi food-grade.',
    },

    // Pakan & Obat
    {
      departmentSlug: 'pakan-obat',
      name: 'Pelet & Nutrisi Harian',
      slug: 'pelet-harian',
      image: '/img/tab-sub-feed.svg',
      orderIndex: 0,
      description: 'Pelet slow-sinking protein tinggi untuk pertumbuhan dan form sirip maksimal.',
    },
    {
      departmentSlug: 'pakan-obat',
      name: 'Pakan Beku & Kultur',
      slug: 'pakan-hidup-beku',
      image: null,
      orderIndex: 1,
      description: 'Cacing darah beku, jentik nyamuk sterilisasi ozon, dan artemia.',
    },
    {
      departmentSlug: 'pakan-obat',
      name: 'Vitamin & Ekstrak Air',
      slug: 'vitamin-obat-air',
      image: null,
      orderIndex: 2,
      description: 'Ekstrak daun ketapang laut murni olahan, garam ikan, dan anti-jamur.',
    },
  ];

  const subCatMap = {};

  for (const sub of subCategoriesData) {
    const parentDept = deptMap[sub.departmentSlug];
    if (!parentDept) continue;

    const record = await prisma.subCategory.upsert({
      where: {
        departmentId_slug: {
          departmentId: parentDept.id,
          slug: sub.slug,
        },
      },
      update: {
        name: sub.name,
        orderIndex: sub.orderIndex,
        description: sub.description,
        image: sub.image,
      },
      create: {
        departmentId: parentDept.id,
        name: sub.name,
        slug: sub.slug,
        orderIndex: sub.orderIndex,
        description: sub.description,
        image: sub.image,
      },
    });
    subCatMap[`${sub.departmentSlug}:${sub.slug}`] = record;
    console.log(`  - SubCategory [${parentDept.name}]: ${record.name} (${record.id})`);
  }

  // 3. Connect existing unassigned products to Ikan Hias -> Cupang (Betta)
  const bettaSubCat = subCatMap['ikan-hias:cupang-betta'];
  const ikanDept = deptMap['ikan-hias'];

  const updatedProducts = await prisma.product.updateMany({
    where: {
      OR: [
        { departmentId: null },
        { subCategoryId: null },
      ],
    },
    data: {
      departmentId: ikanDept.id,
      subCategoryId: bettaSubCat.id,
    },
  });

  console.log(`Assigned ${updatedProducts.count} existing products to Department [Ikan Hias] -> SubCategory [Cupang (Betta)]`);

  // 4. Seed sample equipment & feed products if not present
  const sampleEquipment = await prisma.product.findFirst({
    where: { name: 'Soliter Kaca Bening 15x15x20 cm' },
  });

  if (!sampleEquipment) {
    const soliterSub = subCatMap['peralatan:soliter-aquarium'];
    const peralatanDept = deptMap['peralatan'];
    await prisma.product.create({
      data: {
        name: 'Soliter Kaca Bening 15x15x20 cm',
        price: 45000,
        category: 'Soliter',
        form: 'Standard',
        coloration: 'Clear Glass',
        description: 'Soliter kaca bening 5mm tebal dengan lem rapi presisi. Sangat jernih untuk display ikan cupang dan pemotretan.',
        image: '/img/placeholder-equipment.svg',
        brand: 'Sumde Aquatics',
        weight: 1200, // 1.2 kg
        quantity: 25,
        departmentId: peralatanDept.id,
        subCategoryId: soliterSub.id,
        sizes: [
          { size: '15x15x20 cm', stock: 15, price: 45000 },
          { size: '20x20x25 cm', stock: 10, price: 65000 },
        ],
      },
    });
    console.log('Created sample product: Soliter Kaca Bening');
  }

  const sampleFeed = await prisma.product.findFirst({
    where: { name: 'Pelet Premium Color & Growth 50g' },
  });

  if (!sampleFeed) {
    const peletSub = subCatMap['pakan-obat:pelet-harian'];
    const pakanDept = deptMap['pakan-obat'];
    await prisma.product.create({
      data: {
        name: 'Pelet Premium Color & Growth 50g',
        price: 35000,
        category: 'Pelet',
        form: 'Micro Pellets',
        coloration: 'Natural Booster',
        description: 'Formula nutrisi mikro pelet lambat tenggelam dengan spirulina dan astaxanthin murni untuk mencerahkan warna alami ikan dan mempercepat pertumbuhan.',
        image: '/img/placeholder-feed.svg',
        brand: 'Sumde Vitality',
        weight: 150, // 150 grams
        quantity: 50,
        departmentId: pakanDept.id,
        subCategoryId: peletSub.id,
        sizes: [
          { size: '50 gram', stock: 30, price: 35000 },
          { size: '100 gram', stock: 20, price: 60000 },
        ],
      },
    });
    console.log('Created sample product: Pelet Premium Color & Growth');
  }

  console.log('Hierarchy seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding hierarchy:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

