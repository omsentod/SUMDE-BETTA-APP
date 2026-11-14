'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './packing.module.css';

function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Abaikan jika browser memblokir audio autoplay
  }
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([60, 40, 60]);
  }
}

export default function CameraScannerModal({ isOpen, onClose, onScanSuccess }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastScannedCodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null); // { type: 'success' | 'warn' | 'error', text }
  const [isNativeDetectorSupported, setIsNativeDetectorSupported] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Bersihkan stream kamera
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Mulai stream kamera
  const startCamera = useCallback(async () => {
    stopCamera();
    setScanFeedback(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        setIsNativeDetectorSupported(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setHasCameraPermission(true);

      // Cek apakah kamera punya lampu flash/torch
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() || {};
      if ('torch' in capabilities) {
        setHasTorch(true);
      }

      // Mulai loop pemindaian
      startScanningLoop();
    } catch (err) {
      console.warn('Gagal mengakses kamera:', err);
      setHasCameraPermission(false);
    }
  }, [stopCamera]);

  // Toggle Torch/Senter
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const next = !torchEnabled;
        await track.applyConstraints({
          advanced: [{ torch: next }],
        });
        setTorchEnabled(next);
      } catch (err) {
        console.warn('Gagal toggle torch:', err);
      }
    }
  };

  // Kirim kode yang terdeteksi ke server
  const handleDetectedCode = useCallback(
    async (code) => {
      const trimmed = String(code || '').trim();
      if (!trimmed || trimmed.length < 3) return;

      const now = Date.now();
      // Cegah scan ganda dalam 2.5 detik untuk kode yang sama
      if (lastScannedCodeRef.current === trimmed && now - lastScannedTimeRef.current < 2500) {
        return;
      }

      lastScannedCodeRef.current = trimmed;
      lastScannedTimeRef.current = now;
      setIsProcessing(true);

      try {
        const res = await fetch('/api/admin/packing/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
        });

        const data = await res.json();

        if (res.ok) {
          playSuccessBeep();
          triggerHaptic();

          if (data.alreadyPacked) {
            setScanFeedback({
              type: 'warn',
              text: data.message || 'Paket sudah pernah di-scan sebelumnya.',
            });
          } else {
            setScanFeedback({
              type: 'success',
              text: data.message || `Berhasil: ${data.order?.name}`,
            });
          }

          if (onScanSuccess) {
            onScanSuccess(data);
          }
        } else {
          setScanFeedback({
            type: 'error',
            text: data.error || 'Barcode tidak dikenali dalam sistem.',
          });
        }
      } catch (err) {
        setScanFeedback({
          type: 'error',
          text: err.message || 'Gagal menghubungi server.',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [onScanSuccess]
  );

  // Loop pemindaian menggunakan native BarcodeDetector
  const startScanningLoop = useCallback(() => {
    isScanningRef.current = true;

    if (!('BarcodeDetector' in window)) {
      setIsNativeDetectorSupported(false);
      return;
    }

    let barcodeDetector = null;
    try {
      barcodeDetector = new window.BarcodeDetector({
        formats: ['code_128', 'qr_code', 'code_39', 'ean_13', 'upc_a'],
      });
    } catch (e) {
      console.warn('Inisialisasi BarcodeDetector gagal:', e);
      setIsNativeDetectorSupported(false);
      return;
    }

    const scanFrame = async () => {
      if (!isScanningRef.current) return;

      if (videoRef.current && videoRef.current.readyState >= 2 && !isProcessing) {
        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const first = barcodes[0].rawValue;
            if (first) {
              await handleDetectedCode(first);
            }
          }
        } catch {
          // Abaikan frame yang gagal dideteksi
        }
      }

      if (isScanningRef.current) {
        setTimeout(scanFrame, 200); // Polling deteksi setiap 200ms (hemat baterai HP)
      }
    };

    scanFrame();
  }, [handleDetectedCode, isProcessing]);

  // Efek buka/tutup modal
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setScanFeedback(null);
      setTorchEnabled(false);
      setShowManualInput(false);
      setManualCode('');
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetectedCode(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className={styles.scannerBackdrop} role="dialog" aria-modal="true" aria-label="Scanner Barcode Resi">
      <div className={styles.scannerContainer}>
        {/* Header Scanner */}
        <div className={styles.scannerHeader}>
          <div className={styles.scannerTitleRow}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className={styles.scannerTitleText}>Arahkan Kamera ke Barcode Resi</span>
          </div>

          <div className={styles.scannerActionsRow}>
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`${styles.iconButton} ${torchEnabled ? styles.iconButtonActive : ''}`.trim()}
                aria-label="Nyalakan senter"
                title="Lampu Senter"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Tutup pemindai"
              title="Tutup"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Viewfinder Video */}
        <div className={styles.viewfinderWrapper}>
          <video
            ref={videoRef}
            className={styles.videoFeed}
            playsInline
            muted
            autoPlay
          />

          {/* Kotak Reticle Fokus */}
          <div className={styles.reticleFrame}>
            <div className={styles.laserLine} />
            <div className={`${styles.corner} ${styles.cornerTL}`} />
            <div className={`${styles.corner} ${styles.cornerTR}`} />
            <div className={`${styles.corner} ${styles.cornerBL}`} />
            <div className={`${styles.corner} ${styles.cornerBR}`} />
          </div>

          {/* Pesan jika izin kamera diblokir */}
          {hasCameraPermission === false && (
            <div className={styles.permissionAlert}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className={styles.alertText}>Izin akses kamera browser tidak aktif atau diblokir.</p>
              <p className={styles.alertSub}>Gunakan input manual nomor resi di bawah ini.</p>
            </div>
          )}
        </div>

        {/* Banner Feedback Pemindaian */}
        {scanFeedback && (
          <div
            className={`${styles.feedbackBanner} ${
              scanFeedback.type === 'success'
                ? styles.feedbackSuccess
                : scanFeedback.type === 'warn'
                ? styles.feedbackWarn
                : styles.feedbackError
            }`.trim()}
          >
            {scanFeedback.type === 'success' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span className={styles.feedbackText}>{scanFeedback.text}</span>
          </div>
        )}

        {/* Footer & Fallback Manual Input */}
        <div className={styles.scannerFooter}>
          <div className={styles.footerHint}>
            Scan <strong>Barcode Reference (#ORD)</strong> atau <strong>Barcode Resi Kurir</strong> pada kertas fisik.
          </div>

          {!showManualInput ? (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className={styles.manualToggleBtn}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="6" y1="8" x2="6" y2="8" />
                <line x1="10" y1="8" x2="10" y2="8" />
                <line x1="14" y1="8" x2="14" y2="8" />
                <line x1="18" y1="8" x2="18" y2="8" />
                <line x1="6" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="18" y2="12" />
                <line x1="10" y1="16" x2="14" y2="16" />
              </svg>
              <span>Ketik Nomor Resi / Order Manual</span>
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} className={styles.manualForm}>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Masukkan Nomor Resi / ID Order..."
                className={styles.manualInput}
                autoFocus
              />
              <button
                type="submit"
                disabled={isProcessing || !manualCode.trim()}
                className={styles.manualSubmitBtn}
              >
                {isProcessing ? 'Memproses...' : 'Kirim'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
