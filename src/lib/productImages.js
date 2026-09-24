// Normalisasi daftar gambar produk (galeri multi-foto).
//
// Dipakai server-side oleh POST/PUT /api/products supaya `Product.images`
// selalu tersimpan sebagai array URL string yang bersih dan berurutan, dan
// `Product.image` (cover, dibaca kode lama) selalu = images[0].
//
// Keamanan: HANYA menerima path internal (diawali "/", mis. /uploads/... atau
// /img/...). URL eksternal / skema aneh (`javascript:`, `http://evil`) dibuang
// supaya field ini tidak bisa dipakai untuk menautkan sumber di luar situs.
export function normalizeImages(images, fallback) {
  let arr = [];
  if (Array.isArray(images)) {
    arr = images
      .map((u) => {
        if (typeof u === 'string') return u;
        if (u && typeof u.url === 'string') return u.url; // toleran kalau dikirim {url}
        return '';
      })
      .map((s) => s.trim())
      .filter((s) => s.startsWith('/'));
  }
  // Fallback ke cover lama (`image`) supaya produk yang di-update tanpa mengubah
  // galeri, atau baris lama pra-fitur, tetap punya minimal satu foto.
  if (arr.length === 0 && typeof fallback === 'string' && fallback.trim().startsWith('/')) {
    arr = [fallback.trim()];
  }
  // Buang duplikat berurutan tapi pertahankan urutan yang di-set admin.
  return arr.filter((url, i) => arr.indexOf(url) === i);
}
