/**
 * Notification Sound Manager for SUMDE BETTA
 *
 * Audio Separation:
 * 1. Customer Chat: Uses the lightweight synthetic chime (playNotificationChime)
 *    via Web Audio API (zero external assets, zero lag).
 * 2. Admin General Alerts (Orders, Payments, Shipping): /sound/notif_admin.wav
 * 3. Admin Live Chat (Inbound messages from customers): /sound/chat.wav
 */

export function isChimeMuted() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('sumde-notif-sound') === 'muted';
  } catch {
    return false;
  }
}

export function setChimeMuted(muted) {
  if (typeof window === 'undefined') return;
  try {
    if (muted) {
      localStorage.setItem('sumde-notif-sound', 'muted');
    } else {
      localStorage.removeItem('sumde-notif-sound');
    }
  } catch {
    // Ignore localStorage access restrictions
  }
}

// Cooldown guard to prevent overlapping audio spam during order flurries
const AUDIO_COOLDOWN_MS = 6000;
let lastAdminSoundTime = 0;
let lastChatSoundTime = 0;
let lastChimeSoundTime = 0;

// ============================================================================
// 1. CUSTOMER NOTIFICATION SOUND: SYNTHETIC CHIME (Web Audio API)
// ============================================================================
export function playNotificationChime(force = false) {
  if (typeof window === 'undefined') return;
  if (isChimeMuted()) return;

  const nowTime = Date.now();
  if (!force && nowTime - lastChimeSoundTime < AUDIO_COOLDOWN_MS) {
    return; // Throttled to prevent audio fatigue
  }
  lastChimeSoundTime = nowTime;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Harmonic Tone 1 (880Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Harmonic Tone 2 (1318.5Hz - E6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.08);
    gain2.gain.setValueAtTime(0.14, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.5);
  } catch {
    // Silently ignore audio context errors
  }
}

// ============================================================================
// 2. ADMIN SOUND ENGINE: /sound/notif_admin.wav & /sound/chat.wav
// ============================================================================

let sharedAudioCtx = null;
const decodedBufferCache = new Map();

function getSharedAudioCtx() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Pre-load audio buffer via Web Audio API so it's always ready in memory
async function getOrLoadBuffer(src) {
  const ctx = getSharedAudioCtx();
  if (!ctx) return null;

  if (decodedBufferCache.has(src)) {
    return decodedBufferCache.get(src);
  }

  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    decodedBufferCache.set(src, decoded);
    return decoded;
  } catch {
    return null;
  }
}

// Play decoded audio buffer directly through Web Audio API
function playBuffer(buffer) {
  const ctx = getSharedAudioCtx();
  if (!ctx || !buffer) return false;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Robust player for WAV files in Admin.
 * Tries standard HTML5 Audio first; if blocked by browser policy,
 * falls back to decoded Web Audio API BufferSourceNode.
 */
async function playWavSound(src) {
  if (typeof window === 'undefined') return;
  if (isChimeMuted()) return;

  let playedViaAudioElement = false;

  try {
    const audio = new Audio(src);
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          playedViaAudioElement = true;
        })
        .catch(async () => {
          // If browser autoplay policy blocked HTML5 Audio, use Web Audio API buffer
          if (!playedViaAudioElement) {
            const buf = await getOrLoadBuffer(src);
            if (buf) {
              playBuffer(buf);
            }
          }
        });
    }
  } catch {
    // Immediate catch fallback to Web Audio API
    const buf = await getOrLoadBuffer(src);
    if (buf) {
      playBuffer(buf);
    }
  }
}

// Pre-warm audio files in browser on first user gesture (click/keydown)
if (typeof window !== 'undefined') {
  const prewarm = () => {
    const ctx = getSharedAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    getOrLoadBuffer('/sound/notif_admin.wav');
    getOrLoadBuffer('/sound/chat.wav');
    window.removeEventListener('click', prewarm);
    window.removeEventListener('keydown', prewarm);
    window.removeEventListener('touchstart', prewarm);
  };
  window.addEventListener('click', prewarm, { once: true, passive: true });
  window.addEventListener('keydown', prewarm, { once: true, passive: true });
  window.addEventListener('touchstart', prewarm, { once: true, passive: true });
}

/**
 * Regular Admin Notifications (Orders, Payments, Shipping, Bell Test)
 * Plays: /sound/notif_admin.wav
 * @param {boolean} [force=false] - set true to bypass debounce (e.g. manual user sound toggle)
 */
export function playAdminNotificationSound(force = false) {
  const now = Date.now();
  if (!force && now - lastAdminSoundTime < AUDIO_COOLDOWN_MS) {
    return; // Throttled to prevent audio fatigue
  }
  lastAdminSoundTime = now;
  playWavSound('/sound/notif_admin.wav');
}

/**
 * Admin Live Chat Notifications (Inbound messages from customers)
 * Plays: /sound/chat.wav
 * @param {boolean} [force=false] - set true to bypass debounce
 */
export function playChatNotificationSound(force = false) {
  const now = Date.now();
  if (!force && now - lastChatSoundTime < AUDIO_COOLDOWN_MS) {
    return; // Throttled to prevent audio fatigue
  }
  lastChatSoundTime = now;
  playWavSound('/sound/chat.wav');
}

/**
 * Alias for general notification sound trigger
 * @param {'admin' | 'chat'} [type='admin']
 * @param {boolean} [force=false]
 */
export function playNotificationSound(type = 'admin', force = false) {
  if (type === 'chat') {
    playChatNotificationSound(force);
  } else {
    playAdminNotificationSound(force);
  }
}
