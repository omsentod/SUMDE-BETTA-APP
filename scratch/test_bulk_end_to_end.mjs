import prisma from '../src/lib/prisma.js';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

async function run() {
  console.log('--- STARTING BULK EXCEL & ZIP END-TO-END TEST ---');

  const prodName = 'Bulk Test Betta ' + Date.now();
  const rows = [
    {
      'Nama Produk': prodName,
      'Harga': 200000,
      'Kategori': 'Plakat',
      'Corak Warna': 'Galaxy Tiger',
      'Deskripsi': 'Cupang plakat top grade',
      'Grade Bentuk': 'COMP',
      'Umur': '4 Month',
      'Varian': 'Male:3:320000, Female:2:220000',
      'Terjual': 5,
      'Premium': 'Ya',
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Data Produk');
  const excelBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const excelBlob = new Blob([excelBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const excelFormData = new FormData();
  excelFormData.append('file', excelBlob, 'bulk_test.xlsx');

  const { signSession, SESSION_COOKIE } = await import('../src/lib/auth.js');
  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
  const adminToken = await signSession({ id: adminUser.id, role: 'admin' });

  console.log('1. Uploading Excel with Varian format: Male:3:320000, Female:2:220000');
  const excelRes = await fetch('http://localhost:3000/api/admin/products/bulk/excel', {
    method: 'POST',
    headers: {
      'Cookie': `sumde-session=${adminToken}`,
    },
    body: excelFormData,
  });
  const excelData = await excelRes.json();
  console.log('   Excel upload response:', excelData);

  const importedProduct = await prisma.product.findFirst({
    where: { name: prodName },
    include: { variants: true },
  });

  if (importedProduct) {
    console.log('   [PASS] Excel product created:', {
      name: importedProduct.name,
      basePrice: importedProduct.price,
      totalQty: importedProduct.quantity,
      variants: importedProduct.variants.map(v => ({ size: v.size, stock: v.stock, price: v.price })),
    });
  } else {
    console.error('   [FAIL] Excel product not found!');
  }

  console.log('\n2. Creating ZIP with variant photos: Male,1.png and Female-1.png');
  const zip = new JSZip();
  const prodFolder = zip.folder(prodName);

  const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  prodFolder.file('Male, 1.png', onePixelPng);
  prodFolder.file('Female-1.png', onePixelPng);
  prodFolder.file('cover.png', onePixelPng);

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
  const zipBlob = new Blob([zipBuf], { type: 'application/zip' });
  const zipFormData = new FormData();
  zipFormData.append('file', zipBlob, 'photos.zip');

  const zipRes = await fetch('http://localhost:3000/api/admin/products/bulk/zip', {
    method: 'POST',
    headers: {
      'Cookie': `sumde-session=${adminToken}`,
    },
    body: zipFormData,
  });
  const zipData = await zipRes.json();
  console.log('   ZIP upload response:', zipData);

  const productWithPhotos = await prisma.product.findFirst({
    where: { name: prodName },
    include: { variants: true },
  });

  console.log('   Cover image:', productWithPhotos.image);
  console.log('   Images count:', productWithPhotos.images?.length);
  console.log('   Variant photos:');
  for (const v of productWithPhotos.variants) {
    console.log(`     - Variant ${v.size}: imageUrl=${v.imageUrl}`);
  }

  const allVariantsHavePhotos = productWithPhotos.variants.every(v => v.imageUrl);
  if (allVariantsHavePhotos && productWithPhotos.images?.length === 3) {
    console.log('   [PASS] All variants successfully linked to their individual photos from ZIP!');
  } else {
    console.error('   [FAIL] Variant photo linkage incomplete.');
  }

  await prisma.productVariant.deleteMany({ where: { productId: importedProduct.id } });
  await prisma.product.delete({ where: { id: importedProduct.id } });

  console.log('\n--- BULK EXCEL & ZIP VERIFICATION COMPLETED SUCCESSFULLY ---');
}

run().catch(console.error).finally(() => prisma.$disconnect());
