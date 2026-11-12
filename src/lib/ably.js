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
  try {
    const rest = getRest();
    const channel = rest.channels.get(`user:${userId}`);
    await channel.publish(event, data);
  } catch (err) {
    console.warn(`[Ably] Gagal publishToUser(${userId}):`, err.message);
  }
}

/**
 * Publish payload ke percakapan tertentu `chat:<conversationId>`.
 */
export async function publishToConversation(conversationId, event, data) {
  try {
    const rest = getRest();
    const channel = rest.channels.get(`chat:${conversationId}`);
    await channel.publish(event, data);
  } catch (err) {
    console.warn(`[Ably] Gagal publishToConversation(${conversationId}):`, err.message);
  }
}

/**
 * Publish payload ke admin chat channel `admin:chat`.
 */
export async function publishToAdminChat(event, data) {
  try {
    const rest = getRest();
    const channel = rest.channels.get('admin:chat');
    await channel.publish(event, data);
  } catch (err) {
    console.warn('[Ably] Gagal publishToAdminChat:', err.message);
  }
}

/**
 * Publish status change ke channel `chat:status` dan `admin:chat`.
 */
export async function publishChatStatus(data) {
  try {
    const rest = getRest();
    const statusChannel = rest.channels.get('chat:status');
    const adminChannel = rest.channels.get('admin:chat');
    await Promise.allSettled([
      statusChannel.publish('status-update', data),
      adminChannel.publish('status-update', data),
    ]);
  } catch (err) {
    console.warn('[Ably] Gagal publishChatStatus:', err.message);
  }
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

/**
 * Generate token request untuk Chat client (Customer terdaftar, Guest, atau Admin).
 */
export async function createChatTokenRequest({ clientId, channels = [], allowPublish = false }) {
  const rest = getRest();
  const capability = {};
  for (const ch of channels) {
    capability[ch] = allowPublish ? ['subscribe', 'publish'] : ['subscribe'];
  }
  return rest.auth.createTokenRequest({
    clientId: String(clientId),
    capability,
  });
}

export function isEnabled() {
  return !!process.env.ABLY_API_KEY;
}
