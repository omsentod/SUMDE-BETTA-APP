'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useToast } from '@/context/ToastContext';
import styles from './BulkProductModal.module.css';

export default function BulkProductModal({ isOpen, onClose, onComplete }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('excel'); // 'excel' | 'zip'

  // State Excel
  const [excelFile, setExcelFile] = useState(null);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const [excelResult, setExcelResult] = useState(null);
  const [excelError, setExcelError] = useState('');
  const [isExcelDragOver, setIsExcelDragOver] = useState(false);

  // State ZIP
  const [zipFile, setZipFile] = useState(null);
  const [isZipUploading, setIsZipUploading] = useState(false);
  const [zipResult, setZipResult] = useState(null);
  const [zipError, setZipError] = useState('');
  const [isZipDragOver, setIsZipDragOver] = useState(false);
  const [zipUploadProgress, setZipUploadProgress] = useState(0); // 0-100

  // DOM Refs for file inputs
  const excelInputRef = useRef(null);
  const zipInputRef = useRef(null);

  if (!isOpen) return null;

  const resetState = () => {
    setExcelFile(null);
    setIsExcelUploading(false);
    setExcelResult(null);
    setExcelError('');
    setIsExcelDragOver(false);

    setZipFile(null);
    setIsZipUploading(false);
    setZipResult(null);
    setZipError('');
    setIsZipDragOver(false);

    setActiveTab('excel');
  };

  const handleFinish = (customMsg) => {
    const message = customMsg || 'Data produk massal berhasil diproses!';
    toast.success(message);
    if (onComplete) onComplete();
    resetState();
    onClose();
  };

  const handleClose = () => {
    if (excelResult || zipResult) {
      if (onComplete) onComplete();
    }
    resetState();
    onClose();
  };

  // Handle Excel File Upload
  const handleUploadExcel = async () => {
    if (!excelFile) return;
    setIsExcelUploading(true);
    setExcelError('');
    setExcelResult(null);

    const fd = new FormData();
    fd.append('file', excelFile);

    try {
      const res = await fetch('/api/admin/products/bulk/excel', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah file Excel.');
      setExcelResult(data);
      if (onComplete) onComplete();
    } catch (err) {
      setExcelError(err.message);
    } finally {
      setIsExcelUploading(false);
    }
  };

  // Handle ZIP File Upload with progress
  const handleUploadZip = () => {
    if (!zipFile) return;
    setIsZipUploading(true);
    setZipError('');
    setZipResult(null);
    setZipUploadProgress(0);

    const fd = new FormData();
    fd.append('file', zipFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/products/bulk/zip');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setZipUploadProgress(percent);
      }
    };
    xhr.onload = () => {
      setIsZipUploading(false);
      setZipUploadProgress(100);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setZipResult(data);
          if (onComplete) onComplete();
        } else {
          throw new Error(data.error || 'Gagal memproses file ZIP.');
        }
      } catch (err) {
        setZipError(err.message);
      }
    };
    xhr.onerror = () => {
      setIsZipUploading(false);
      setZipError('Terjadi kesalahan jaringan saat mengunggah ZIP.');
    };
    xhr.send(fd);
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/admin/products/bulk/template';
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Upload Produk Massal</span>
          </div>
          <button onClick={handleClose} className={styles.closeBtn} title="Tutup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'excel' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('excel')}
          >
            <span>Data Produk (Excel)</span>
            {excelResult && (
              <span className={styles.tabCheckIcon}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'zip' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('zip')}
          >
            <span>Galeri Foto (ZIP)</span>
            {zipResult && (
              <span className={styles.tabCheckIcon}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className={styles.modalBody}>
          {activeTab === 'excel' ? (
            <>
              {/* Template Download Bar */}
              <div className={styles.topActionRow}>
                <span className={styles.topActionText}>
                  Format file: <code>.xlsx</code>, <code>.xls</code>, atau <code>.csv</code>
                </span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className={styles.downloadBtn}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Unduh Template Excel</span>
                </button>
              </div>

              {/* Dropzone Excel */}
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className={styles.hiddenFileInput}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setExcelFile(e.target.files[0]);
                    setExcelError('');
                    setExcelResult(null);
                  }
                }}
              />
              <div
                className={`${styles.dropZone} ${isExcelDragOver ? styles.dropZoneActive : ''}`}
                onClick={() => excelInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsExcelDragOver(true);
                }}
                onDragLeave={() => setIsExcelDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsExcelDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setExcelFile(e.dataTransfer.files[0]);
                    setExcelError('');
                    setExcelResult(null);
                  }
                }}
              >
                <div className={styles.dropIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                  </svg>
                </div>
                <div className={styles.dropTitle}>
                  {excelFile ? 'Klik untuk mengganti file Excel' : 'Pilih atau Tarik File Excel ke Sini'}
                </div>
                <div className={styles.dropSubtitle}>
                  Maksimal 10MB (.xlsx, .xls, .csv)
                </div>

                {excelFile && (
                  <div
                    className={styles.fileSelectedBadge}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      className={styles.fileRemoveBtn}
                      title="Hapus file"
                      onClick={() => {
                        setExcelFile(null);
                        setExcelResult(null);
                        setExcelError('');
                        if (excelInputRef.current) excelInputRef.current.value = '';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {excelError && (
                <div className={`${styles.alertBox} ${styles.alertBoxError}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>{excelError}</div>
                </div>
              )}

              {/* Result Summary (Tanpa tombol duplikat) */}
              {excelResult && (
                <div className={styles.resultCard}>
                  <div className={styles.resultTitle}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" color="var(--status-success, #22c55e)">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Data Excel Berhasil Diproses</span>
                  </div>
                  <div className={styles.statGrid}>
                    <div className={styles.statItem}>
                      <div className={styles.statNum}>{excelResult.totalRows}</div>
                      <div className={styles.statLabel}>Total Baris</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={`${styles.statNum} ${styles.statNumSuccess}`}>{excelResult.createdCount}</div>
                      <div className={styles.statLabel}>Produk Baru</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={`${styles.statNum} ${styles.statNumInfo}`}>{excelResult.updatedCount}</div>
                      <div className={styles.statLabel}>Diperbarui</div>
                    </div>
                    {excelResult.errorCount > 0 && (
                      <div className={styles.statItem}>
                        <div className={`${styles.statNum} ${styles.statNumDanger}`}>{excelResult.errorCount}</div>
                        <div className={styles.statLabel}>Gagal</div>
                      </div>
                    )}
                  </div>

                  {excelResult.errors && excelResult.errors.length > 0 && (
                    <div className={`${styles.alertBox} ${styles.alertBoxWarning}`}>
                      <div>
                        <strong>Catatan baris error:</strong>
                        <ul className={styles.errorList}>
                          {excelResult.errors.slice(0, 5).map((e, idx) => (
                            <li key={idx}>Baris {e.rowNumber}: {e.error} {e.productName ? `(${e.productName})` : ''}</li>
                          ))}
                          {excelResult.errors.length > 5 && (
                            <li>...dan {excelResult.errors.length - 5} baris lainnya</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Petunjuk Singkat ZIP */}
              <div className={styles.helperNote}>
                Nama folder di dalam ZIP harus sesuai nama produk di Excel, dengan foto bernomor (<code>1.jpg</code>, <code>2.jpg</code>, dst). Foto <code>1.jpg</code> menjadi cover utama.
              </div>

              {/* Dropzone ZIP */}
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className={styles.hiddenFileInput}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setZipFile(e.target.files[0]);
                    setZipError('');
                    setZipResult(null);
                  }
                }}
              />
              <div
                className={`${styles.dropZone} ${isZipDragOver ? styles.dropZoneActive : ''}`}
                onClick={() => zipInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsZipDragOver(true);
                }}
                onDragLeave={() => setIsZipDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsZipDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setZipFile(e.dataTransfer.files[0]);
                    setZipError('');
                    setZipResult(null);
                  }
                }}
              >
                <div className={styles.dropIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <polyline points="9 14 12 11 15 14" />
                  </svg>
                </div>
                <div className={styles.dropTitle}>
                  {zipFile ? 'Klik untuk mengganti file ZIP' : 'Pilih atau Tarik File ZIP ke Sini'}
                </div>
                <div className={styles.dropSubtitle}>
                  Maksimal 200MB (.zip)
                </div>

                {zipFile && (
                  <div
                    className={styles.fileSelectedBadge}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{zipFile.name} ({(zipFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                    <button
                      type="button"
                      className={styles.fileRemoveBtn}
                      title="Hapus file"
                      onClick={() => {
                        setZipFile(null);
                        setZipResult(null);
                        setZipError('');
                        if (zipInputRef.current) zipInputRef.current.value = '';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Progress Bar ZIP Upload */}
              {isZipUploading && (
                <div className={styles.uploadProgressWrapper}>
                  <div className={styles.uploadProgressHeader}>
                    <span className={styles.uploadProgressLabel}>Mengunggah ZIP...</span>
                    <span className={styles.uploadProgressPct}>{zipUploadProgress}%</span>
                  </div>
                  <div className={styles.uploadProgressTrack}>
                    <div
                      className={styles.uploadProgressFill}
                      style={{ width: `${zipUploadProgress}%` }}
                    />
                  </div>
                  {zipUploadProgress === 100 && (
                    <div className={styles.uploadProgressProcessing}>Memproses gambar di server...</div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {zipError && (
                <div className={`${styles.alertBox} ${styles.alertBoxError}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>{zipError}</div>
                </div>
              )}

              {/* Result Summary (Tanpa tombol duplikat) */}
              {zipResult && (
                <div className={styles.resultCard}>
                  <div className={styles.resultTitle}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" color="var(--status-success, #22c55e)">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Foto Produk Berhasil Ditautkan</span>
                  </div>

                  <div className={styles.statGrid}>
                    <div className={styles.statItem}>
                      <div className={`${styles.statNum} ${styles.statNumSuccess}`}>{zipResult.totalMatched}</div>
                      <div className={styles.statLabel}>Produk Terisi Foto</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={`${styles.statNum} ${styles.statNumInfo}`}>{zipResult.totalImagesSaved}</div>
                      <div className={styles.statLabel}>Total Foto</div>
                    </div>
                    {zipResult.totalUnmatched > 0 && (
                      <div className={styles.statItem}>
                        <div className={`${styles.statNum} ${styles.statNumWarning}`}>{zipResult.totalUnmatched}</div>
                        <div className={styles.statLabel}>Folder Tak Cocok</div>
                      </div>
                    )}
                  </div>

                  {/* Preview Foto Produk */}
                  {zipResult.results && zipResult.results.length > 0 && (
                    <div className={styles.previewSection}>
                      <div className={styles.previewTitle}>
                        Preview Cover Produk:
                      </div>
                      <div className={styles.galleryPreviewList}>
                        {zipResult.results.map((p) => (
                          <div key={p.productId} className={styles.previewCard}>
                            <div className={styles.previewThumb}>
                              <Image src={p.coverImage || '/img/betta-1.png'} alt={p.productName} fill sizes="120px" className={styles.previewThumbImg} />
                            </div>
                            <div className={styles.previewInfo}>
                              <div className={styles.previewName} title={p.productName}>{p.productName}</div>
                              <div className={styles.previewCount}>{p.imageCount} foto</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warning Unmatched */}
                  {zipResult.unmatched && zipResult.unmatched.length > 0 && (
                    <div className={`${styles.alertBox} ${styles.alertBoxWarning}`}>
                      <div>
                        <strong>Folder tidak cocok di database:</strong>
                        <ul className={styles.errorList}>
                          {zipResult.unmatched.map((u, idx) => (
                            <li key={idx}><strong>&quot;{u.folderName}&quot;</strong>: {u.reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions (Satu-satunya tempat tombol aksi) */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={handleClose}
            className={styles.footerBtnCancel}
          >
            {excelResult || zipResult ? 'Tutup' : 'Batal'}
          </button>

          <div className={styles.footerRightActions}>
            {activeTab === 'excel' ? (
              excelResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleFinish('Data produk dari Excel berhasil ditambahkan!')}
                    className={styles.secondaryActionBtn}
                  >
                    Selesai
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('zip')}
                    className={styles.primaryActionBtn}
                  >
                    <span>Lanjut Upload Foto (ZIP)</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!excelFile || isExcelUploading}
                  onClick={handleUploadExcel}
                  className={styles.primaryActionBtn}
                >
                  {isExcelUploading ? (
                    <>
                      <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                      </svg>
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Upload Excel</span>
                    </>
                  )}
                </button>
              )
            ) : (
              zipResult ? (
                <button
                  type="button"
                  onClick={() => handleFinish('Data produk dan galeri foto berhasil ditambahkan!')}
                  className={styles.primaryActionBtn}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Selesai</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!zipFile || isZipUploading}
                  onClick={handleUploadZip}
                  className={styles.primaryActionBtn}
                >
                  {isZipUploading ? (
                    <>
                      <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                      </svg>
                      <span>
                        {zipUploadProgress < 100
                          ? `Mengunggah ${zipUploadProgress}%`
                          : 'Memproses...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Upload Foto ZIP</span>
                    </>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
