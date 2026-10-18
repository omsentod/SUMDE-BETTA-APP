/**
 * Content-Based Recommendation System untuk SUMDE-BETTA-APP
 *
 * Menghitung skor kemiripan (similarity score) antara produk acuan dengan
 * seluruh kandidat produk lainnya berdasarkan atribut konten spesimen cupang:
 * 1. Form / Kategori (Bobot: 35%)
 * 2. Corak Warna / Coloration Token Overlap (Bobot: 25%)
 * 3. Kesesuaian Gender (Bobot: 15%)
 * 4. Kedekatan Rentang Harga (Bobot: 15%)
 * 5. Grade Bentuk / statsForm (Bobot: 10%)
 * 6. Ketersediaan Stok (Bonus prioritas ready stock)
 */

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// Menghitung Jaccard similarity antara dua teks corak warna
function calculateColorSimilarity(colorA, colorB) {
  if (!colorA || !colorB) return 0;
  const aLower = String(colorA).trim().toLowerCase();
  const bLower = String(colorB).trim().toLowerCase();
  if (aLower === bLower) return 1.0;

  const tokensA = new Set(tokenize(colorA));
  const tokensB = new Set(tokenize(colorB));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionCount = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersectionCount++;
  }
  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount > 0 ? intersectionCount / unionCount : 0;
}

/**
 * Menghitung rekomendasi produk serupa (Content-Based Filtering)
 * @param {object} currentProduct - Produk yang sedang dilihat pengguna
 * @param {Array<object>} allProducts - Daftar semua produk dalam katalog
 * @param {number} [limit=4] - Jumlah produk yang direkomendasikan
 * @returns {Array<object>} Produk serupa yang diurutkan berdasarkan skor kemiripan tertinggi
 */
export function getSimilarProducts(currentProduct, allProducts, limit = 4) {
  if (!currentProduct || !Array.isArray(allProducts) || allProducts.length <= 1) {
    return [];
  }

  const scored = [];

  for (const candidate of allProducts) {
    // Jangan rekomendasikan produk yang sedang dibuka atau produk yang diarsipkan
    if (candidate.id === currentProduct.id || candidate.isArchived) {
      continue;
    }

    // 1. Form / Kategori Match (35%)
    const formA = (currentProduct.form || currentProduct.category || '').toLowerCase().trim();
    const formB = (candidate.form || candidate.category || '').toLowerCase().trim();
    const formSim = formA && formB && formA === formB ? 1.0 : 0;

    // 2. Corak Warna Match / Jaccard Overlap (25%)
    const colorSim = calculateColorSimilarity(currentProduct.coloration, candidate.coloration);

    // 3. Gender Match (15%)
    const genderA = (currentProduct.gender || '').toLowerCase().trim();
    const genderB = (candidate.gender || '').toLowerCase().trim();
    const genderSim = genderA && genderB && genderA === genderB ? 1.0 : 0;

    // 4. Price Proximity (15%) - semakin dekat harganya semakin tinggi nilainya
    const priceA = Number(currentProduct.price) || 0;
    const priceB = Number(candidate.price) || 0;
    const maxPrice = Math.max(priceA, priceB);
    const priceSim = maxPrice > 0 ? Math.max(0, 1 - Math.abs(priceA - priceB) / maxPrice) : 1.0;

    // 5. Grade Bentuk / statsForm Match (10%)
    const gradeA = (currentProduct.statsForm || '').toLowerCase().trim();
    const gradeB = (candidate.statsForm || '').toLowerCase().trim();
    const gradeSim = gradeA && gradeB && gradeA === gradeB ? 1.0 : 0;

    // Total Skor Dasar (0 - 100)
    let totalScore =
      formSim * 35 +
      colorSim * 25 +
      genderSim * 15 +
      priceSim * 15 +
      gradeSim * 10;

    // Prioritaskan produk yang masih ready stock dibanding yang sudah sold out
    const isReady = (candidate.quantity || 0) > 0 && !candidate.isSold;
    if (isReady) {
      totalScore += 5;
    }

    scored.push({
      product: candidate,
      score: totalScore,
    });
  }

  // Urutkan dari skor tertinggi
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.product);
}
