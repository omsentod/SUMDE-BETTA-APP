---
name: test-doku-webhook
description: Send a real HTTP webhook to /api/payment/doku/webhook with a valid HMAC signature, testing signature verification, timestamp check, amount check, and idempotency. Different from doku-payment-simulator which manipulates the DB directly — this one exercises the actual endpoint end-to-end. Use when debugging webhook rejection, verifying a hardened webhook still accepts valid DOKU requests, or reproducing a specific webhook edge case.
---

# Test DOKU Webhook (HTTP path)

Purpose: exercise the `/api/payment/doku/webhook` endpoint over real HTTP with a properly signed request. This validates signature verification, timestamp checks, amount comparison, and status transitions — none of which the direct-DB `doku-payment-simulator` covers.

## When to use this skill instead of `doku-payment-simulator`

Use **this skill** when:
- Debugging why webhook returns 401 / 400 (signature, timestamp, amount)
- Verifying a security hardening change (e.g. amount mismatch guard) still allows valid webhooks through
- Reproducing an edge case (replay, wrong amount, stale timestamp, unknown status)
- Testing after changing `DOKU_SECRET_KEY` or signature logic

Use **`doku-payment-simulator`** when:
- You just want to flip an order PENDING → PROCESSING quickly, no HTTP round-trip
- Testing stock decrement logic
- Development flow where webhook mechanics don't matter

## Prerequisites

1. Dev server running: `npm run dev` (default `http://localhost:3000`)
2. `.env` has valid `DOKU_SECRET_KEY` (sandbox key is fine)
3. A `PENDING` order exists — check with:
   ```bash
   node -e "const {PrismaClient}=require('@prisma/client'); new PrismaClient().order.findMany({where:{status:'PENDING'},take:5,select:{id:true,total:true}}).then(console.log)"
   ```

## How to build a valid webhook request

The webhook validates a signature built from these components (see `src/lib/doku.js`):

```
Client-Id:<client-id>
Request-Id:<uuid>
Request-Timestamp:<iso8601 without ms, e.g. 2026-07-29T14:30:00Z>
Request-Target:/api/payment/doku/webhook
Digest:<sha256(body).base64>
```

Signature = `HMACSHA256=<hmac-sha256(components, secretKey).base64>`

Order matters — components joined by `\n`. Timestamp must be within 5 minutes of server clock (see `MAX_TIMESTAMP_SKEW_MS`).

## One-shot helper script

Write this to `scratch/test_webhook.js` (or use existing if present):

```js
// scratch/test_webhook.js
// Usage: node scratch/test_webhook.js <ORDER_ID> [status]
//   status defaults to SUCCESS. Valid: SUCCESS, FAILED, EXPIRED, VOID, CANCELLED, PENDING, REFUNDED

const crypto = require('crypto');

const [, , orderId, statusArg = 'SUCCESS'] = process.argv;
if (!orderId) {
  console.error('Usage: node scratch/test_webhook.js <ORDER_ID> [status]');
  process.exit(1);
}

require('dotenv').config();
const secretKey = process.env.DOKU_SECRET_KEY;
const clientId = process.env.DOKU_CLIENT_ID || 'BRN-TEST';
if (!secretKey) { console.error('DOKU_SECRET_KEY missing in .env'); process.exit(1); }

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) { console.error('Order not found:', orderId); process.exit(1); }

  const payload = {
    order: {
      invoice_number: `${order.id}_${Date.now()}`,
      amount: Math.round(order.total),
    },
    payment: { status: statusArg },
  };
  const body = JSON.stringify(payload);

  const requestTarget = '/api/payment/doku/webhook';
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString().split('.')[0] + 'Z';

  const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
  const components = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`,
  ].join('\n');
  const signature = 'HMACSHA256=' + crypto.createHmac('sha256', secretKey).update(components).digest('base64');

  const res = await fetch('http://localhost:3000' + requestTarget, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Request-Id': requestId,
      'Request-Timestamp': timestamp,
      'Signature': signature,
    },
    body,
  });
  console.log(res.status, await res.text());
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

## Test matrix

Run each of these to verify the webhook's guards work:

| Scenario | Command | Expected |
|---|---|---|
| Happy path | `node scratch/test_webhook.js <order-id> SUCCESS` | 200 + order → PROCESSING + stock decremented |
| Replay (same order twice) | run happy path twice | 2nd call: 200 but order stays PROCESSING (idempotent) |
| Wrong amount | edit script to send `amount: 1` | 400 "Amount mismatch." + order stays PENDING |
| Stale timestamp | edit script: `timestamp = new Date(Date.now() - 600000).toISOString()...` | 401 "Timestamp out of range." |
| Bad signature | edit script: append 'x' to signature | 401 "Signature mismatch." |
| Missing header | delete `Client-Id` from headers | 401 "Missing security headers." |
| Failed status | `node scratch/test_webhook.js <order-id> FAILED` | 200 + order → CANCELLED, no stock change |
| Unknown status | `node scratch/test_webhook.js <order-id> REFUNDED` | 200 + logged warning + no status change |

## Debugging tips

- **Signature mismatch**: 99% of the time, cause is either wrong `DOKU_SECRET_KEY` or wrong newline joining. Double-check `components.join('\n')` — NOT `\r\n`.
- **Timestamp errors**: server and script must agree within 5 minutes. If testing on a VM with clock drift, sync NTP first.
- **Amount errors**: server compares `Math.round(order.total)` — if your DB has a float total, rounding might differ from what DOKU sends in production. Always round both sides.
- **Prisma errors**: if `PrismaClientKnownRequestError`, run `npx prisma db push` and restart dev server.

## Do NOT do

- Don't paste real DOKU production signatures into logs, git, or Claude context — they are secrets equivalent to API keys
- Don't test amount mismatch against a real order in production — this leaves an audit-log entry that looks like fraud
- Don't hardcode `DOKU_SECRET_KEY` in any script that might be committed
