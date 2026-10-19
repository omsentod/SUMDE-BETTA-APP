import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requirePermission(request, 'products:manage');

    // Definisi kolom template produk
    const templateData = [
      {
        'Nama Produk': 'Halfmoon Super Red High Quality',
        'Harga': 350000,
        'Kategori': 'Halfmoon',
        'Corak Warna': 'Super Red',
        'Deskripsi': 'Ikan cupang Halfmoon warna merah solid pekat, bukaan ekor 180 derajat full over spread.',
        'Stok': 3,
        'Grade Bentuk': 'COMP',
        'Umur': '4.5 Month',
        'Varian': 'Male (M): 2, Male (M+): 1',
        'Terjual': 8,
        'Premium': 'Ya',
      },
      {
        'Nama Produk': 'Plakat Multicolor Fancy Top Grade',
        'Harga': 275000,
        'Kategori': 'Plakat',
        'Corak Warna': 'Multicolor',
        'Deskripsi': 'Form tebal, mental aktif agresif, warna motif galaxy rapi.',
        'Stok': 3,
        'Grade Bentuk': 'COMP',
        'Umur': '4 Month',
        'Varian': 'Male: 2, Female: 1',
        'Terjual': 24,
        'Premium': 'Tidak',
      },
    ];

    // Buat sheet petunjuk
    const guideData = [
      {
        'Kolom': 'Nama Produk',
        'Status': 'Wajib',
        'Keterangan': 'Nama produk cupang. Nama folder di file ZIP foto WAJIB SAMA PERSIS dengan kolom ini.',
      },
      {
        'Kolom': 'Harga',
        'Status': 'Wajib',
        'Keterangan': 'Nominal harga dalam Rupiah (hanya angka tanpa Rp / titik / koma, contoh: 250000).',
      },
      {
        'Kolom': 'Kategori',
        'Status': 'Opsional',
        'Keterangan': 'Plakat, Halfmoon, Crowntail, Giant, Double Tail, atau Dumbo Ear (default: Plakat).',
      },
      {
        'Kolom': 'Corak Warna',
        'Status': 'Opsional',
        'Keterangan': 'Contoh: Multicolor, Blue Rim, Super Red, Black Samurai, Koi Galaxy (default: Multicolor).',
      },
      {
        'Kolom': 'Deskripsi',
        'Status': 'Opsional',
        'Keterangan': 'Deskripsi lengkap spesimen dan keunggulan ikan.',
      },
      {
        'Kolom': 'Stok',
        'Status': 'Opsional',
        'Keterangan': 'Jumlah stok jika tidak menggunakan varian (default: 1). Jika kolom Varian diisi, kolom ini akan otomatis terhitung dari total varian.',
      },
      {
        'Kolom': 'Grade Bentuk',
        'Status': 'Opsional',
        'Keterangan': 'COMP, COMPETITION, A, B, atau C (default: COMP).',
      },
      {
        'Kolom': 'Umur',
        'Status': 'Opsional',
        'Keterangan': 'Contoh: 4 Month, 5 Month (default: 4 Month).',
      },
      {
        'Kolom': 'Varian',
        'Status': 'Opsional',
        'Keterangan': 'Varian gender / ukuran & stok dengan format "Varian:Qty", contoh: "Male:2, Female:1" atau "Male (M):2, Male (L):1". Jika diisi, stok total otomatis dijumlahkan.',
      },
      {
        'Kolom': 'Terjual',
        'Status': 'Opsional',
        'Keterangan': 'Jumlah produk terjual untuk display customer. Tidak mengubah laporan keuangan.',
      },
      {
        'Kolom': 'Premium',
        'Status': 'Opsional',
        'Keterangan': 'Isi "Ya" atau "Tidak" untuk badge ikan premium (default: Tidak).',
      },
    ];

    const wb = XLSX.utils.book_new();

    const wsTemplate = XLSX.utils.json_to_sheet(templateData);
    // Atur lebar kolom template
    wsTemplate['!cols'] = [
      { wch: 35 }, // Nama Produk
      { wch: 14 }, // Harga
      { wch: 16 }, // Kategori
      { wch: 20 }, // Corak Warna
      { wch: 45 }, // Deskripsi
      { wch: 10 }, // Stok
      { wch: 14 }, // Grade Bentuk
      { wch: 14 }, // Umur
      { wch: 30 }, // Varian
      { wch: 12 }, // Terjual
      { wch: 12 }, // Premium
    ];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Data Produk');

    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [
      { wch: 18 }, // Kolom
      { wch: 12 }, // Status
      { wch: 70 }, // Keterangan
    ];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk Pengisian');

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
