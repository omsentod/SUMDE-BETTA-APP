/**
 * Notification Sound Manager for SUMDE BETTA
 * Plays dedicated audio files:
 * - Admin Notifications (orders, payments, shipping, system alerts): /sound/notif_admin.wav
 * - Live Chat Notifications (inbound chat, admin & customer replies): /sound/chat.wav
 *
 * Includes graceful Web Audio API synthesis fallback when browser autoplay
 * restrictions or audio asset decode issues occur.
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

// Module-level audio cache to preload and minimize latency
const audioCache = {
  admin: null,
  chat: null,
};

function getAudioInstance(type) {
  if (typeof window === 'undefined') return null;
  const key = type === 'chat' ? 'chat' : 'admin';
  const path = type === 'chat' ? '/sound/chat.wav' : '/sound/notif_admin.wav';

  if (!audioCache[key]) {
    try {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = 0.85;
      audioCache[key] = audio;
    } catch {
      return null;
    }
  }
  return audioCache[key];
}

/**
 * Fallback Web Audio API synthesizer if WAV file playback fails or is blocked
 */
function playSyntheticChime(type = 'admin') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === 'chat') {
      // Warm, quick dual-tone for chat (587.33Hz -> 880Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      // Harmonic chime for admin alerts (880Hz + 1318.5Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.1, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, now + 0.08);
      gain2.gain.setValueAtTime(0.12, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.5);
    }
  } catch {
    // Ignore audio permission or context creation errors silently
  }
}

/**
 * Main sound trigger function
 * @param {'admin' | 'chat'} [type='admin']
 */
export function playNotificationSound(type = 'admin') {
  if (typeof window === 'undefined') return;
  if (isChimeMuted()) return;

  const audio = getAudioInstance(type);
  if (!audio) {
    playSyntheticChime(type);
    return;
  }

  try {
    if (audio.readyState >= 1) {
      audio.currentTime = 0;
    }
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay policy or playback failure: fallback to Web Audio API
        playSyntheticChime(type);
      });
    }
  } catch {
    playSyntheticChime(type);
  }
}

/**
 * Convenience helper for regular admin notifications (orders, payments, shipping, system alerts)
 */
export function playAdminNotificationSound() {
  playNotificationSound('admin');
}

/**
 * Convenience helper for live chat notifications (inbound chat, customer/admin replies)
 */
export function playChatNotificationSound() {
  playNotificationSound('chat');
}

/**
 * Backward-compatible function for existing callers
 * @param {'admin' | 'chat'} [type='admin']
 */
export function playNotificationChime(type = 'admin') {
  playNotificationSound(type);
}
