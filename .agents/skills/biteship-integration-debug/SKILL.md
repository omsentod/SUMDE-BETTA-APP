---
name: biteship-integration-debug
description: Debug Biteship shipping integration (rates, area search, order booking, tracking, webhook). Invoke on shipping-rate errors, "kok ongkirnya sama", area search failures, missing courier options, waybill/AWB not appearing, tracking failures, webhook status not updating, or when adapting to Biteship API changes. Covers auth, endpoints, response shape, shipment lifecycle, and common pitfalls specific to this codebase.
---

# Biteship Shipping Debug

Codebase reference:
- `src/lib/shipping.js` — wrapper (rates, area search, order, tracking)
- `src/app/api/shipping/rates/route.js` — rate quote used at checkout
- `src/app/api/shipping/cities/route.js` — admin one-time area lookup (setup)
- `src/app/api/admin/orders/[id]/shipment/route.js` — book courier + get waybill
- `src/app/api/shipping/track/route.js` — public tracking passthrough
- `src/app/api/shipping/webhook/route.js` — Biteship → us status callback

## Environment vars (in `.env`)

| Var | Purpose |
|---|---|
| `BITESHIP_API_KEY` | API key from Biteship Dashboard → Integration → API. Header value used raw (not `Bearer ...`) |
| `BITESHIP_ORIGIN_POSTAL_CODE` | Numeric 5-digit postal code of merchant warehouse. NOT city id — Biteship keys pricing off postal codes |
| `BITESHIP_BASE` | Default `https://api.biteship.com/v1`. Override if Biteship moves URL |
| `BITESHIP_WEBHOOK_SECRET` | HMAC secret shared with Biteship webhook config. Required — see webhook section |
| `SHIPPING_COURIERS` | Comma-separated: `jnt,jne,sicepat,anteraja,gojek,grab,pos`. Enabled per account tier |
| `SHIPPING_ITEMS_PER_KG` | Default 10. Weight formula: `Math.ceil(qty/n) * 1000` grams |

## Auth header — trap

Biteship uses raw `Authorization: <API_KEY>` — **not** `Bearer <API_KEY>`. If you copy-paste the header from other SDKs and add `Bearer`, expect 401. All fetch calls in `shipping.js` set the header this way; keep it.

## Endpoint reference

### 1. Search areas (setup + city dropdown)
```
GET /v1/maps/areas?countries=ID&input=<q>
Headers: Authorization: <API_KEY>
```
Response:
```json
{
  "success": true,
  "areas": [
    {
      "id": "IDNP12IDNC128IDND1953IDNZ39316",
      "name": "Bago",
      "administrative_division_level_1_name": "Jawa Timur",
      "administrative_division_level_2_name": "Kabupaten Tulungagung",
      "administrative_division_level_3_name": "Tulungagung",
      "postal_code": 66218
    }
  ]
}
```

Mapped in `searchCities()` back to the Komerce-shaped `{ id, label, province_name, city_name, district_name, subdistrict_name, zip_code }` so the admin API + UI didn't need to change during migration. Keep this mapping stable.

### 2. Rate quote (bulk — all enabled couriers in one call)
```
POST /v1/rates/couriers
Headers: Authorization: <API_KEY>
        Content-Type: application/json
Body:
{
  "origin_postal_code": 66218,
  "destination_postal_code": 12190,
  "couriers": "jnt,jne,sicepat",
  "items": [{ "name": "Ikan Betta", "value": 100000, "quantity": 1, "weight": 1000 }]
}
```
Response:
```json
{
  "success": true,
  "pricing": [
    { "company": "jnt", "courier_name": "J&T",
      "courier_service_code": "EZ", "description": "Regular",
      "duration": "2-3 days", "price": 22000 }
  ]
}
```

Notes:
- `company` maps to our `courier_code` (fallback to `courier_service_code` if missing).
- `description` is the human service name; fallback to `courier_service_name`.
- Biteship groups all couriers in one call — no per-courier loop like Komerce.
- `EXCLUDED_SERVICES` set in `shipping.js` filters out `jtr`, `trucking`, etc. — cargo services will kill live betta. Keep filtering on both `courier_service_code` and lowercased `courier_service_name` including `"trucking"`.

### 3. Book courier (create shipment)
```
POST /v1/orders
Headers: Authorization: <API_KEY>
        Content-Type: application/json
Body: (see `createShipment` in shipping.js for full shape)
```
Response:
```json
{
  "success": true,
  "id": "62f4b8d9c0a1e00012ab3cde",
  "status": "confirmed",
  "courier": { "waybill_id": "JP0000123456", "tracking_id": "..." }
}
```

**⚠ Waybill timing gotcha**: `courier.waybill_id` is often `null` on the immediate `POST /orders` response — it appears later when the courier is `allocated` / `picking_up` and comes in via webhook. Do **not** blindly overwrite `trackingNumber` with a fallback like `TEST-...` on second call — see "Common bugs" §Race.

### 4. Track shipment
```
GET /v1/trackings/<waybill_id>/couriers/<courier_code>
Headers: Authorization: <API_KEY>
```
Response includes `history: [{ updated_at, note, status }]` — passed through by `/api/shipping/track` to customer orders page.

### 5. Webhook (Biteship → us)
Biteship POSTs to `/api/shipping/webhook`. Two events are handled:

**`order.status`** — status transitions:
```json
{
  "event": "order.status",
  "order_id": "62f4b8d9c0a1e00012ab3cde",
  "status": "picked",
  "waybill_id": "JP0000123456"
}
```

**`order.waybill_id`** — AWB assigned by courier (arrives separately, often minutes after `POST /orders` returned with `courier.waybill_id: null`):
```json
{
  "event": "order.waybill_id",
  "order_id": "62f4b8d9c0a1e00012ab3cde",
  "waybill_id": "JP0000123456"
}
```

Enable **both** events in the Biteship dashboard. Without `order.waybill_id`, orders whose AWB is async-allocated will stay in `PROCESSING` forever — the customer never sees a tracking number.

Also available but **NOT** enabled: `order.price` (fires when Biteship finalizes actual shipping price post-weighing). Enable only if you want accounting alerts on quote-vs-actual drift — needs a new handler.

Header: `biteship-signature: <HMAC>`.

**Install-time probe**: at "Save Webhook" in the Biteship dashboard, they POST to the URL with an **empty body and no signature header** to check the URL is reachable. If the endpoint 401s, the dashboard shows: *"Webhook URL doesn't respond with ok response. Please make sure it respond with ok upon installation, by disabling validation, and accepting empty request body for application/json."* Handler must return 200 for empty body BEFORE the signature check — safe because no body means no state mutation.

Verification (currently NOT implemented — HIGH-severity gap, see `audit-new-api-route`):
```js
import crypto from 'crypto';
const raw = await request.text();      // must be raw body, not parsed
const expected = crypto.createHmac('sha256', process.env.BITESHIP_WEBHOOK_SECRET)
  .update(raw).digest('hex');
const provided = Buffer.from(request.headers.get('biteship-signature') || '', 'hex');
const expectedBuf = Buffer.from(expected, 'hex');
if (provided.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(provided, expectedBuf)) {
  return NextResponse.json({ error: 'bad signature' }, { status: 401 });
}
const body = JSON.parse(raw);
```
Confirm exact digest algorithm + header encoding against your Biteship dashboard — vendor docs occasionally use base64 vs hex differently. Mirror `src/lib/doku.js` verify pattern.

## Shipment status mapping (Biteship → our enum)

Biteship emits many statuses. Our order enum is `PENDING | PROCESSING | SHIPPED | COMPLETED | CANCELLED`.

| Biteship `status` | Our `status` | Notes |
|---|---|---|
| `confirmed`, `allocated` | (no change) | Courier assigned, waybill may arrive later — persist `biteshipStatus` and `waybill_id` when present, don't move `order.status` yet |
| `picking_up` | (no change, or `SHIPPED` if you consider pickup = shipped) | Codebase currently keeps `PROCESSING` here |
| `picked`, `dropping_off` | `SHIPPED` | |
| `delivered` | `COMPLETED` | |
| `cancelled`, `rejected` | `CANCELLED` **+ restock** | Stock was decremented at DOKU SUCCESS — must be returned inside `prisma.$transaction` (see AGENTS.md §3) |
| `returned` | Needs own state (`RETURNED`), NOT `CANCELLED` | Item was delivered then returned — different lifecycle. Current code lumps into `CANCELLED` which is wrong |
| `disposed`, `courier_not_found`, `on_hold` | Log only | Alert admin, don't auto-mutate |

**State-machine rule**: never move backward. If current status is `COMPLETED`, ignore any incoming `picked` / `SHIPPED` webhook (probably a duplicate old event). Enforce in the webhook handler with an ordered rank check.

## Find your `BITESHIP_ORIGIN_POSTAL_CODE` (one-time setup)

1. Set `BITESHIP_API_KEY` in `.env`, restart dev server
2. Login as admin
3. Browser: `http://localhost:3000/api/shipping/cities?q=<yourcity>` (e.g. `?q=tulungagung`)
4. Find entry matching your `subdistrict_name` (village) + district — the `zip_code` field is your postal code
5. Copy the numeric `zip_code` (5 digits) to `BITESHIP_ORIGIN_POSTAL_CODE`

Fallback searches if name yields nothing:
- `?q=<postal_code>` (e.g. `?q=66218`) — usually unique
- `?q=<kelurahan>`
- `?q=<kecamatan>`

## Weight formula (per `src/lib/shipping.js`)

```js
const totalQty = items.reduce((s, i) => s + parseInt(i.quantity), 0);
const packagesKg = Math.max(1, Math.ceil(totalQty / cfg.itemsPerKg));
const weight = packagesKg * 1000; // grams
```

- 1–10 ikan = 1 kg
- 11–20 ikan = 2 kg
- 21–30 ikan = 3 kg
- Configurable via `SHIPPING_ITEMS_PER_KG` env var

## Anti-fraud pattern (order creation)

Never trust `shippingFee` from client body. `POST /api/orders` re-quotes via `findAndValidateRate({ destinationPostal, destinationCity, items, courier, service })`:
- Fetches fresh rates from Biteship
- Matches on `courier_code` + `courier_service_code`
- Uses that price as authoritative `shippingFee`
- Rejects if the service is no longer offered (400)

Same pattern as payment-fraud fix on `total` — server never trusts a fee it didn't just compute.

## Common bugs (things we've hit or almost hit)

### `BITESHIP_API_KEY belum di-set...`
- Not in `.env`, or dev server not restarted after adding.

### `BITESHIP_ORIGIN_POSTAL_CODE belum di-set...`
- Same as above. Note: `searchCities` uses `baseConfig()` (key only) so admin can search areas *before* setting the origin — do not "fix" this by moving to `config()`, that reintroduces the chicken-and-egg (repro pattern from prior Komerce era).

### 401 / 403 from Biteship
- Header sent as `Bearer <key>` instead of raw `<key>`.
- Test key used against production endpoint (or vice-versa).
- Key expired / revoked in dashboard.

### `Kode pos tujuan tidak valid`
- Not 5 numeric digits. Biteship rejects `null`, letters, 4-digit, 6-digit. Enforced client-side in `fetchRates` too.

### All couriers return same price for different destinations
- Root cause almost always: unstable `useEffect` deps in checkout page → same rate call keeps firing with stale state (past bug — see `react-hooks-safety` skill).
- Verify server-side: curl `/api/shipping/rates` with different postal codes and confirm different prices come back.
- If server returns different values but UI shows same → deps bug in checkout.

### `pricing: []` (empty)
- No courier serves that lane. Try a different `destination_postal_code`.
- All returned services were filtered out by `EXCLUDED_SERVICES` (trucking-only routes to remote islands).
- `couriers` string has a code Biteship doesn't recognize — check the dashboard for exact codes (case-sensitive: `jnt` not `JNT`).

### Waybill never appears / stays `TEST-...`
- `courier.waybill_id` was `null` on `POST /orders` response and admin re-clicked "Panggil Kurir".
- **The race**: `shipment/route.js` guard checks `biteshipShipmentId && trackingNumber`. If only `biteshipShipmentId` exists (webhook `allocated` hit but waybill still pending), the second click reuses the existing `shipmentData` object which has no `courier.waybill_id`, so the fallback writes `TEST-<id>` into `trackingNumber` — polluting the real order.
- Fix: only write `trackingNumber` if `waybillNumber` came from `shipmentData.courier?.waybill_id`. Otherwise wait for the webhook to fill it.

### Webhook fires but order doesn't update
- Signature verification rejects (once implemented) — log `signature mismatch` and check `BITESHIP_WEBHOOK_SECRET` matches dashboard.
- `order_id` in webhook payload is Biteship's shipment id, NOT our Prisma id. `webhook/route.js` correctly looks up via `where: { biteshipShipmentId: order_id }` — don't try to match on `id`.
- Order was booked before this shipment record existed (no `biteshipShipmentId` yet) — race with `POST /orders` response persistence.

### Stock isn't returned on cancel
- Only DOKU SUCCESS decrements stock; the Biteship webhook must handle the reverse. Currently the handler flips status to `CANCELLED` but never restocks. Wrap the restock in `prisma.$transaction` and guard idempotency — see AGENTS.md §3.

### Tracking endpoint is public (no auth, no rate-limit)
- `/api/shipping/track` is currently unauthenticated. Add `rateLimit` from `src/lib/rateLimit.js` (per IP) or require the customer's session + verify the waybill belongs to one of their orders. Otherwise a scraper can burn our Biteship quota.

## When Biteship API changes

If Biteship migrates or renames endpoints:
1. Update `DEFAULT_BASE` in `src/lib/shipping.js`
2. Or override via `.env` `BITESHIP_BASE`
3. If response shape changes, update the mapping in `fetchRates` (`company` → `courier_code`, `description` → `courier_service_name`, etc.)
4. Keep public `fetchRates()` / `findAndValidateRate()` / `createShipment()` / `getTrackingDetails()` signatures unchanged — that's what checkout, order route, admin shipment route, and tracking route depend on
5. Update this SKILL.md same PR — don't let it rot like the Komerce version did
