---
name: rajaongkir-komerce-debug
description: Debug Komerce Ongkir (RajaOngkir v1) integration. Invoke on shipping-rate errors, "kok ongkirnya sama" reports, city lookup failures, missing courier options, or when adapting to Komerce API changes. Covers auth, endpoints, response format, common pitfalls.
---

# Komerce Ongkir Debug

Codebase reference: `src/lib/shipping.js` (wrapper), `src/app/api/shipping/rates/route.js`, `src/app/api/shipping/cities/route.js`

## Environment vars (in `.env`)

| Var | Purpose |
|---|---|
| `RAJAONGKIR_API_KEY` | **Shipping Cost** key from Komerce dashboard baris #1 — NOT the Payment API or QRISLY key (past bug: user pasted Payment key by mistake) |
| `SHIPPING_ORIGIN_CITY_ID` | Numeric merchant destination id (see § "Find your origin id") |
| `RAJAONGKIR_BASE` | Default `https://rajaongkir.komerce.id/api/v1`. Override if Komerce moves URL |
| `SHIPPING_COURIERS` | Comma-separated: `jne,pos,tiki` (free tier). Add `jnt,sicepat` if account has access |
| `SHIPPING_ITEMS_PER_KG` | Default 10. Weight formula: `Math.ceil(qty/n) * 1000` grams |

## Endpoint reference

### 1. Search destination
```
GET /destination/domestic-destination?search=<q>&limit=<n>&offset=<n>
Headers: key: <API_KEY>
```
Response:
```json
{
  "meta": { "message": "OK", "code": 200, "status": "success" },
  "data": [
    { "id": 71867, "label": "BAGO, TULUNGAGUNG, TULUNGAGUNG, JAWA TIMUR, 66218",
      "province_name": "JAWA TIMUR", "city_name": "TULUNGAGUNG",
      "district_name": "TULUNGAGUNG", "subdistrict_name": "BAGO", "zip_code": "66218" }
  ]
}
```

### 2. Calculate cost (Starter tier: 1 courier per request, loop for multiple)
```
POST /calculate/domestic-cost
Headers: key: <API_KEY>
        Content-Type: application/x-www-form-urlencoded
Body:   origin=<id>&destination=<id>&weight=<grams>&courier=jne
```
Response:
```json
{
  "meta": { "message": "OK", "code": 200, "status": "success" },
  "data": [
    { "name": "JNE", "code": "jne", "service": "REG",
      "description": "Layanan Reguler", "cost": 44000, "etd": "2-3 day" }
  ]
}
```

## Find your `SHIPPING_ORIGIN_CITY_ID` (one-time setup)

1. Set `RAJAONGKIR_API_KEY` in `.env`, restart dev server
2. Login as admin
3. Browser: `http://localhost:3000/api/shipping/cities?q=<yourcity>` (e.g. `?q=tulungagung`)
4. Find entry matching your `zip_code` + `subdistrict_name`
5. Copy the numeric `id` to `SHIPPING_ORIGIN_CITY_ID`

Fallback searches if name yields nothing:
- `?q=<postal_code>` (e.g. `?q=66218`) — often unique
- `?q=<kecamatan>`
- `?q=<kelurahan>`

## Common errors

### `SHIPPING_ORIGIN_CITY_ID belum di-set...`
- You haven't set it yet
- Past bug: my `searchCities` also required this, causing chicken-and-egg (city search couldn't run without origin). Fix: `searchCities` uses `baseConfig()` (key + base only), not full `config()`

### `RAJAONGKIR_API_KEY belum di-set...`
- Not in `.env`, or dev server not restarted after adding

### 401 / 403 from Komerce
- Wrong key type (Payment API / QRISLY instead of Shipping Cost)
- Key expired / revoked
- Free tier quota exhausted (100 req/day) — check dashboard "Total API HIT / Day"

### `Gagal cari destinasi.`
- Search string too generic or misspelled
- Try postal code fallback

### "Kota tujuan tidak ditemukan..."
- `resolveDestinationId` couldn't match `postalCode` OR `cityName` to any entry
- Debug: log `hits` in `resolveDestinationId`, verify search returns non-empty
- Postal codes overlap kelurahan (e.g. 66218 hits Bago in Tulungagung — check first result is correct kabupaten)

### All couriers return same price for different destinations
- Root cause almost always: `useEffect` deps unstable in checkout page → same fetch keeps running with stale state (past bug — see `react-hooks-safety` skill)
- Verify server-side: hit `/api/shipping/rates` via curl with different postal codes, confirm different prices come back
- If server returns different values but UI shows same → deps bug in checkout

### Cost is 0 or missing for enabled courier
- Courier not available in free tier (JNT, SiCepat sometimes Pro-only)
- Route not covered (very remote destination)
- Weight exceeds courier limit
- Per-courier response fails silently — my `fetchCostForCourier` returns `[]` on error so one bad courier doesn't kill the quote

## Weight formula (per `src/lib/shipping.js`)

```js
const totalQty = items.reduce((s, i) => s + parseInt(i.quantity), 0);
const packagesKg = Math.max(1, Math.ceil(totalQty / cfg.itemsPerKg));
const weight = packagesKg * 1000; // grams
```

- 1-10 ikan = 1 kg
- 11-20 ikan = 2 kg
- 21-30 ikan = 3 kg
- Configurable via `SHIPPING_ITEMS_PER_KG` env var

## Anti-fraud pattern (order creation)

Never trust `shippingFee` from client body. `POST /api/orders` re-quotes via `findAndValidateRate({destinationPostal, destinationCity, items, courier, service})`:
- Fetches fresh rates from Komerce
- Matches on `courier_code` + `courier_service_code`
- Uses that price as authoritative `shippingFee`
- Rejects if service no longer offered (400)

Same pattern as payment-fraud fix on `total` — server never trusts a fee it didn't just compute.

## When Komerce API changes

If Komerce migrates or renames endpoints:
1. Update `DEFAULT_BASE` in `src/lib/shipping.js`
2. Or override via `.env` `RAJAONGKIR_BASE`
3. If response shape changes, update `fetchCostForCourier` mapping (map `r.code` / `r.service` / `r.cost` / `r.etd` to our stable UI shape)
4. Keep public `fetchRates()` / `findAndValidateRate()` signatures unchanged — that's what checkout + order route depend on
