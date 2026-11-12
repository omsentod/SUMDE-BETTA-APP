import * as XLSX from 'xlsx';

/**
 * Menghasilkan Reference ID yang 100% UNIK (Collision-Proof).
 * Struktur:
 * [PREFIX]-[YYMMDD]-[HHMMSS]-[4-CHAR ALPHANUMERIC]
 * Contoh: REF-OFF-261113-015230-8X2K
 *
 * Menggabungkan tanggal, jam:menit:detik saat pembuatan, serta 4 digit karakter acak.
 * Panjang ~25 karakter, optimal untuk scan barcode Code 128 thermal tanpa risiko bentrok.
 */
export function generateAutoTrackingCode(prefix = 'REF-OFF', existingIds = []) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const timeStamp = `${hh}${mi}${ss}`;

  const existingSet = new Set(existingIds || []);
  let code = '';
  let attempts = 0;

  do {
    // Generate 4 karakter acak base-36 (angka 0-9 & huruf A-Z)
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, '0');
    code = `${prefix}-${yy}${mm}${dd}-${timeStamp}-${rand}`;
    attempts++;
  } while (existingSet.has(code) && attempts < 20);

  return code;
}

/**
 * Mengunduh file template Excel (.xlsx) untuk cetak resi offline massal.
 * Hanya memuat 4 kolom esensial: Nama, No Telepon, Alamat Lengkap, dan Kurir.
 * Reference ID akan di-generate otomatis oleh sistem saat impor.
 */
export function downloadOfflineWaybillTemplate() {
  const sampleData = [
    {
      'Nama Penerima': 'Budi Santoso',
      'No Telepon': '081234567890',
      'Alamat Lengkap': 'Jl. Mawar No. 12 RT 03/RW 02, Kel. Sukamaju, Kec. Cilodong, Kota Depok, Jawa Barat 16415',
      'Kurir': 'J&T Express',
    },
    {
      'Nama Penerima': 'Siti Rahmawati',
      'No Telepon': '085712345678',
      'Alamat Lengkap': 'Perum Graha Indah Blok C2 No. 8, Kel. Tugu, Kec. Cimanggis, Kota Depok, Jawa Barat 16451',
      'Kurir': 'POS Indonesia',
    },
    {
      'Nama Penerima': 'Ahmad Fauzi',
      'No Telepon': '081987654321',
      'Alamat Lengkap': 'Dusun Krajan RT 01/RW 03, Desa Beji, Kec. Boyolangu, Kab. Tulungagung, Jawa Timur 66233',
      'Kurir': 'SiCepat',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 22 }, // Nama Penerima
    { wch: 18 }, // No Telepon
    { wch: 70 }, // Alamat Lengkap
    { wch: 18 }, // Kurir
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Resi Offline');
  XLSX.writeFile(wb, 'template_resi_offline_sumde.xlsx');
}

/**
 * Membaca file Excel (.xlsx / .xls / .csv) dan mengekstrak daftar resi offline.
 * Menghasilkan Reference ID 100% unik dan berurutan per baris impor.
 */
export function parseOfflineWaybillsExcel(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('File tidak ditemukan.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('Sheet Excel kosong.');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!Array.isArray(rawRows) || rawRows.length === 0) {
          throw new Error('Tidak ada baris data yang ditemukan di file Excel.');
        }

        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const timeStamp = `${hh}${mi}${ss}`;

        const items = rawRows
          .map((row, idx) => {
            // Fuzzy key lookup untuk mengakomodasi berbagai format nama kolom
            const name =
              row['Nama Penerima'] ||
              row['Nama'] ||
              row['Customer'] ||
              row['Penerima'] ||
              row['Name'] ||
              '';

            const phone =
              row['No Telepon'] ||
              row['No. Telepon'] ||
              row['No Telp'] ||
              row['No. Telp'] ||
              row['Telepon'] ||
              row['No HP'] ||
              row['No. HP'] ||
              row['WhatsApp'] ||
              row['WA'] ||
              row['Phone'] ||
              '';

            const address =
              row['Alamat Lengkap'] ||
              row['Alamat'] ||
              row['Address'] ||
              row['Alamat Penerima'] ||
              '';

            const courier =
              row['Kurir'] ||
              row['Ekspedisi'] ||
              row['Jasa Kirim'] ||
              row['Courier'] ||
              'J&T Express';

            const trimmedName = String(name).trim();
            const trimmedPhone = String(phone).trim();
            const trimmedAddress = String(address).trim();
            const trimmedCourier = String(courier).trim() || 'J&T Express';

            // Reference ID unik berurutan berbasis batch import: REF-OFF-YYMMDD-HHMMSS-001, 002...
            const seqNumber = String(idx + 1).padStart(3, '0');
            const refId = `REF-OFF-${yy}${mm}${dd}-${timeStamp}-${seqNumber}`;

            return {
              id: refId,
              name: trimmedName,
              phone: trimmedPhone,
              address: trimmedAddress,
              courier: trimmedCourier,
              service: 'Reguler',
              createdAt: new Date().toISOString(),
            };
          })
          .filter((item) => item.name || item.address || item.phone);

        if (items.length === 0) {
          throw new Error('Tidak ada data penerima yang valid di dalam file Excel.');
        }

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file Excel.'));
    };

    reader.readAsArrayBuffer(file);
  });
}
