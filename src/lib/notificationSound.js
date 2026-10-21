/**
 * Synthesize a subtle, luxury chime sound for incoming notifications
 * using Web Audio API (zero external assets, zero lag).
 */

export function isChimeMuted() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('sumde-notif-sound') === 'muted';
}

export function setChimeMuted(muted) {
  if (typeof window === 'undefined') return;
  if (muted) {
    localStorage.setItem('sumde-notif-sound', 'muted');
  } else {
    localStorage.removeItem('sumde-notif-sound');
  }
}

export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  if (isChimeMuted()) return;

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
    gain1.gain.setValueAtTime(0.1, now);
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
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.5);
  } catch {
    // Ignore audio permission or context creation errors silently
  }
}
