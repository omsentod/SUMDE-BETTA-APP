import Ably from 'ably';

// Ably realtime — server side helper. Client subscribe pakai token dari
// /api/ably/auth (jangan expose root API key ke browser).
//
// Env:
//   ABLY_API_KEY - format "appId.keyId:secret" dari Ably dashboard

let cachedRest = null;

function getRest() {
  if (cachedRest) return cachedRest;
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    const err = new Error('ABLY_API_KEY belum di-set.');
    err.status = 500;
    throw err;
  }
  cachedRest = new Ably.Rest(key);
  return cachedRest;
}

/**
 * Publish payload ke channel per-user `user:<userId>`.
 * Aman gagal — caller (notification dispatcher) sudah handle error.
 */
export async function publishToUser(userId, event, data) {
  const rest = getRest();
  const channel = rest.channels.get(`user:${userId}`);
  await channel.publish(event, data);
}

/**
 * Generate token request untuk client subscribe.
 * Batasi scope hanya ke channel user tersebut supaya user A tidak bisa
 * subscribe channel user B.
 */
export async function createTokenRequest(userId) {
  const rest = getRest();
  return rest.auth.createTokenRequest({
    clientId: String(userId),
    capability: {
      [`user:${userId}`]: ['subscribe'],
    },
  });
}

export function isEnabled() {
  return !!process.env.ABLY_API_KEY;
}
