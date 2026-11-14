'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { scanCode128FromImageData } from '@/lib/barcode/code128Scanner';
import styles from './packing.module.css';

// Feedback suara bip saat barcode berhasil terbaca
function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Abaikan jika browser membatasi autoplay audio
  }
}

// Getaran haptik pada smartphone
function triggerHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([60, 40, 60]);
  }
}

export default function CameraScannerModal({ isOpen, onClose, onScanSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastScannedCodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);
  const fileInputRef = useRef(null);

  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [scannedSessionItems, setScannedSessionItems] = useState([]);
  const [showSessionDrawer, setShowSessionDrawer] = useState(true);

  // Bersihkan stream kamera saat ditutup
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Kirim kode yang terdeteksi ke server API
  const handleDetectedCode = useCallback(
    async (rawCode) => {
      const trimmed = String(rawCode || '').trim();
      if (!trimmed || trimmed.length < 3) return;

      const now = Date.now();
      // Cegah scan ganda dalam 2.5 detik untuk kode yang sama
      if (lastScannedCodeRef.current === trimmed && now - lastScannedTimeRef.current < 2500) {
        return;
      }

      lastScannedCodeRef.current = trimmed;
      lastScannedTimeRef.current = now;
      setIsProcessing(true);

      // Trigger efek sukses visual, haptik, dan audio seketika
      setIsSuccessFlash(true);
      playSuccessBeep();
      triggerHaptic();
      setTimeout(() => setIsSuccessFlash(false), 800);

      const nowTimeStr = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date());

      try {
        const res = await fetch('/api/admin/packing/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
        });

        const data = await res.json();
        let sessionEntry = null;

        if (res.ok) {
          if (data.alreadyPacked) {
            setScanFeedback({
              type: 'warn',
              text: data.message || `Resi ${trimmed}: Paket sudah pernah di-scan sebelumnya.`,
            });
            sessionEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              code: trimmed,
              orderId: data.order?.id,
              customerName: data.order?.name,
              courier: data.order?.shippingCourier,
              itemCount: data.order?.items?.reduce((s, it) => s + (it.quantity || 1), 0),
              status: 'warn',
              time: nowTimeStr,
              message: data.message || 'Pernah di-scan sebelumnya',
            };
          } else {
            setScanFeedback({
              type: 'success',
              text: data.message || `✓ Resi ${trimmed} terverifikasi (${data.order?.name || 'Paket'})`,
            });
            sessionEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              code: trimmed,
              orderId: data.order?.id,
              customerName: data.order?.name,
              courier: data.order?.shippingCourier,
              itemCount: data.order?.items?.reduce((s, it) => s + (it.quantity || 1), 0),
              status: 'success',
              time: nowTimeStr,
              message: data.message || 'Berhasil masuk tahap siap pickup',
            };
          }

          if (onScanSuccess) {
            onScanSuccess(data);
          }
        } else {
          setScanFeedback({
            type: 'error',
            text: data.error || `Kode "${trimmed}" tidak cocok dengan antrean pesanan.`,
          });
          sessionEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            code: trimmed,
            orderId: null,
            customerName: null,
            courier: null,
            itemCount: null,
            status: 'error',
            time: nowTimeStr,
            message: data.error || 'Barcode tidak cocok dengan antrean',
          };
        }

        if (sessionEntry) {
          setScannedSessionItems((prev) => [sessionEntry, ...prev.slice(0, 49)]);
        }
      } catch (err) {
        setScanFeedback({
          type: 'error',
          text: err.message || 'Gagal menghubungi server.',
        });
        setScannedSessionItems((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            code: trimmed,
            orderId: null,
            customerName: null,
            courier: null,
            itemCount: null,
            status: 'error',
            time: nowTimeStr,
            message: err.message || 'Gagal menghubungi server',
          },
          ...prev.slice(0, 49),
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [onScanSuccess]
  );

  // Loop pemindaian Dual-Engine (Native BarcodeDetector + Fallback Canvas Code 128)
  const startScanningLoop = useCallback(async () => {
    isScanningRef.current = true;

    // Inisialisasi Native BarcodeDetector secara aman jika didukung oleh browser
    let nativeDetector = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const supported = typeof window.BarcodeDetector.getSupportedFormats === 'function'
          ? await window.BarcodeDetector.getSupportedFormats()
          : ['code_128', 'qr_code', 'code_39', 'ean_13'];
        const formats = ['code_128', 'qr_code', 'code_39', 'ean_13'].filter((f) => supported.includes(f));
        if (formats.length > 0) {
          nativeDetector = new window.BarcodeDetector({ formats });
        }
      } catch (err) {
        console.warn('Native BarcodeDetector tidak tersedia:', err);
      }
    }

    const scanFrame = async () => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= 2 && !isProcessing) {
        let codeDetected = null;

        // 1. Coba Native BarcodeDetector terlebih dahulu jika ada
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              codeDetected = barcodes[0].rawValue;
            }
          } catch {
            // Abaikan kegagalan frame native
          }
        }

        // 2. Fallback Engine: Canvas Code 128 Multi-Scanline Decoder
        // Bekerja 100% pada iOS Safari (iPhone), browser Android tanpa BarcodeDetector, dan desktop
        if (!codeDetected && canvas) {
          try {
            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;

            // Target area reticle (tengah horizontal, rasio barcode 2.5:1)
            const cropW = Math.min(vw, Math.floor(vw * 0.85));
            const cropH = Math.min(vh, Math.floor(vh * 0.45));
            const cropX = Math.floor((vw - cropW) / 2);
            const cropY = Math.floor((vh - cropH) / 2);

            canvas.width = cropW;
            canvas.height = cropH;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              const imageData = ctx.getImageData(0, 0, cropW, cropH);
              const decoded = scanCode128FromImageData(imageData);
              if (decoded) {
                codeDetected = decoded;
              }
            }
          } catch {
            // Abaikan kegagalan frame canvas
          }
        }

        if (codeDetected) {
          await handleDetectedCode(codeDetected);
        }
      }

      if (isScanningRef.current) {
        // Polling setiap 120ms: sangat cepat dan responsif namun tetap hemat baterai
        setTimeout(scanFrame, 120);
      }
    };

    scanFrame();
  }, [handleDetectedCode, isProcessing]);

  // Mulai stream kamera smartphone
  const startCamera = useCallback(async () => {
    stopCamera();
    setScanFeedback(null);
    setHasCameraPermission(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setHasCameraPermission(true);

      // Cek capabilities hardware (torch dan zoom)
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() || {};
        if ('torch' in capabilities) {
          setHasTorch(true);
        }
        if ('zoom' in capabilities && capabilities.zoom) {
          setZoomCapabilities(capabilities.zoom);
        }
      }

      startScanningLoop();
    } catch (err) {
      console.warn('Gagal mengakses kamera:', err);
      setHasCameraPermission(false);
    }
  }, [stopCamera, startScanningLoop]);

  // Toggle Senter/Torch
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

  // Ubah tingkat Zoom kamera
  const handleApplyZoom = async (level) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && zoomCapabilities) {
      try {
        const target = Math.min(zoomCapabilities.max, Math.max(zoomCapabilities.min, level));
        await track.applyConstraints({
          advanced: [{ zoom: target }],
        });
        setZoomLevel(target);
      } catch (err) {
        console.warn('Gagal atur zoom:', err);
      }
    }
  };

  // Pemindaian dari Gambar Foto / Galeri
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new window.Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = async () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        let detected = null;

        // 1. Coba Native BarcodeDetector jika ada
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const det = new window.BarcodeDetector({ formats: ['code_128', 'qr_code', 'code_39', 'ean_13'] });
            const barcodes = await det.detect(canvas);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              detected = barcodes[0].rawValue;
            }
          } catch {}
        }

        // 2. Coba Fallback Code 128 Scanner
        if (!detected) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          detected = scanCode128FromImageData(imgData);
        }

        if (detected) {
          handleDetectedCode(detected);
        } else {
          setScanFeedback({
            type: 'error',
            text: 'Barcode tidak terbaca dari foto yang dipilih. Pastikan foto fokus dan tidak buram.',
          });
        }
      };
      img.src = event.target?.result;
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setScanFeedback(null);
      setTorchEnabled(false);
      setShowManualInput(false);
      setManualCode('');
      setZoomLevel(1);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  const validSessionCount = scannedSessionItems.filter((it) => it.status === 'success').length;

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetectedCode(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className={styles.inlineScannerCard} role="region" aria-label="Scanner Kamera Barcode Resi">
      {/* Canvas Tersembunyi untuk Pemrosesan Citra Barcode */}
      <canvas ref={canvasRef} className={styles.hiddenCanvas} />

      {/* Input File Tersembunyi untuk Foto Galeri */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className={styles.hiddenFileInput}
        aria-label="Pilih foto resi"
      />

      {/* 1. Header Inline Scanner */}
      <div className={styles.inlineScannerHeader}>
        <div className={styles.inlineScannerTitleRow}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span className={styles.inlineScannerTitleText}>Scanner Barcode Resi</span>
          {validSessionCount > 0 && (
            <span className={styles.headerCountPill}>
              <span className={styles.livePulseDot} />
              {validSessionCount} Masuk
            </span>
          )}
        </div>

        <div className={styles.inlineScannerActionsRow}>
          {/* Tombol Senter/Torch */}
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`${styles.iconButton} ${torchEnabled ? styles.iconButtonActive : ''}`.trim()}
              aria-label="Nyalakan senter kamera"
              title="Senter Kamera"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
          )}

          {/* Tombol Unggah / Jepret Foto */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={styles.iconButton}
            aria-label="Unggah atau jepret foto resi"
            title="Unggah Foto Resi"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          {/* Tombol Tutup Kamera */}
          <button
            type="button"
            onClick={onClose}
            className={styles.inlineCloseBtn}
            aria-label="Tutup pemindai kamera"
            title="Tutup pemindai kamera"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Tutup Kamera</span>
          </button>
        </div>
      </div>

      {/* 2. Body Inline Scanner (Grid Responsif: Kiri Viewfinder Kamera, Kanan Monitoring Sesi & Input) */}
      <div className={styles.inlineScannerBody}>
        {/* Kolom Kiri: Viewfinder Kamera Video */}
        <div className={styles.inlineViewfinderCol}>
          <div className={styles.viewfinderWrapper}>
            <video
              ref={videoRef}
              className={styles.videoFeed}
              playsInline
              muted
              autoPlay
            />

            {/* Kotak Reticle Horizontal Proporsional Barcode */}
            <div className={`${styles.reticleFrame} ${isSuccessFlash ? styles.reticleSuccess : ''}`.trim()}>
              <div className={styles.laserLine} />
              <div className={`${styles.corner} ${styles.cornerTL}`} />
              <div className={`${styles.corner} ${styles.cornerTR}`} />
              <div className={`${styles.corner} ${styles.cornerBL}`} />
              <div className={`${styles.corner} ${styles.cornerBR}`} />
            </div>

            {/* Kontrol Zoom (1x, 1.5x, 2x) */}
            {zoomCapabilities && (
              <div className={styles.zoomControlsGroup}>
                <button
                  type="button"
                  onClick={() => handleApplyZoom(1)}
                  className={`${styles.zoomBtn} ${zoomLevel <= 1.1 ? styles.zoomBtnActive : ''}`.trim()}
                >
                  1x
                </button>
                {zoomCapabilities.max >= 1.5 && (
                  <button
                    type="button"
                    onClick={() => handleApplyZoom(1.5)}
                    className={`${styles.zoomBtn} ${zoomLevel > 1.1 && zoomLevel <= 1.7 ? styles.zoomBtnActive : ''}`.trim()}
                  >
                    1.5x
                  </button>
                )}
                {zoomCapabilities.max >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleApplyZoom(2)}
                    className={`${styles.zoomBtn} ${zoomLevel > 1.7 ? styles.zoomBtnActive : ''}`.trim()}
                  >
                    2x
                  </button>
                )}
              </div>
            )}

            {/* Peringatan jika izin kamera diblokir */}
            {hasCameraPermission === false && (
              <div className={styles.permissionAlert}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className={styles.alertText}>Izin akses kamera browser belum aktif atau diblokir.</p>
                <p className={styles.alertSub}>Izinkan akses kamera di pengaturan browser atau gunakan input manual di samping.</p>
              </div>
            )}
          </div>

          {/* Feedback Banner Pemindaian */}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              <span className={styles.feedbackText}>{scanFeedback.text}</span>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Monitoring Sesi Scan Real-Time & Input Manual */}
        <div className={styles.inlineMonitoringCol}>
          <div className={styles.sessionHeaderRow}>
            <div className={styles.sessionTitle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <span>Monitoring Sesi Scan ({scannedSessionItems.length})</span>
              {validSessionCount > 0 && (
                <span className={styles.sessionSuccessBadge}>{validSessionCount} Masuk</span>
              )}
            </div>

            <div className={styles.sessionActionBtns}>
              {scannedSessionItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScannedSessionItems([])}
                  className={styles.sessionClearBtn}
                  title="Bersihkan riwayat scan sesi ini"
                >
                  Bersihkan
                </button>
              )}
            </div>
          </div>

          <div className={styles.sessionItemsScroll}>
            {scannedSessionItems.length === 0 ? (
              <div className={styles.sessionEmpty}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                </svg>
                <p>Belum ada resi yang di-scan pada sesi ini.</p>
                <span>Arahkan kamera ke barcode resi kurir atau masukkan kode di bawah.</span>
              </div>
            ) : (
              scannedSessionItems.map((item) => (
                <div
                  key={item.id}
                  className={`${styles.sessionItemRow} ${
                    item.status === 'success'
                      ? styles.sessionItemSuccess
                      : item.status === 'warn'
                      ? styles.sessionItemWarn
                      : styles.sessionItemError
                  }`.trim()}
                >
                  <div className={styles.sessionItemLeft}>
                    <div className={styles.sessionItemStatusIcon}>
                      {item.status === 'success' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : item.status === 'warn' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                    </div>

                    <div className={styles.sessionItemInfo}>
                      <div className={styles.sessionItemMainLine}>
                        <span className={styles.sessionItemCode}>{item.code}</span>
                        {item.orderId && (
                          <span className={styles.sessionItemOrderId}>#{item.orderId.slice(0, 8).toUpperCase()}</span>
                        )}
                        {item.courier && (
                          <span className={styles.sessionItemCourier}>{item.courier.toUpperCase()}</span>
                        )}
                      </div>
                      <div className={styles.sessionItemSubLine}>
                        {item.customerName && (
                          <span className={styles.sessionItemCustomer}>
                            {item.customerName} {item.itemCount ? `(${item.itemCount} item)` : ''}
                          </span>
                        )}
                        {item.customerName && <span className={styles.sessionItemSep}>•</span>}
                        <span className={styles.sessionItemMessage}>{item.message}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.sessionItemTime}>{item.time}</div>
                </div>
              ))
            )}
          </div>

          {/* Form Input Manual di Bawah Kolom Monitoring */}
          <div className={styles.inlineManualFooter}>
            <form onSubmit={handleManualSubmit} className={styles.manualForm}>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ketik No. Resi / Order ID..."
                className={styles.manualInput}
              />
              <button
                type="submit"
                disabled={isProcessing || !manualCode.trim()}
                className={styles.manualSubmitBtn}
              >
                {isProcessing ? 'Proses...' : 'Kirim'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
