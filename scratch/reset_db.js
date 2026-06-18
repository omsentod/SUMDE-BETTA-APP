import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up tables...');
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  console.log('Tables cleaned. Running seed...');
  
  await prisma.product.createMany({
    data: [
      {
        name: 'Halfmoon Blue Marble',
        price: 150000,
        category: 'Ikan Cupang',
        gender: 'Jantan',
        form: 'Halfmoon',
        coloration: 'Blue Marble',
        description: 'Ikan cupang halfmoon dengan warna blue marble yang memukau. Sirip mengembang sempurna membentuk setengah lingkaran 180°. Cocok untuk kontes maupun koleksi pribadi.',
        image: '/betta-1.png',
        isPremium: true,
        statsForm: '9.5/10',
        statsColor: '9.0/10',
        statsSpirit: 'Agresif',
        quantity: 5,
        sizes: [
          { size: 'M', quantity: 3 },
          { size: 'M+', quantity: 2 }
        ]
      },
      {
        name: 'Crowntail Red Dragon',
        price: 120000,
        category: 'Ikan Cupang',
        gender: 'Jantan',
        form: 'Crowntail',
        coloration: 'Red Dragon',
        description: 'Cupang crowntail dengan warna merah menyala dan sisik dragon yang tegas. Ekor bercabang-cabang seperti mahkota memberikan kesan gagah dan eksotis.',
        image: '/betta-2.png',
        isPremium: false,
        statsForm: '9.0/10',
        statsColor: '9.5/10',
        statsSpirit: 'Aktif',
        quantity: 3,
        sizes: [
          { size: 'S', quantity: 1 },
          { size: 'M', quantity: 2 }
        ]
      },
      {
        name: 'Plakat Yellow Koi',
        price: 200000,
        category: 'Ikan Cupang',
        gender: 'Jantan',
        form: 'Plakat',
        coloration: 'Yellow Koi',
        description: 'Plakat premium dengan pola koi kuning-putih yang langka. Tubuh kompak and sirip pendek khas plakat membuat warna tampil lebih mencolok. Sangat jarang di pasaran.',
        image: '/betta-3.png',
        isPremium: true,
        statsForm: '9.0/10',
        statsColor: '10/10',
        statsSpirit: 'Aktif',
        quantity: 2,
        sizes: [
          { size: 'M', quantity: 1 },
          { size: 'L', quantity: 1 }
        ]
      },
    ],
  });
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
