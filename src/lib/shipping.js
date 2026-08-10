// Komerce Ongkir (Rajaongkir v1) integration.
// Docs: https://collaborator.komerce.id — "Ongkir Domestik" section.
//
// Key API differences from the legacy RajaOngkir Starter (classic /starter/*):
//   - Base URL: https://rajaongkir.komerce.id/api/v1 (not api.rajaongkir.com)
//   - Destination search endpoint: /destination/domestic-destination
//     (replaces classic /city — searches by name / postal instead of returning
//      the full country dump)
//   - Cost endpoint: /calculate/domestic-cost
//     (flat response shape — data[] with cost per service, no nested results[])
//   - Both endpoints use `key: <API_KEY>` in headers (unchanged)
//
// Configuration:
//   RAJAONGKIR_API_KEY        — required, the "Shipping Cost" key from
//                               Komerce dashboard (NOT the Payment / QRISLY key)
//   SHIPPING_ORIGIN_CITY_ID   — required, numeric destination id where you
//                               ship FROM. Find it with GET /api/shipping/cities?q=<yourcity>
//   RAJAONGKIR_BASE           — optional override; default is the Komerce URL
//   SHIPPING_COURIERS         — optional comma-separated (default: jnt).
//                               Layanan trucking (JNE JTR) selalu di-filter — tidak cocok untuk ikan hidup.
//   SHIPPING_ITEM_WEIGHT_G    — optional grams per item incl. packaging (default 1000)

const DEFAULT_BASE = 'https://rajaongkir.komerce.id/api/v1';
const DEFAULT_COURIERS = 'jnt';
// Berapa ekor ikan per 1 kg paket. 10 ikan = 1 kg, 11 ikan = 2 kg, dst.
const DEFAULT_ITEMS_PER_KG = 10;
// Kode layanan yang tidak cocok untuk ikan hidup — kirim via truk cargo
// bisa 3-7 hari, ikan bakal mati. Filter sebelum dikirim ke client.
const EXCLUDED_SERVICES = new Set(['jtr', 'jtr250', 'jtr<250', 'trucking']);

// Base config — only needs the API key. Used by the city-search endpoint,
// which the merchant hits BEFORE they know their origin id (that's the whole
// point of the search endpoint).
function baseConfig() {
  const apiKey = process.env.RAJAONGKIR_API_KEY;
  if (!apiKey) throw configError('RAJAONGKIR_API_KEY belum di-set. Isi dengan Shipping Cost key dari Komerce dashboard.');
  const base = process.env.RAJAONGKIR_BASE || DEFAULT_BASE;
  return { apiKey, base };
}

// Full config — also requires the origin id. Used by the rate-quote path.
function config() {
  const { apiKey, base } = baseConfig();
  const originId = process.env.SHIPPING_ORIGIN_CITY_ID;
  if (!originId) throw configError('SHIPPING_ORIGIN_CITY_ID belum di-set. Cari lewat GET /api/shipping/cities?q=<kotamu>.');
  const couriers = (process.env.SHIPPING_COURIERS || DEFAULT_COURIERS)
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const itemsPerKg = Number(process.env.SHIPPING_ITEMS_PER_KG) || DEFAULT_ITEMS_PER_KG;
  return { apiKey, base, originId, couriers, itemsPerKg };
}

function configError(message) {
  const err = new Error(message);
  err.status = 500;
  return err;
}

// --- Destination search (Komerce) -----------------------------------------
// Komerce doesn't have a "list all" endpoint — you search by query string.

async function searchDestinations(query, { apiKey, base, limit = 10, offset = 0 }) {
  const params = new URLSearchParams({
    search: query,
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`${base}/destination/domestic-destination?${params}`, {
    headers: { key: apiKey },
  });
  const data = await res.json();
  if (!res.ok || data?.meta?.code !== 200) {
    const err = new Error(data?.meta?.message || 'Gagal cari destinasi.');
    err.status = res.status || 502;
    throw err;
  }
  return Array.isArray(data.data) ? data.data : [];
}

/** Helper used by GET /api/shipping/cities?q=... so the merchant can find
 *  their origin id once during setup. Uses baseConfig — deliberately does NOT
 *  require SHIPPING_ORIGIN_CITY_ID (that's what this endpoint helps discover). */
export async function searchCities(query, { limit = 25 } = {}) {
  const { apiKey, base } = baseConfig();
  return searchDestinations(query, { apiKey, base, limit });
}

// --- Destination resolution -----------------------------------------------
// From a customer's address form, resolve the Komerce destination id.
// Prefer exact zip_code match, fall back to city_name / subdistrict name.

async function resolveDestinationId({ apiKey, base }, { postalCode, cityName }) {
  if (postalCode && /^\d{5}$/.test(String(postalCode))) {
    const hits = await searchDestinations(String(postalCode), { apiKey, base, limit: 10 });
    const exact = hits.find((d) => String(d.zip_code) === String(postalCode));
    if (exact) return exact.id;
    if (hits.length > 0) return hits[0].id;
  }
  if (cityName) {
    const hits = await searchDestinations(cityName, { apiKey, base, limit: 10 });
    if (hits.length > 0) return hits[0].id;
  }
  return null;
}

// --- Cost quote (Komerce) --------------------------------------------------
// Free / Starter tier: one courier per request. Loop through configured
// couriers and merge results.

async function fetchCostForCourier({ base, apiKey, origin, destination, weight, courier }) {
  const params = new URLSearchParams({
    origin: String(origin),
    destination: String(destination),
    weight: String(weight),
    courier,
  });
  const res = await fetch(`${base}/calculate/domestic-cost`, {
    method: 'POST',
    headers: { key: apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok || data?.meta?.code !== 200) {
    // One courier failing shouldn't kill the whole quote.
    return [];
  }
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map((r) => ({
    courier_code: (r.code || courier).toLowerCase(),
    courier_name: r.name || courier.toUpperCase(),
    courier_service_code: r.service,
    courier_service_name: r.description || r.service,
    duration: r.etd || null,
    price: Number(r.cost) || 0,
  }));
}

/**
 * Request live shipping rates for every enabled courier.
 *
 * @returns {Promise<Array<{ courier_code, courier_name, courier_service_code, courier_service_name, duration, price }>>}
 */
export async function fetchRates({ destinationPostal, destinationCity, items }) {
  const cfg = config();
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Item pesanan kosong.'); err.status = 400; throw err;
  }
  const destinationId = await resolveDestinationId(cfg, {
    postalCode: destinationPostal,
    cityName: destinationCity,
  });
  if (!destinationId) {
    const err = new Error('Lokasi tujuan tidak ditemukan di database ongkir. Periksa kode pos / kota.');
    err.status = 400; throw err;
  }
  const totalQty = items.reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0);
  // Weight rule: setiap 10 ikan = 1 kg (dibulatkan ke atas).
  //   1-10 ikan  → 1 kg
  //   11-20 ikan → 2 kg
  //   21-30 ikan → 3 kg, dst.
  const packagesKg = Math.max(1, Math.ceil(totalQty / cfg.itemsPerKg));
  const weight = packagesKg * 1000; // Komerce expects grams

  const perCourier = await Promise.all(
    cfg.couriers.map((courier) => fetchCostForCourier({
      base: cfg.base, apiKey: cfg.apiKey,
      origin: cfg.originId, destination: destinationId,
      weight, courier,
    }))
  );
  return perCourier.flat().filter((r) => {
    const svc = String(r.courier_service_code || '').toLowerCase().replace(/\s+/g, '');
    const name = String(r.courier_service_name || '').toLowerCase();
    return !EXCLUDED_SERVICES.has(svc) && !name.includes('trucking');
  });
}

/** Re-quote at order creation and confirm the client's chosen service still
 *  exists at the price we're about to charge. */
export async function findAndValidateRate({ destinationPostal, destinationCity, items, courier, service }) {
  const rates = await fetchRates({ destinationPostal, destinationCity, items });
  return rates.find(
    (r) => r.courier_code === courier && r.courier_service_code === service
  ) || null;
}
