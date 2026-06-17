const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const initialProducts = [
    {
        id: '1',
        name: 'Red Dragon Halfmoon',
        price: 1500000,
        category: 'Halfmoon',
        gender: 'Male',
        form: 'Halfmoon',
        coloration: 'Super Red',
        description: 'Mahakarya hidup dari spesies Betta Splendens. Menampilkan sisik naga merah yang pekat dengan ekor halfmoon yang sempurna.',
        image: '/betta-1.png',
        isSold: false,
        isPremium: true,
        statsForm: '9.8/10',
        statsColor: '9.5/10',
        statsSpirit: 'Agresif'
    },
    {
        id: '2',
        name: 'Koi Galaxy Plakat',
        price: 2500000,
        category: 'Plakat',
        gender: 'Male',
        form: 'Plakat',
        coloration: 'Koi',
        description: 'Genetik Koi Galaxy yang sangat langka. Perpaduan warna nebula yang menampilkan bintik biru, merah, dan kuning.',
        image: '/betta-2.png',
        isSold: false,
        isPremium: true,
        statsForm: '9.5/10',
        statsColor: '9.9/10',
        statsSpirit: 'Pemberani'
    },
    {
        id: '3',
        name: 'Black Samurai',
        price: 1200000,
        category: 'Plakat',
        gender: 'Male',
        form: 'Plakat',
        coloration: 'Black Samurai',
        description: 'Ksatria kegelapan dunia akuatik. Sisik beludru hitam pekat dengan sisik naga perak tebal di atas tubuh.',
        image: '/betta-3.png',
        isSold: true,
        isPremium: false,
        statsForm: '9.2/10',
        statsColor: '9.8/10',
        statsSpirit: 'Tenang'
    },
    {
        id: '4',
        name: 'Copper Plakat Premium',
        price: 850000,
        category: 'Plakat',
        gender: 'Female',
        form: 'Plakat',
        coloration: 'Copper',
        description: 'Kemilau tembaga metalik. Spesimen betina siap pijah yang sangat sehat dengan aktivitas tinggi.',
        image: '/betta-2.png',
        isSold: false,
        isPremium: false,
        statsForm: '9.0/10',
        statsColor: '9.4/10',
        statsSpirit: 'Agresif'
    },
    {
        id: '5',
        name: 'Fancy Halfmoon Lavender',
        price: 3500000,
        category: 'Halfmoon',
        gender: 'Male',
        form: 'Halfmoon',
        coloration: 'Multicolor',
        description: 'Palet warna yang sangat langka. Gradasi lavender dan violet yang lembut pada ekor halfmoon yang lebar.',
        image: '/betta-1.png',
        isSold: false,
        isPremium: true,
        statsForm: '9.9/10',
        statsColor: '10/10',
        statsSpirit: 'Anggun'
    },
    {
        id: '6',
        name: 'Blue Rim Plakat Pair',
        price: 1800000,
        category: 'Plakat',
        gender: 'Pair',
        form: 'Plakat',
        coloration: 'Solid',
        description: 'Sepasang indukan Blue Rim siap pijah. Tubuh putih bersih dengan garis biru tua yang sempurna di tepian sirip.',
        image: '/betta-2.png',
        isSold: false,
        isPremium: true,
        statsForm: '9.7/10',
        statsColor: '9.5/10',
        statsSpirit: 'Waspada'
    },
    {
        id: '7',
        name: 'Avatar Gordon',
        price: 2100000,
        category: 'Plakat',
        gender: 'Male',
        form: 'Plakat',
        coloration: 'Avatar',
        description: 'Mutasi avatar gordon dengan rintik bintang yang menyebar rata. Warna dasar dominan gelap dengan sisik mutiara terang.',
        image: '/betta-3.png',
        isSold: false,
        isPremium: true,
        statsForm: '9.4/10',
        statsColor: '9.7/10',
        statsSpirit: 'Aktif'
    },
    {
        id: '8',
        name: 'Super Red Crowntail',
        price: 650000,
        category: 'Crowntail',
        gender: 'Male',
        form: 'Crowntail',
        coloration: 'Super Red',
        description: 'Warna merah darah yang menyala penuh tanpa bocor. Ekor serit yang kokoh dan menyilang sempurna.',
        image: '/betta-1.png',
        isSold: false,
        isPremium: false,
        statsForm: '8.9/10',
        statsColor: '9.2/10',
        statsSpirit: 'Ganas'
    }
];

async function main() {
    console.log('Mulai seeding data...');

    // Clear existing data (optional, to avoid duplicates)
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.user.deleteMany({});

    // Create users
    const admin = await prisma.user.create({
        data: {
            email: 'fajar@sumde.com',
            password: 'eof182rs87',
            name: 'Fajar',
            role: 'admin'
        }
    });

    const customer = await prisma.user.create({
        data: {
            email: 'customer@gmail.com',
            password: 'customerpassword',
            name: 'Ahmad Pratama',
            role: 'customer',
            phone: '08123456789',
            streetAddress: 'Jl. Sudirman No. 123',
            rtRw: 'RT 01 / RW 04',
            province: 'DKI Jakarta',
            city: 'Jakarta Selatan',
            district: 'Kebayoran Baru',
            village: 'Selong',
            postalCode: '12110'
        }
    });

    
    console.log('User Admin & Customer berhasil dibuat.');

    // Create products
    for (const prod of initialProducts) {
        await prisma.product.create({
            data: prod
        });
    }

    console.log(`${initialProducts.length} produk awal berhasil ditambahkan.`);
    console.log('Seeding selesai dengan sukses!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
