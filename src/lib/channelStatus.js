/**
 * Runtime channel availability tracker (server-only).
 *
 * When the DOKU Checkout API rejects a channel with "PAYMENT CHANNEL IS INACTIVE",
 * we call `markChannelInactive(dokuType)` so the picker hides it immediately for
 * ALL subsequent visitors — no deploy needed.
 *
 * Channels auto-recover after RECOVERY_MS (24 hours). On the first customer who
 * picks the channel after recovery, DOKU will either accept (channel re-enabled)
 * or reject again (re-marked inactive for another 24 h). This self-healing loop
 * means admin never needs to touch code for transient DOKU channel outages.
 *
 * Storage: module-level Map (in-memory). Resets on server restart, which is fine
 * — the fallback in /api/payment/doku still works, and the channel gets
 * re-detected on the first failed attempt after restart.
 */

// How long a detected-inactive channel stays hidden before we retry.
const RECOVERY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Map<dokuType, { detectedAt: number }>
const inactiveChannels = new Map();

/**
 * Record that DOKU rejected this channel as inactive.
 * @param {string} dokuType - e.g. "VIRTUAL_ACCOUNT_BCA"
 */
export function markChannelInactive(dokuType) {
  if (!dokuType) return;
  inactiveChannels.set(dokuType, { detectedAt: Date.now() });
  console.warn(`[ChannelStatus] Marked "${dokuType}" as inactive (auto-recovery in 24h).`);
}

/**
 * Check if a dokuType is currently known-inactive at runtime.
 * Returns false (= active) if it was never marked, or the recovery window passed.
 * @param {string} dokuType
 * @returns {boolean} true if currently considered inactive
 */
export function isChannelRuntimeInactive(dokuType) {
  const entry = inactiveChannels.get(dokuType);
  if (!entry) return false;

  if (Date.now() - entry.detectedAt > RECOVERY_MS) {
    // Recovery window passed — give it another chance.
    inactiveChannels.delete(dokuType);
    console.log(`[ChannelStatus] "${dokuType}" recovery window passed — re-enabled for probing.`);
    return false;
  }
  return true;
}

/**
 * Return Set of dokuType strings that are currently runtime-inactive.
 * Used by the /api/payment/channels endpoint.
 * @returns {Set<string>}
 */
export function getRuntimeInactiveTypes() {
  const now = Date.now();
  const result = new Set();
  for (const [dokuType, entry] of inactiveChannels) {
    if (now - entry.detectedAt > RECOVERY_MS) {
      inactiveChannels.delete(dokuType);
    } else {
      result.add(dokuType);
    }
  }
  return result;
}
