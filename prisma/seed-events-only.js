import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const defaultEvents = [
  {
    title: 'TikTok Live Bid & Sale',
    subtitle: 'Edisi Spesial Malam Jumat',
    description: 'Gabung ke Live Streaming TikTok kami sekarang! Dapatkan kesempatan bid ikan cupang premium mulai dari 10rb rupiah dan gratis ongkir se-Indonesia selama sesi live berlangsung.',
    image: '/img/betta-2.png',
    targetUrl: 'https://tiktok.com/@sumdebetta/live',
    buttonText: 'Gabung Live Sekarang',
    isActive: true,
    startDate: null,
    endDate: null,
  },
  {
    title: 'Shopee Flash Sale up to 40%',
    subtitle: 'Hanya 3 Jam Saja!',
    description: 'Serbu diskon kilat untuk varian cupang Plakat Koi dan Halfmoon Giant di toko Shopee resmi kami. Stok terbatas hanya untuk 10 pembeli pertama!',
    image: '/img/betta-3.png',
    targetUrl: 'https://shopee.co.id/sumdebetta',
    buttonText: 'Belanja di Shopee',
    isActive: true,
    startDate: null,
    endDate: null,
  },
  {
    title: 'Exclusive Drop: Koi Nebula Series',
    subtitle: 'Rilis Segera',
    description: 'Nantikan perilisan koleksi genetik terbaru kami: Koi Nebula Series. Mutasi warna kosmik dengan form saringan kelas kontes. Tandai kalender Anda!',
    image: '/img/betta-1.png',
    targetUrl: '/produk',
    buttonText: 'Lihat Galeri',
    isActive: true,
    startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  },
];

async function main() {
  console.log('🔄 Memulai proses pengisian data Event saja (Aman tanpa menyentuh produk/user)...');

  let insertedCount = 0;
  let skippedCount = 0;

  for (const event of defaultEvents) {
    const existing = await prisma.promoEvent.findFirst({
      where: { title: event.title },
    });

    if (existing) {
      console.log(`⏩ Event "${event.title}" sudah ada di database (dilewati, tidak diduplikasi).`);
      skippedCount++;
    } else {
      await prisma.promoEvent.create({ data: event });
      console.log(`✅ Event "${event.title}" berhasil ditambahkan.`);
      insertedCount++;
    }
  }

  console.log(`\n🎉 Selesai! ${insertedCount} event baru ditambahkan, ${skippedCount} event dilewati.`);
}

main()
  .catch((e) => {
    console.error('❌ Gagal mengisi event:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

