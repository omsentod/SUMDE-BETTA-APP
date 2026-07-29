// Simple in-memory fixed-window rate limiter.
//
// Trade-offs kept deliberately small: per-process state (resets on server
// restart, not shared across instances). Adequate for a single-server
// deployment; swap for Redis / Upstash if the app is scaled horizontally.

const buckets = new Map(); // key -> { count, resetAt }

// Periodically drop expired buckets so long-running processes don't leak.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't hold the event loop open just for cleanup.
  cleanupTimer.unref?.();
}

/**
 * Consume one hit against the given key. Returns `{ ok, retryAfterSec }`.
 * `ok === false` means the caller should reject with HTTP 429.
 */
export function consume(key, { limit, windowMs }) {
  ensureCleanup();
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Extract the client IP from a Next.js request. Falls back to a shared bucket
 * name if the proxy didn't set one — better than trusting the socket IP.
 */
export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
