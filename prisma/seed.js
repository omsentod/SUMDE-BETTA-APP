import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertProduct(data) {
  const existing = await prisma.product.findFirst({ where: { name: data.name } });
  if (existing) {
    return prisma.product.update({ where: { id: existing.id }, data });
  }
  return prisma.product.create({ data });
}

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@sumdebetta.com' },
    update: {},
    create: {
      email: 'admin@sumdebetta.com',
      password: 'admin123',
      name: 'Admin Sumde',
      role: 'admin',
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@sumdebetta.com' },
    update: {},
    create: {
      email: 'user@sumdebetta.com',
      password: 'user123',
      name: 'User Demo',
      role: 'customer',
    },
  });

  await upsertProduct({
    name: 'Halfmoon Blue Marble',
    price: 150000,
    category: 'Halfmoon',
    gender: 'Male',
    form: 'Halfmoon',
    coloration: 'Blue Marble',
    description: 'Ikan cupang halfmoon dengan warna blue marble yang memukau. Sirip mengembang sempurna membentuk setengah lingkaran 180°. Cocok untuk kontes maupun koleksi pribadi.',
    image: '/betta-1.png',
    isPremium: true,
    statsForm: 'COMP',
    age: '6 Month',
    statsSpirit: 'Aktif',
    quantity: 5,
    sizes: [
      { size: 'M', quantity: 3 },
      { size: 'M+', quantity: 2 }
    ]
  });

  await upsertProduct({
    name: 'Crowntail Red Dragon',
    price: 120000,
    category: 'Crowntail',
    gender: 'Male',
    form: 'Crowntail',
    coloration: 'Red Dragon',
    description: 'Cupang crowntail dengan warna merah menyala dan sisik dragon yang tegas. Ekor bercabang-cabang seperti mahkota memberikan kesan gagah dan eksotis.',
    image: '/betta-2.png',
    isPremium: false,
    statsForm: 'A',
    age: '5 Month',
    statsSpirit: 'Aktif',
    quantity: 3,
    sizes: [
      { size: 'S', quantity: 1 },
      { size: 'M', quantity: 2 }
    ]
  });

  await upsertProduct({
    name: 'Plakat Yellow Koi',
    price: 200000,
    category: 'Plakat',
    gender: 'Male',
    form: 'Plakat',
    coloration: 'Yellow Koi',
    description: 'Plakat premium dengan pola koi kuning-putih yang langka. Tubuh kompak dan sirip pendek khas plakat membuat warna tampil lebih mencolok. Sangat jarang di pasaran.',
    image: '/betta-3.png',
    isPremium: true,
    statsForm: 'COMP',
    age: '4 Month',
    statsSpirit: 'Aktif',
    quantity: 2,
    sizes: [
      { size: 'M', quantity: 1 },
      { size: 'L', quantity: 1 }
    ]
  });

  const eventCount = await prisma.promoEvent.count();
  if (eventCount === 0) {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const tenDaysLater = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    await prisma.promoEvent.createMany({
      data: [
        {
          title: 'TikTok Live Bid & Sale',
          subtitle: 'Edisi Spesial Malam Jumat',
          description: 'Gabung ke Live Streaming TikTok kami sekarang! Dapatkan kesempatan bid ikan cupang premium mulai dari 10rb rupiah dan gratis ongkir se-Indonesia selama sesi live berlangsung.',
          image: '/betta-2.png',
          targetUrl: 'https://tiktok.com/@sumdebetta/live',
          buttonText: 'Gabung Live Sekarang',
          isActive: true,
          startDate: null,
          endDate: null
        },
        {
          title: 'Shopee Flash Sale up to 40%',
          subtitle: 'Hanya 3 Jam Saja!',
          description: 'Serbu diskon kilat untuk varian cupang Plakat Koi dan Halfmoon Giant di toko Shopee resmi kami. Stok terbatas hanya untuk 10 pembeli pertama!',
          image: '/betta-3.png',
          targetUrl: 'https://shopee.co.id/sumdebetta',
          buttonText: 'Belanja di Shopee',
          isActive: true,
          startDate: null,
          endDate: null
        },
        {
          title: 'Exclusive Drop: Koi Nebula Series',
          subtitle: 'Rilis Segera',
          description: 'Nantikan perilisan koleksi genetik terbaru kami: Koi Nebula Series. Mutasi warna kosmik dengan form saringan kelas kontes. Tandai kalender Anda!',
          image: '/betta-1.png',
          targetUrl: '/produk',
          buttonText: 'Lihat Galeri',
          isActive: true,
          startDate: threeDaysLater,
          endDate: tenDaysLater
        }
      ]
    });
  }

  console.log('Seed berhasil!');
  console.log('Admin  : admin@sumdebetta.com / admin123');
  console.log('User   : user@sumdebetta.com / user123');
  console.log('Produk : 3 item diperbarui/dibuat');
  console.log('Event  : skip jika sudah ada');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
