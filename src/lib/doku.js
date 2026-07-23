import crypto from 'crypto';

/**
 * Generate Digest for Doku Non-SNAP API
 * SHA-256 hashed and Base64 encoded of the JSON stringified request body
 */
export function generateDigest(bodyString) {
  const hash = crypto.createHash('sha256').update(bodyString, 'utf8').digest();
  return hash.toString('base64');
}

/**
 * Generate Signature for Doku Non-SNAP API
 * HMAC-SHA256 of signature component string with Client Secret Key, Base64 encoded, prefixed with 'HMACSHA256='
 */
export function generateSignature(clientId, requestId, timestamp, requestTarget, digest, secretKey) {
  const rawSignatureComponents = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`
  ];
  
  const rawSignature = rawSignatureComponents.join('\n');
  const hmac = crypto.createHmac('sha256', secretKey).update(rawSignature).digest();
  return `HMACSHA256=${hmac.toString('base64')}`;
}

/**
 * Request Checkout URL from Doku Sandbox
 */
export async function createCheckoutSession({ invoiceNumber, amount, callbackUrl }) {
  const clientId = process.env.DOKU_CLIENT_ID;
  const secretKey = process.env.DOKU_SECRET_KEY;
  const baseUrl = process.env.DOKU_BASE_URL || 'https://api-sandbox.doku.com';

  if (!clientId || !secretKey) {
    throw new Error('Doku Client ID or Secret Key is not configured in environment variables.');
  }

  const requestTarget = '/checkout/v1/payment';
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString().split('.')[0] + 'Z'; // UTC ISO 8601 e.g. 2026-06-21T16:50:00Z

  // Construct request payload for Doku Checkout
  const payload = {
    order: {
      invoice_number: invoiceNumber,
      amount: Math.round(amount), // Doku requires integer for IDR amount
      callback_url: callbackUrl,
      callback_url_result: callbackUrl,
      auto_redirect: true
    },
    payment: {
      payment_due_date: 60 // Expiration time in minutes (1 hour)
    }
  };

  const bodyString = JSON.stringify(payload);
  const digest = generateDigest(bodyString);
  const signature = generateSignature(clientId, requestId, timestamp, requestTarget, digest, secretKey);

  const headers = {
    'Client-Id': clientId,
    'Request-Id': requestId,
    'Request-Timestamp': timestamp,
    'Signature': signature,
    'Content-Type': 'application/json'
  };

  const response = await fetch(`${baseUrl}${requestTarget}`, {
    method: 'POST',
    headers,
    body: bodyString
  });

  const responseData = await response.json();
  if (!response.ok) {
    console.error('Doku Checkout API Error Response:', responseData);
    throw new Error(responseData?.error?.message || responseData?.message || `Doku API error: ${response.status}`);
  }

  return responseData;
}
