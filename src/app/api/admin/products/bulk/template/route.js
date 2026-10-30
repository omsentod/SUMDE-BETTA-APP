import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requirePermission(request, 'products:manage');

    const templateData = [
      {
        'Nama Produk': 'Halfmoon Super Red High Quality',
        'Harga': 350000,
        'Kategori': 'Halfmoon',
        'Corak Warna': 'Super Red',
        'Deskripsi': 'Ikan cupang Halfmoon warna merah solid pekat, bukaan ekor 180 derajat full over spread.',
        'Grade Bentuk': 'COMP',
        'Umur': '4.5 Month',
        'Varian': 'Male:2:350000, Male (M+):1:400000',
        'Terjual': 8,
        'Premium': 'Ya',
      },
      {
        'Nama Produk': 'Plakat Multicolor Fancy Top Grade',
        'Harga': 275000,
        'Kategori': 'Plakat',
        'Corak Warna': 'Multicolor',
        'Deskripsi': 'Form tebal, mental aktif agresif, warna motif galaxy rapi.',
        'Grade Bentuk': 'COMP',
        'Umur': '4 Month',
        'Varian': 'Male:2, Female:1',
        'Terjual': 24,
        'Premium': 'Tidak',
      },
      {
        'Nama Produk': 'Crowntail Blue Marble Tanpa Varian',
        'Harga': 180000,
        'Kategori': 'Crowntail',
        'Corak Warna': 'Blue Marble',
        'Deskripsi': 'Cupang crowntail tanpa varian gender, dijual per ekor.',
        'Grade Bentuk': 'A',
        'Umur': '3 Month',
        'Varian': '',
        'Terjual': 0,
        'Premium': 'Tidak',
      },
    ];

    const guideData = [
      {
        'Kolom': 'Nama Produk',
        'Status': 'Wajib',
        'Keterangan': 'Nama produk cupang. Nama folder di file ZIP foto WAJIB SAMA PERSIS dengan kolom ini.',
      },
      {
        'Kolom': 'Harga',
        'Status': 'Wajib',
        'Keterangan': 'Harga dasar produk dalam Rupiah (angka saja, contoh: 250000). Dipakai sebagai fallback jika varian tidak punya harga sendiri.',
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
        'Keterangan': 'Deskripsi lengkap dan keunggulan ikan.',
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
        'Keterangan': 'Format: "Varian:Qty:Harga" dipisah koma. Harga per varian opsional. Contoh: "Male:2:350000, Female:1:300000" atau "Male:2, Female:1" (pakai harga dasar). Jika kosong, produk tanpa varian — stok diisi manual.',
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
    wsTemplate['!cols'] = [
      { wch: 35 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 45 },
      { wch: 14 },
      { wch: 14 },
      { wch: 40 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Data Produk');

    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 80 },
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
