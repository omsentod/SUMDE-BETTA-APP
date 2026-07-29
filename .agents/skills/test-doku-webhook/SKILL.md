---
name: test-doku-webhook
description: Send a real HTTP webhook to /api/payment/doku/webhook with a valid HMAC signature. Use for debugging signature rejection, verifying hardening changes (timestamp / amount checks) still let valid webhooks through, or reproducing edge cases (replay, wrong amount, stale timestamp). Different from doku-payment-simulator which manipulates DB directly.
---

# Test DOKU Webhook (HTTP path)

## When to use vs `doku-payment-simulator`
- **This skill (HTTP)**: debug signature / timestamp / amount rejection, verify webhook hardening
- **`doku-payment-simulator` (direct DB)**: quick PENDING → PROCESSING flip, stock decrement testing

## Prerequisites
- `npm run dev` running on `http://localhost:3000`
- `.env` has valid `DOKU_SECRET_KEY` (sandbox key OK)
- A PENDING order exists (check via `node -e "..." | jq` or admin dashboard)

## Signature construction (per src/lib/doku.js)

Components joined with `\n`:
```
Client-Id:<client-id>
Request-Id:<uuid>
Request-Timestamp:<iso8601 without ms, e.g. 2026-07-29T14:30:00Z>
Request-Target:/api/payment/doku/webhook
Digest:<sha256(body).base64>
```
Signature = `HMACSHA256=<hmac-sha256(components, DOKU_SECRET_KEY).base64>`

Timestamp must be within `MAX_TIMESTAMP_SKEW_MS` (5 min) of server clock.

## One-shot script

Create `scratch/test_webhook.js`:

```js
// Usage: node scratch/test_webhook.js <ORDER_ID> [status]
//   status default SUCCESS. Valid: SUCCESS, FAILED, EXPIRED, VOID, CANCELLED, PENDING, REFUNDED

const crypto = require('crypto');
require('dotenv').config();

const [, , orderId, statusArg = 'SUCCESS'] = process.argv;
if (!orderId) { console.error('Usage: node scratch/test_webhook.js <ORDER_ID> [status]'); process.exit(1); }

const secretKey = process.env.DOKU_SECRET_KEY;
const clientId  = process.env.DOKU_CLIENT_ID || 'BRN-TEST';
if (!secretKey) { console.error('DOKU_SECRET_KEY missing'); process.exit(1); }

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

## Test matrix (verify all hardening still works)

| Scenario | Command | Expected |
|---|---|---|
| Happy path | `node scratch/test_webhook.js <id> SUCCESS` | 200 + order PROCESSING + stock decrement |
| Replay | run happy path twice | 2nd: 200, order stays PROCESSING (idempotent) |
| Wrong amount | edit script → `amount: 1` | 400 "Amount mismatch." + PENDING preserved |
| Stale timestamp | edit script → `timestamp = new Date(Date.now() - 600000)...` | 401 "Timestamp out of range." |
| Bad signature | edit script → append 'x' to signature | 401 "Signature mismatch." |
| Missing header | delete Client-Id | 401 "Missing security headers." |
| FAILED status | `node scratch/test_webhook.js <id> FAILED` | 200 + CANCELLED, no stock change |
| Unknown status | `node scratch/test_webhook.js <id> REFUNDED` | 200 + logged warn + no change |

## Debugging tips
- Signature mismatch 99%: wrong secret OR wrong newline (must be `\n`, NOT `\r\n`)
- Timestamp errors: NTP-sync VM if server drift > 5 min
- Amount errors: server compares `Math.round(order.total)` — DB Float precision, both sides need rounding
- Prisma errors: `npx prisma db push` then restart dev

## NEVER do
- Log/commit real DOKU signatures — they're key-equivalent secrets
- Test amount mismatch against real production order — leaves audit-log entry that looks like fraud
- Hardcode `DOKU_SECRET_KEY` in a script that could be committed
