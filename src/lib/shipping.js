// Biteship Shipping API integration
//
// Configuration:
//   BITESHIP_API_KEY              - API Key from Biteship Dashboard
//   BITESHIP_ORIGIN_POSTAL_CODE   - Numeric postal code of merchant
//   BITESHIP_BASE                 - default: https://api.biteship.com/v1
//   SHIPPING_COURIERS             - comma separated (default: pos)
//   SHIPPING_ITEMS_PER_KG         - default 10

const DEFAULT_BASE = 'https://api.biteship.com/v1';
const DEFAULT_COURIERS = 'pos';
// Berapa ekor ikan per 1 kg paket. 10 ikan = 1 kg, 11 ikan = 2 kg, dst.
const DEFAULT_ITEMS_PER_KG = 10;
// Kode layanan yang tidak cocok untuk ikan hidup — kirim via truk cargo
// bisa 3-7 hari, ikan bakal mati. Filter sebelum dikirim ke client.
const EXCLUDED_SERVICES = new Set(['jtr', 'jtr250', 'jtr<250', 'trucking']);

function baseConfig() {
  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) throw configError('BITESHIP_API_KEY belum di-set. Dapatkan dari dashboard Biteship.');
  const base = process.env.BITESHIP_BASE || DEFAULT_BASE;
  return { apiKey, base };
}

function config() {
  const { apiKey, base } = baseConfig();
  const originPostal = process.env.BITESHIP_ORIGIN_POSTAL_CODE;
  if (!originPostal) throw configError('BITESHIP_ORIGIN_POSTAL_CODE belum di-set di .env.');
  const couriers = process.env.SHIPPING_COURIERS || DEFAULT_COURIERS;
  const itemsPerKg = Number(process.env.SHIPPING_ITEMS_PER_KG) || DEFAULT_ITEMS_PER_KG;
  return { apiKey, base, originPostal, couriers, itemsPerKg };
}

function configError(message) {
  const err = new Error(message);
  err.status = 500;
  return err;
}

// --- Maps Search (Biteship) ---
// Admin-only search across Biteship's area database. Used ONCE during setup
// to find the merchant's own postal code/location.
export async function searchCities(query, { limit = 25 } = {}) {
  if (!query) return [];
  const { apiKey, base } = baseConfig();
  const res = await fetch(`${base}/maps/areas?countries=ID&input=${encodeURIComponent(query)}`, {
    headers: { 'Authorization': apiKey }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Gagal mencari lokasi di Biteship.');
  }
  
  // Biteship returns: { areas: [ { id, name, administrative_division_level_1_name: province, level_2: city, level_3: district, postal_code } ] }
  // We map it to the old Komerce format so the Admin API route / UI doesn't break
  const areas = data.areas || [];
  return areas.map(a => ({
    id: a.id,
    label: `${a.name}, ${a.administrative_division_level_3_name}, ${a.administrative_division_level_2_name}, ${a.administrative_division_level_1_name}, ${a.postal_code}`,
    province_name: a.administrative_division_level_1_name,
    city_name: a.administrative_division_level_2_name,
    district_name: a.administrative_division_level_3_name,
    subdistrict_name: a.name,
    zip_code: a.postal_code
  })).slice(0, limit);
}

// --- Cost quote (Biteship) ---
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
  
  if (!destinationPostal || !/^\d{5}$/.test(String(destinationPostal))) {
    const err = new Error('Kode pos tujuan tidak valid. Biteship membutuhkan kode pos 5 digit.');
    err.status = 400; throw err;
  }

  const totalQty = items.reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0);
  const packagesKg = Math.max(1, Math.ceil(totalQty / cfg.itemsPerKg));
  const weightGrams = packagesKg * 1000;

  const payload = {
    origin_postal_code: parseInt(cfg.originPostal),
    destination_postal_code: parseInt(destinationPostal),
    couriers: cfg.couriers,
    items: [
      {
        name: "Ikan Betta",
        description: "Paket Ikan Hidup",
        value: 100000,
        quantity: 1,
        weight: weightGrams
      }
    ]
  };

  const res = await fetch(`${cfg.base}/rates/couriers`, {
    method: 'POST',
    headers: {
      'Authorization': cfg.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  if (!res.ok || !data.success) {
    const msg = data.error || data.message || 'Gagal mengambil ongkir Biteship.';
    const err = new Error(msg);
    err.status = res.status || 502;
    throw err;
  }

  const pricing = Array.isArray(data.pricing) ? data.pricing : [];
  
  return pricing.map(r => ({
    courier_code: r.company || r.courier_code,
    courier_name: r.courier_name,
    courier_service_code: r.courier_service_code,
    courier_service_name: r.description || r.courier_service_name,
    duration: r.duration || null,
    price: r.price
  })).filter((r) => {
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

// --- Order & Fulfillment (Biteship) ---
export async function createShipment(order, totalQty) {
  const cfg = config();
  const packagesKg = Math.max(1, Math.ceil(totalQty / cfg.itemsPerKg));
  const weightGrams = packagesKg * 1000;

  // POS Indonesia's pickup collection method rejects the order without a
  // precise origin coordinate ("coordinate is required for pickup collection
  // method for pos indonesia") — the postal code alone isn't enough for them
  // to route a courier to the exact pickup point. Only required here, not in
  // config()/fetchRates(), since /rates/couriers works fine without it.
  const originLat = process.env.BITESHIP_ORIGIN_LATITUDE;
  const originLng = process.env.BITESHIP_ORIGIN_LONGITUDE;
  if (!originLat || !originLng) {
    throw configError('BITESHIP_ORIGIN_LATITUDE / BITESHIP_ORIGIN_LONGITUDE belum di-set di .env.');
  }

  const payload = {
    shipper_contact_name: "Sumde Betta",
    shipper_contact_phone: "081234567890", // Ganti dengan nomor asli
    origin_contact_name: "Sumde Betta",
    origin_contact_phone: "081234567890",
    origin_address: "Markas Sumde Betta, Tulungagung",
    origin_postal_code: parseInt(cfg.originPostal),
    origin_coordinate: {
      latitude: parseFloat(originLat),
      longitude: parseFloat(originLng),
    },

    destination_contact_name: order.name,
    destination_contact_phone: order.phone,
    destination_contact_email: order.email || "buyer@sumdebetta.com",
    destination_address: `${order.streetAddress}, ${order.rtRw}, Kel. ${order.village}, Kec. ${order.district}, Kota/Kab. ${order.city}, Prov. ${order.province}`,
    destination_postal_code: parseInt(order.postalCode || cfg.originPostal),

    courier_company: order.shippingCourier || "pos",
    courier_type: order.shippingService || "reg",
    delivery_type: "now",

    items: [
      {
        name: "Ikan Betta",
        description: "Paket Ikan Hidup",
        value: order.subtotal,
        quantity: 1,
        weight: weightGrams
      }
    ]
  };

  const res = await fetch(`${cfg.base}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': cfg.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Gagal memanggil kurir via Biteship.');
  }
  return data;
}

function isSameTrackingStep(a, b) {
  if (!a || !b) return false;
  const statusSame = a.status === b.status;
  const noteSame =
    String(a.note ?? '').trim().toLowerCase() ===
    String(b.note ?? '').trim().toLowerCase();
  return statusSame && noteSame;
}

// Biteship's tracking history — terutama di sandbox/test atau retry kurir — sering
// mengembalikan status berulang (mis. "dropping_off" dan "on_hold" ping-pong
// bergantian di jam/menit yang sama), padahal timeline kurir yang normal
// hanya punya satu baris per milestone/drop-point.
// Gabungkan duplikat berurutan langsung (A -> A) maupun siklus bolak-balik (A -> B -> A -> B)
// yang status + catatannya identik, serta pertahankan timestamp terbaru di run tersebut.
// Aman untuk data kurir asli: scan asli selalu punya catatan lokasi/hub berbeda
// (mis. "[Surabaya Gateway]" vs "[Jakarta Gateway]"), sehingga perpindahan drop-point
// nyata tidak akan pernah ter-collapse.
export function collapseTrackingHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = [];

  for (const h of history) {
    if (!h) continue;

    // 1. Duplikat berurutan langsung (A -> A)
    const prev = out[out.length - 1];
    if (isSameTrackingStep(prev, h)) {
      if (h.updated_at) prev.updated_at = h.updated_at;
      continue;
    }

    // 2. Siklus selang-seling 2-langkah / ping-pong (A -> B -> A -> B)
    // Sering terjadi pada simulator sandbox kurir yang bolak-balik dropping_off & on_hold
    const prevPrev = out[out.length - 2];
    if (prev && prevPrev && isSameTrackingStep(prevPrev, h)) {
      if (h.updated_at) prevPrev.updated_at = h.updated_at;
      out.splice(out.length - 2, 1);
      out.push(prevPrev);
      continue;
    }

    out.push({ ...h });
  }

  return out;
}

export async function getTrackingDetails(waybillId, courierCode) {
  const cfg = config();
  const res = await fetch(`${cfg.base}/trackings/${waybillId}/couriers/${courierCode}`, {
    method: 'GET',
    headers: {
      'Authorization': cfg.apiKey
    }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Gagal melacak paket.');
  }
  // Bersihkan history dari duplikat beruntun sebelum sampai ke UI (payload kecil
  // + timeline terbaca seperti e-commerce normal, bukan tembok baris identik).
  return { ...data, history: collapseTrackingHistory(data.history) };
}

// Fetch a Biteship order by its shipment id (the `biteshipShipmentId` we
// stored at booking). Unlike getTrackingDetails, this works even before a
// waybill is assigned — the response carries top-level `status` plus
// `courier.waybill_id` / `courier.history`. Used by the reconcile cron to
// catch orders whose status webhook never arrived.
export async function getBiteshipOrder(biteshipOrderId) {
  const cfg = config();
  const res = await fetch(`${cfg.base}/orders/${biteshipOrderId}`, {
    method: 'GET',
    headers: { 'Authorization': cfg.apiKey },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Gagal mengambil detail order Biteship.');
  }
  return data;
}
