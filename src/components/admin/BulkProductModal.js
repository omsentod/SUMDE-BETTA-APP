'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import styles from './BulkProductModal.module.css';

export default function BulkProductModal({ isOpen, onClose, onComplete }) {
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

  const excelInputRef = useRef(null);
  const zipInputRef = useRef(null);

  if (!isOpen) return null;

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

  // Handle ZIP File Upload
  const handleUploadZip = async () => {
    if (!zipFile) return;
    setIsZipUploading(true);
    setZipError('');
    setZipResult(null);

    const fd = new FormData();
    fd.append('file', zipFile);

    try {
      const res = await fetch('/api/admin/products/bulk/zip', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses file ZIP.');
      setZipResult(data);
      if (onComplete) onComplete();
    } catch (err) {
      setZipError(err.message);
    } finally {
      setIsZipUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/admin/products/bulk/template';
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Uplaod Massal
            </h2>
            <p className={styles.modalSubtitle}>
              Unggah data produk dalam jumlah banyak via Excel, lalu lengkapi fotonya via file ZIP.
            </p>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Tutup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'excel' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('excel')}
          >
            <span className={styles.stepBadge}>1</span>
            Data Produk (Excel)
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'zip' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('zip')}
          >
            <span className={styles.stepBadge}>2</span>
            Galeri Foto (ZIP)
          </button>
        </div>

        {/* Body Content */}
        <div className={styles.modalBody}>
          {activeTab === 'excel' ? (
            <>
              {/* Petunjuk Alur Excel */}
              <div className={styles.infoCard}>
                <div className={styles.infoCardTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Langkah 1: Upload Data Produk Tanpa Gambar
                </div>
                Unggah file spreadsheet (.xlsx/.xls/.csv) berisi informasi produk (nama, harga, kategori, stok, ukuran, dll). Produk akan tersimpan di database tanpa foto, dan siap diisi fotonya pada Langkah 2.
              </div>

              {/* Download Template Bar */}
              <div className={styles.templateDownloadBar}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                    Gunakan Format Template Resmi
                  </div>
                  <div className={styles.templateText}>
                    Unduh file Excel contoh dengan kolom yang sudah disesuaikan dan petunjuk pengisian.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className={styles.downloadBtn}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Template Excel
                </button>
              </div>

              {/* Dropzone Excel */}
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
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
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div className={styles.dropTitle}>
                  {excelFile ? 'Klik untuk mengganti file Excel' : 'Pilih atau Tarik File Excel ke Sini'}
                </div>
                <div className={styles.dropSubtitle}>
                  Mendukung file .xlsx, .xls, .csv (Maksimal 10MB)
                </div>

                {excelFile && (
                  <div className={styles.fileSelectedBadge}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)
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

              {/* Result Summary */}
              {excelResult && (
                <div className={styles.resultCard}>
                  <div className={styles.resultTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" color="var(--status-success, #22c55e)">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Proses Upload Excel Selesai
                  </div>
                  <div className={styles.statGrid}>
                    <div className={styles.statItem}>
                      <div className={styles.statNum}>{excelResult.totalRows}</div>
                      <div className={styles.statLabel}>Total Baris</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statNum} style={{ color: '#22c55e' }}>{excelResult.createdCount}</div>
                      <div className={styles.statLabel}>Produk Baru Dibuat</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statNum} style={{ color: '#3b82f6' }}>{excelResult.updatedCount}</div>
                      <div className={styles.statLabel}>Produk Diperbarui</div>
                    </div>
                    {excelResult.errorCount > 0 && (
                      <div className={styles.statItem}>
                        <div className={styles.statNum} style={{ color: '#ef4444' }}>{excelResult.errorCount}</div>
                        <div className={styles.statLabel}>Gagal / Error</div>
                      </div>
                    )}
                  </div>

                  {excelResult.errors && excelResult.errors.length > 0 && (
                    <div className={`${styles.alertBox} ${styles.alertBoxWarning}`}>
                      <div>
                        <strong>Catatan baris yang perlu diperiksa:</strong>
                        <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('zip')}
                      className="btn btn-primary"
                      style={{ borderRadius: '30px', padding: '0.6rem 1.4rem', fontSize: '0.85rem' }}
                    >
                      Lanjut ke Langkah 2: Upload Foto ZIP &rarr;
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Petunjuk Alur ZIP */}
              <div className={styles.infoCard}>
                <div className={styles.infoCardTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  Langkah 2: Upload Galeri Foto Produk (ZIP Berisi Folder)
                </div>
                Unggah file ZIP yang berisi folder-folder. Nama tiap folder harus <strong>persis sama dengan nama produk</strong> yang diunggah di Excel. Di dalam tiap folder, foto diberi nama angka (<strong>1.jpg, 2.jpg, 3.jpg, dst</strong>). Foto nomor 1 otomatis menjadi foto cover utama produk.
              </div>

              {/* Struktur Folder ZIP */}
              <div className={styles.zipStructureBox}>
                <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.35rem' }}>
                  Struktur Folder di Dalam File ZIP:
                </div>
                <div className={styles.structureLine}>
                  <span>arsip_foto.zip</span>
                </div>
                <div className={styles.structureLine} style={{ paddingLeft: '1.2rem' }}>
                  <span>├── <strong>Halfmoon Super Red High Quality</strong>/</span>
                  <span className={styles.structureComment}>&larr; (Nama produk)</span>
                </div>
                <div className={styles.structureLine} style={{ paddingLeft: '2.4rem' }}>
                  <span>├── 1.jpg</span>
                  <span className={styles.structureComment}>&larr; (Cover utama)</span>
                </div>
                <div className={styles.structureLine} style={{ paddingLeft: '2.4rem' }}>
                  <span>├── 2.jpg</span>
                  <span className={styles.structureComment}>&larr; (Foto samping)</span>
                </div>
                <div className={styles.structureLine} style={{ paddingLeft: '2.4rem' }}>
                  <span>└── 3.jpg</span>
                  <span className={styles.structureComment}>&larr; (Detail sirip)</span>
                </div>
                <div className={styles.structureLine} style={{ paddingLeft: '1.2rem' }}>
                  <span>└── <strong>Plakat Multicolor Fancy Top Grade</strong>/</span>
                </div>
                <div className={styles.structureLine} style={{ paddingLeft: '2.4rem' }}>
                  <span>├── 1.png</span>
                </div>
                <div className={styles.structureLine} style={{ paddingLeft: '2.4rem' }}>
                  <span>└── 2.png</span>
                </div>
              </div>

              {/* Dropzone ZIP */}
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
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
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <polyline points="9 14 12 11 15 14" />
                  </svg>
                </div>
                <div className={styles.dropTitle}>
                  {zipFile ? 'Klik untuk mengganti file ZIP' : 'Pilih atau Tarik File ZIP ke Sini'}
                </div>
                <div className={styles.dropSubtitle}>
                  Mendukung file .zip (Maksimal 200MB)
                </div>

                {zipFile && (
                  <div className={styles.fileSelectedBadge}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {zipFile.name} ({(zipFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </div>
                )}
              </div>

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

              {/* Result Summary */}
              {zipResult && (
                <div className={styles.resultCard}>
                  <div className={styles.resultTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" color="var(--status-success, #22c55e)">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Ekstraksi Foto ZIP Berhasil
                  </div>
                  <div className={styles.statGrid}>
                    <div className={styles.statItem}>
                      <div className={styles.statNum} style={{ color: '#22c55e' }}>{zipResult.totalMatched}</div>
                      <div className={styles.statLabel}>Produk Terisi Foto</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statNum} style={{ color: '#3b82f6' }}>{zipResult.totalImagesSaved}</div>
                      <div className={styles.statLabel}>Total Foto Diunggah</div>
                    </div>
                    {zipResult.totalUnmatched > 0 && (
                      <div className={styles.statItem}>
                        <div className={styles.statNum} style={{ color: '#eab308' }}>{zipResult.totalUnmatched}</div>
                        <div className={styles.statLabel}>Folder Tak Cocok</div>
                      </div>
                    )}
                  </div>

                  {/* Preview Foto Produk */}
                  {zipResult.results && zipResult.results.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                        Preview Cover Produk yang Diperbarui:
                      </div>
                      <div className={styles.galleryPreviewList}>
                        {zipResult.results.map((p) => (
                          <div key={p.productId} className={styles.previewCard}>
                            <div className={styles.previewThumb}>
                              <Image src={p.coverImage} alt={p.productName} fill sizes="150px" style={{ objectFit: 'cover' }} />
                            </div>
                            <div className={styles.previewInfo}>
                              <div className={styles.previewName} title={p.productName}>{p.productName}</div>
                              <div className={styles.previewCount}>{p.imageCount} foto tersimpan</div>
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
                        <strong>Folder yang tidak cocok dengan nama produk di database:</strong>
                        <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
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

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            style={{ borderRadius: '30px', padding: '0.65rem 1.4rem' }}
          >
            Tutup
          </button>

          {activeTab === 'excel' ? (
            <button
              type="button"
              disabled={!excelFile || isExcelUploading}
              onClick={handleUploadExcel}
              className={styles.uploadActionBtn}
            >
              {isExcelUploading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                  </svg>
                  Sedang Memproses Excel...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Proses & Upload Excel
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={!zipFile || isZipUploading}
              onClick={handleUploadZip}
              className={styles.uploadActionBtn}
            >
              {isZipUploading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                  </svg>
                  Sedang Mengekstrak & Menyimpan Foto...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Ekstrak & Tautkan Foto ZIP
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
