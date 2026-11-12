// src/lib/tabFlashing.js
// Utility untuk animasi berkedip pada judul tab browser (Tab Title Flashing)
// saat ada chat/notifikasi masuk dan tab sedang tidak aktif / diminimalkan

let flashInterval = null;
let originalTitle = '';

export function startTabTitleFlash(alertTitle = '💬 (1) Pesan Baru! — SUMDE BETTA') {
  if (typeof document === 'undefined') return;
  if (flashInterval) return; // Sudah berjalan

  originalTitle = document.title;
  let toggle = false;

  flashInterval = setInterval(() => {
    document.title = toggle ? alertTitle : originalTitle;
    toggle = !toggle;
  }, 1000);

  const stopFlash = () => {
    if (flashInterval) {
      clearInterval(flashInterval);
      flashInterval = null;
      document.title = originalTitle;
    }
    window.removeEventListener('focus', stopFlash);
    document.removeEventListener('visibilitychange', stopFlash);
  };

  window.addEventListener('focus', stopFlash);
  document.addEventListener('visibilitychange', stopFlash);
}

export function stopTabTitleFlash() {
  if (typeof document === 'undefined') return;
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
    if (originalTitle) {
      document.title = originalTitle;
    }
  }
}
