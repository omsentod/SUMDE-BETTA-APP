/**
 * Modul Utilitas Harga Partai (Wholesale / Grosir)
 * 
 * SUMDE-BETTA-APP:
 * Mendukung 3 level tier harga partai (misal: 10, 30, 50 ekor)
 * dengan validasi ketat anti-tampering (server-authoritative).
 */

/**
 * Normalisasi dan parsing aman untuk wholesaleTiers
 * @param {any} rawTiers
 * @returns {Array<{minQty: number, price: number}>}
 */
export function normalizeWholesaleTiers(rawTiers) {
  if (!rawTiers) return [];
  let parsed = rawTiers;
  if (typeof rawTiers === 'string') {
    try {
      parsed = JSON.parse(rawTiers);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((tier) => {
      const minQty = parseInt(tier.minQty, 10);
      const price = parseFloat(tier.price);
      let variantPrices = undefined;

      if (tier.variantPrices && typeof tier.variantPrices === 'object' && !Array.isArray(tier.variantPrices)) {
        variantPrices = {};
        for (const [key, val] of Object.entries(tier.variantPrices)) {
          const num = parseFloat(val);
          if (Number.isFinite(num) && num > 0) {
            variantPrices[key] = num;
          }
        }
        if (Object.keys(variantPrices).length === 0) variantPrices = undefined;
      }

      return {
        minQty,
        price,
        ...(variantPrices ? { variantPrices } : {}),
      };
    })
    .filter((t) => Number.isInteger(t.minQty) && t.minQty > 1 && Number.isFinite(t.price) && t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

/**
 * Menemukan tier partai yang berlaku berdasarkan kuantitas pesanan.
 * Jika kuantitas memenuhi beberapa tier (misal order 35 ekor memenuhi tier 10 dan 30),
 * tier tertinggi (tier 30) yang digunakan.
 * 
 * @param {Object} product - Objek produk
 * @param {number} quantity - Jumlah yang dipesan
 * @param {Object|null} variant - Objek varian (opsional)
 * @returns {Object|null} { tier, unitPrice, basePrice, discountPerItem, percentDiscount }
 */
export function getApplicableWholesaleTier(product, quantity, variant = null) {
  if (!product || !product.isWholesale) return null;

  const tiers = normalizeWholesaleTiers(product.wholesaleTiers);
  if (tiers.length === 0) return null;

  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1) return null;

  // Base price
  const productBasePrice = parseFloat(product.price || 0);
  const variantBasePrice = (variant?.price != null && variant.price !== '')
    ? parseFloat(variant.price)
    : productBasePrice;

  // Filter tiers where qty >= tier.minQty, lalu ambil tier dengan minQty terbesar
  const eligibleTiers = tiers.filter((t) => qty >= t.minQty);
  if (eligibleTiers.length === 0) return null;

  const activeTier = eligibleTiers[eligibleTiers.length - 1]; // sorted ascending, last is highest
  let unitPrice = activeTier.price;

  // 1. Prioritas Utama: Cek apakah ada Override Harga Kustom khusus varian ini
  const variantKey = variant?.size || variant?.name;
  const customVariantPrice = (variantKey && activeTier.variantPrices && activeTier.variantPrices[variantKey] != null)
    ? parseFloat(activeTier.variantPrices[variantKey])
    : null;

  if (Number.isFinite(customVariantPrice) && customVariantPrice > 0) {
    unitPrice = customVariantPrice;
  } else if (variantBasePrice !== productBasePrice && productBasePrice > 0) {
    // 2. Solusi Varian Beda Harga Otomatis (Proportional Discount):
    // Jika varian memiliki harga khusus dan belum ada override kustom,
    // terapkan persentase potongan tier secara adil ke harga varian tersebut.
    const discountRatio = Math.max(0, (productBasePrice - activeTier.price) / productBasePrice);
    unitPrice = Math.round(variantBasePrice * (1 - discountRatio));
  }

  const discountPerItem = Math.max(0, variantBasePrice - unitPrice);
  const percentDiscount = variantBasePrice > 0 ? Math.round((discountPerItem / variantBasePrice) * 100) : 0;

  return {
    tier: activeTier,
    minQty: activeTier.minQty,
    unitPrice,
    basePrice: variantBasePrice,
    discountPerItem,
    percentDiscount,
  };
}

/**
 * Menghitung harga satuan efektif (effective unit price)
 * Memperhitungkan varian dan harga partai jika kuantitas mencukupi.
 * 
 * @param {Object} product 
 * @param {Object|null} variant 
 * @param {number} quantity 
 * @returns {number}
 */
export function getEffectiveUnitPrice(product, variant, quantity) {
  const basePrice = (variant?.price != null && variant.price !== '')
    ? parseFloat(variant.price)
    : parseFloat(product?.price || 0);

  const wholesaleMatch = getApplicableWholesaleTier(product, quantity, variant);
  if (wholesaleMatch && wholesaleMatch.unitPrice < basePrice) {
    return wholesaleMatch.unitPrice;
  }

  return basePrice;
}

/**
 * Validasi input tiers di admin form
 * @param {Array} rawTiers
 * @param {number} regularPrice
 * @returns {{ valid: boolean, error?: string, tiers: Array<{minQty: number, price: number}> }}
 */
export function validateWholesaleTiersInput(rawTiers, regularPrice) {
  if (!Array.isArray(rawTiers) || rawTiers.length === 0) {
    return { valid: false, error: 'Minimal 1 tier harga partai harus diisi.', tiers: [] };
  }

  const base = parseFloat(regularPrice);
  const sanitized = [];
  const seenMinQty = new Set();

  for (let i = 0; i < rawTiers.length; i++) {
    const item = rawTiers[i];
    const minQty = parseInt(item.minQty, 10);
    const price = parseFloat(item.price);

    if (!Number.isInteger(minQty) || minQty < 2) {
      return { valid: false, error: `Tier ke-${i + 1}: Minimal pesanan harus berupa angka bulat minimal 2.` };
    }
    if (seenMinQty.has(minQty)) {
      return { valid: false, error: `Tier ke-${i + 1}: Kuantitas minimal ${minQty} tidak boleh duplikat.` };
    }
    seenMinQty.add(minQty);

    if (!Number.isFinite(price) || price <= 0) {
      return { valid: false, error: `Tier ke-${i + 1}: Harga satuan partai harus lebih dari Rp 0.` };
    }
    if (Number.isFinite(base) && base > 0 && price >= base) {
      return { valid: false, error: `Tier ke-${i + 1}: Harga satuan partai (Rp ${price.toLocaleString('id-ID')}) harus lebih murah dari harga normal (Rp ${base.toLocaleString('id-ID')}).` };
    }

    let variantPrices = undefined;
    if (item.variantPrices && typeof item.variantPrices === 'object' && !Array.isArray(item.variantPrices)) {
      variantPrices = {};
      for (const [k, v] of Object.entries(item.variantPrices)) {
        const num = parseFloat(v);
        if (Number.isFinite(num) && num > 0) {
          variantPrices[k] = num;
        }
      }
      if (Object.keys(variantPrices).length === 0) variantPrices = undefined;
    }

    sanitized.push({ minQty, price, ...(variantPrices ? { variantPrices } : {}) });
  }

  // Sort ascending by minQty
  sanitized.sort((a, b) => a.minQty - b.minQty);

  // Validate that higher minQty has equal or lower price (progressive discount)
  for (let i = 1; i < sanitized.length; i++) {
    if (sanitized[i].price > sanitized[i - 1].price) {
      return {
        valid: false,
        error: `Tier kuantitas ${sanitized[i].minQty} ekor (Rp ${sanitized[i].price.toLocaleString('id-ID')}) tidak boleh lebih mahal dari tier ${sanitized[i - 1].minQty} ekor (Rp ${sanitized[i - 1].price.toLocaleString('id-ID')}).`,
      };
    }
  }

  return { valid: true, tiers: sanitized };
}

