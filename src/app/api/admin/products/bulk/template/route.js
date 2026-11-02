import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requirePermission(request, 'products:manage');

    // 1. Ambil data master hierarki terkini dari database
    let departments = [];
    try {
      departments = await prisma.department.findMany({
        orderBy: { orderIndex: 'asc' },
        include: {
          subCategories: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
    } catch (dbErr) {
      console.warn('Gagal memuat departemen dari DB untuk template, menggunakan data fallback:', dbErr.message);
    }

    // Fallback jika database belum memiliki data departemen
    if (!departments || departments.length === 0) {
      departments = [
        {
          name: 'Ikan Hias',
          isLiveFish: true,
          description: 'Koleksi ikan hias dengan garansi DOA 100%.',
          subCategories: [
            { name: 'Cupang (Betta)', description: 'Plakat, Halfmoon, Crowntail, Giant, dll.' },
            { name: 'Channa', description: 'Channa limbata, auranti, pulchra, dll.' },
            { name: 'Guppy', description: 'Guppy strain murni ekor lebar.' },
            { name: 'Molly', description: 'Balloon molly dan sailfin molly.' },
          ],
        },
        {
          name: 'Peralatan & Aquarium',
          isLiveFish: false,
          description: 'Soliter kaca, sistem filtrasi, aerator, dan aksesoris.',
          subCategories: [
            { name: 'Soliter & Aquarium', description: 'Soliter kaca bending, rimless tank.' },
            { name: 'Filter & Aerator', description: 'Filter gantung, aerator, pompa sirkulasi.' },
            { name: 'Lampu & Aksesoris', description: 'LED aquarium, termometer, pinset aquascape.' },
          ],
        },
        {
          name: 'Pakan & Obat',
          isLiveFish: false,
          description: 'Nutrisi pakan pelet, cacing kering, daun ketapang, dan vitamin.',
          subCategories: [
            { name: 'Pakan Ikan', description: 'Pelet cupang, pakan larva, spirulina flakes.' },
            { name: 'Obat & Vitamin', description: 'Ekstrak ketapang olahan, methylene blue, vitamin air.' },
          ],
        },
      ];
    }

    // 2. Siapkan data Sheet 1: Contoh Baris Input Produk
    const templateData = [
      {
        'Nama Produk': 'Halfmoon Super Red High Quality',
        'Departemen': 'Ikan Hias',
        'Sub-Kategori': 'Cupang (Betta)',
        'Harga': 350000,
        'Merk / Brand': '',
        'Berat (Gram)': 1000,
        'Kategori Form': 'Halfmoon',
        'Corak Warna': 'Super Red',
        'Deskripsi': 'Ikan cupang Halfmoon warna merah solid pekat, bukaan ekor 180 derajat full over spread.',
        'Grade Bentuk': 'COMP',
        'Umur': '4.5 Month',
        'Varian': 'Male:2:350000, Female:1:300000',
        'Stok': 3,
        'Link Video': 'https://youtube.com/shorts/sample1',
        'Terjual': 8,
        'Premium': 'Ya',
      },
      {
        'Nama Produk': 'Balloon Molly White Pearl',
        'Departemen': 'Ikan Hias',
        'Sub-Kategori': 'Molly',
        'Harga': 15000,
        'Merk / Brand': '',
        'Berat (Gram)': 250,
        'Kategori Form': 'Standar',
        'Corak Warna': 'White Pearl',
        'Deskripsi': 'Ikan molly balon putih mutiara lincah, gemuk, dan sehat terawat.',
        'Grade Bentuk': 'A',
        'Umur': '3 Month',
        'Varian': 'Sepasang:5:25000, Jantan:10:15000',
        'Stok': 15,
        'Link Video': '',
        'Terjual': 20,
        'Premium': 'Tidak',
      },
      {
        'Nama Produk': 'Sobo Internal Filter Aquarium WP-1000F',
        'Departemen': 'Peralatan & Aquarium',
        'Sub-Kategori': 'Filter & Aerator',
        'Harga': 65000,
        'Merk / Brand': 'Sobo',
        'Berat (Gram)': 500,
        'Kategori Form': '-',
        'Corak Warna': '-',
        'Deskripsi': 'Filter internal celup hemat daya listrik, semburan oksigen kuat, dan mudah dibersihkan.',
        'Grade Bentuk': '-',
        'Umur': '-',
        'Varian': '',
        'Stok': 25,
        'Link Video': '',
        'Terjual': 12,
        'Premium': 'Tidak',
      },
      {
        'Nama Produk': 'Hikari Betta Bio-Gold Pelet 20gr',
        'Departemen': 'Pakan & Obat',
        'Sub-Kategori': 'Pakan Ikan',
        'Harga': 45000,
        'Merk / Brand': 'Hikari',
        'Berat (Gram)': 100,
        'Kategori Form': '-',
        'Corak Warna': '-',
        'Deskripsi': 'Pakan harian premium untuk cupang kaya nutrisi guna mencerahkan warna alami dan menjaga kesehatan pencernaan.',
        'Grade Bentuk': '-',
        'Umur': '-',
        'Varian': '',
        'Stok': 40,
        'Link Video': '',
        'Terjual': 35,
        'Premium': 'Tidak',
      },
    ];

    // 3. Siapkan data Sheet 2: Referensi Departemen & Sub-Kategori Aktual
    const referenceData = [];
    for (const dept of departments) {
      const typeLabel = dept.isLiveFish ? 'Ikan Hidup (Live Fish)' : 'Barang Kering (Dry Goods)';
      if (Array.isArray(dept.subCategories) && dept.subCategories.length > 0) {
        for (const sub of dept.subCategories) {
          referenceData.push({
            'Nama Departemen (Level 1)': dept.name,
            'Tipe Produk': typeLabel,
            'Nama Sub-Kategori (Level 2)': sub.name,
            'Keterangan / Catatan': sub.description || dept.description || '-',
          });
        }
      } else {
        referenceData.push({
          'Nama Departemen (Level 1)': dept.name,
          'Tipe Produk': typeLabel,
          'Nama Sub-Kategori (Level 2)': '(Belum ada sub-kategori)',
          'Keterangan / Catatan': dept.description || '-',
        });
      }
    }

    // 4. Siapkan data Sheet 3: Panduan Kolom
    const guideData = [
      {
        'Kolom': 'Nama Produk',
        'Status': 'Wajib',
        'Keterangan': 'Nama produk. Untuk upload foto via ZIP, nama folder foto WAJIB SAMA PERSIS dengan kolom ini.',
      },
      {
        'Kolom': 'Departemen',
        'Status': 'Direkomendasikan',
        'Keterangan': 'Salin nama persis dari sheet "Daftar Departemen & Kategori" (misal: "Ikan Hias", "Peralatan & Aquarium", "Pakan & Obat").',
      },
      {
        'Kolom': 'Sub-Kategori',
        'Status': 'Direkomendasikan',
        'Keterangan': 'Salin nama persis dari sheet "Daftar Departemen & Kategori" yang berada di bawah departemen terkait (misal: "Cupang (Betta)", "Molly", "Filter & Aerator").',
      },
      {
        'Kolom': 'Harga',
        'Status': 'Wajib',
        'Keterangan': 'Harga dasar dalam Rupiah (angka saja, contoh: 250000).',
      },
      {
        'Kolom': 'Merk / Brand',
        'Status': 'Opsional',
        'Keterangan': 'Merk produk peralatan/pakan (contoh: Sobo, Hikari, Atman). Kosongkan jika produk ikan.',
      },
      {
        'Kolom': 'Berat (Gram)',
        'Status': 'Opsional',
        'Keterangan': 'Berat produk dalam gram untuk perhitungan ongkos kirim otomatis kurir Biteship (default: 1000 gram jika kosong).',
      },
      {
        'Kolom': 'Kategori Form',
        'Status': 'Opsional',
        'Keterangan': 'Untuk ikan cupang: Plakat, Halfmoon, Crowntail, Giant, dll. Isi "-" jika produk non-ikan.',
      },
      {
        'Kolom': 'Corak Warna',
        'Status': 'Opsional',
        'Keterangan': 'Corak warna ikan: Multicolor, Super Red, Blue Rim, dll. Isi "-" jika non-ikan.',
      },
      {
        'Kolom': 'Deskripsi',
        'Status': 'Opsional',
        'Keterangan': 'Deskripsi lengkap dan spesifikasi produk.',
      },
      {
        'Kolom': 'Grade Bentuk',
        'Status': 'Opsional',
        'Keterangan': 'Grade kualitas ikan: COMP, A, B, atau C (default: COMP). Isi "-" jika non-ikan.',
      },
      {
        'Kolom': 'Umur',
        'Status': 'Opsional',
        'Keterangan': 'Umur ikan (contoh: 4 Month). Isi "-" jika non-ikan.',
      },
      {
        'Kolom': 'Varian',
        'Status': 'Opsional',
        'Keterangan': 'Format: "NamaVarian:Stok:Harga" dipisah koma. Contoh: "Male:2:350000, Female:1:300000" atau "20gr:10:45000, 50gr:5:95000". Jika kosong, stok diambil dari kolom Stok.',
      },
      {
        'Kolom': 'Stok',
        'Status': 'Opsional',
        'Keterangan': 'Jumlah stok jika tidak menggunakan varian (default: 1). Jika kolom Varian terisi, stok dihitung dari total stok varian.',
      },
      {
        'Kolom': 'Link Video',
        'Status': 'Opsional',
        'Keterangan': 'Link video YouTube (video flaring ikan atau demonstrasi produk).',
      },
      {
        'Kolom': 'Terjual',
        'Status': 'Opsional',
        'Keterangan': 'Jumlah display counter terjual untuk pengunjung (default: 0).',
      },
      {
        'Kolom': 'Premium',
        'Status': 'Opsional',
        'Keterangan': 'Isi "Ya" atau "Tidak" untuk badge produk premium / unggulan (default: Tidak).',
      },
    ];

    const wb = XLSX.utils.book_new();

    // Sheet 1: Data Produk
    const wsTemplate = XLSX.utils.json_to_sheet(templateData);
    wsTemplate['!cols'] = [
      { wch: 35 }, // Nama Produk
      { wch: 24 }, // Departemen
      { wch: 24 }, // Sub-Kategori
      { wch: 14 }, // Harga
      { wch: 16 }, // Merk / Brand
      { wch: 14 }, // Berat (Gram)
      { wch: 16 }, // Kategori Form
      { wch: 18 }, // Corak Warna
      { wch: 45 }, // Deskripsi
      { wch: 14 }, // Grade Bentuk
      { wch: 14 }, // Umur
      { wch: 38 }, // Varian
      { wch: 10 }, // Stok
      { wch: 32 }, // Link Video
      { wch: 10 }, // Terjual
      { wch: 12 }, // Premium
    ];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Data Produk');

    // Sheet 2: Referensi Departemen & Kategori (Master Data dari Database)
    const wsRef = XLSX.utils.json_to_sheet(referenceData);
    wsRef['!cols'] = [
      { wch: 26 }, // Nama Departemen
      { wch: 26 }, // Tipe Produk
      { wch: 26 }, // Nama Sub-Kategori
      { wch: 55 }, // Keterangan / Catatan
    ];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Daftar Departemen & Kategori');

    // Sheet 3: Petunjuk Kolom
    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 80 },
    ];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk Kolom');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template_bulk_upload_produk.xlsx"',
      },
    });
  } catch (error) {
    console.error('Download template error:', error);
    return NextResponse.json({ error: error.message || 'Gagal membuat template.' }, { status: error.status || 500 });
  }
}
