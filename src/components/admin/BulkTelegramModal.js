'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useToast } from '@/context/ToastContext';
import styles from './bulkTelegramModal.module.css';

const formatCurrency = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

export default function BulkTelegramModal({ isOpen, onClose, products = [], onComplete }) {
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [prefix, setPrefix] = useState('#');
  const [startNum, setStartNum] = useState('1');
  const [padZero, setPadZero] = useState(true);
  const [durationHours, setDurationHours] = useState('24');
  const [isSending, setIsSending] = useState(false);

  // Inisialisasi daftar produk terpilih saat modal dibuka
  useEffect(() => {
    if (isOpen && products.length > 0) {
      const initialized = products.map((p, idx) => ({
        id: p.id,
        name: p.name,
        image: p.image || '/img/betta-1.png',
        price: p.price,
        form: p.form,
        dropNumber: p.dropNumber || `#${String(idx + 1).padStart(2, '0')}`,
      }));
      setItems(initialized);
      setStartNum('1');
      setPrefix('#');
      setPadZero(true);
      setDurationHours('24');
      setIsSending(false);
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  // Fitur penomoran otomatis secara masif
  const handleApplyAutoNumber = () => {
    const start = parseInt(startNum) || 1;
    const cleanPrefix = prefix.trim();
    const updated = items.map((item, idx) => {
      const numVal = start + idx;
      const numFormatted = padZero ? String(numVal).padStart(2, '0') : String(numVal);
      return {
        ...item,
        dropNumber: `${cleanPrefix}${numFormatted}`,
      };
    });
    setItems(updated);
    toast.info(`Nomor berurutan (${cleanPrefix}${padZero ? String(start).padStart(2, '0') : start} s/d ...) berhasil diterapkan ke ${items.length} ikan.`);
  };

  const handleUpdateItemNumber = (index, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], dropNumber: value };
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    if (updated.length === 0) {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;

    // Validasi kode drop tidak boleh kosong
    for (const item of items) {
      if (!item.dropNumber || !item.dropNumber.trim()) {
        toast.error(`Nomor drop untuk "${item.name}" belum diisi.`);
        return;
      }
    }

    setIsSending(true);
    try {
      const payload = {
        items: items.map((item) => ({
          productId: item.id,
          dropNumber: item.dropNumber.trim(),
        })),
        durationHours: Number(durationHours) || 24,
      };

      const res = await fetch('/api/admin/products/bulk/broadcast-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal melakukan broadcast masif.');
      }

      if (data.succeeded > 0) {
        toast.success(`Berhasil membroadcast ${data.succeeded} ikan ke grup Telegram!`);
      }
      if (data.failed > 0) {
        toast.warning(`${data.failed} ikan gagal dibroadcast.`);
      }

      if (onComplete) {
        onComplete(data);
      }
      onClose();
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan saat broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <h3 className={styles.modalTitle}>
              <svg className={styles.telegramIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              Broadcast Masif Telegram
            </h3>
            <p className={styles.modalSubtitle}>
              Kirim {items.length} ikan sekaligus ke grup Telegram SUMDE BETTA
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isSending}
            title="Tutup"
            aria-label="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Body */}
          <div className={styles.modalBody}>
            {/* Auto Number Generator Box */}
            <div className={styles.generatorBox}>
              <div className={styles.generatorLabel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
                Atur Nomor / Kode Berurutan Otomatis:
              </div>

              <div className={styles.generatorControls}>
                <div className={styles.inputGroup}>
                  <span className={styles.inputPrefix}>Prefix:</span>
                  <input
                    type="text"
                    className={styles.genInput}
                    style={{ width: '45px', textAlign: 'center' }}
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="#"
                    disabled={isSending}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <span className={styles.inputPrefix}>Mulai dari:</span>
                  <input
                    type="number"
                    className={styles.genInput}
                    style={{ width: '60px', textAlign: 'center' }}
                    value={startNum}
                    min="1"
                    onChange={(e) => setStartNum(e.target.value)}
                    disabled={isSending}
                  />
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={padZero}
                    onChange={(e) => setPadZero(e.target.checked)}
                    disabled={isSending}
                  />
                  Format 2 Digit (01, 02)
                </label>

                <button
                  type="button"
                  className={styles.applyBtn}
                  onClick={handleApplyAutoNumber}
                  disabled={isSending}
                >
                  Terapkan ke Semua
                </button>
              </div>
            </div>

            {/* Product List Table */}
            <div className={styles.tableWrapper}>
              <div className={styles.itemList}>
                {items.map((item, index) => (
                  <div key={item.id} className={styles.itemRow}>
                    <span className={styles.itemIndex}>{index + 1}</span>

                    <div className={styles.itemThumb}>
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="40px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>

                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{item.name}</div>
                      <div className={styles.itemMeta}>
                        <span>{item.form || '-'}</span>
                        <span>•</span>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.itemInputGroup}>
                      <input
                        type="text"
                        className={styles.dropInput}
                        placeholder="#01"
                        value={item.dropNumber}
                        onChange={(e) => handleUpdateItemNumber(index, e.target.value)}
                        disabled={isSending}
                        required
                        title="Kode atau Nomor Ikan di Telegram"
                      />

                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleRemoveItem(index)}
                        disabled={isSending}
                        title="Hapus dari antrean"
                        aria-label="Hapus dari antrean"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop Duration Setting */}
            <div className={styles.settingsRow}>
              <span className={styles.settingLabel}>Masa Aktif Daily Drop:</span>
              <select
                className={styles.selectInput}
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                disabled={isSending}
              >
                <option value="12">12 Jam</option>
                <option value="24">24 Jam (Rekomendasi)</option>
                <option value="48">48 Jam</option>
              </select>
            </div>

            {/* Sending indicator */}
            {isSending && (
              <div className={styles.progressBox}>
                <div className={styles.progressText}>
                  <div className={styles.spinner} />
                  <span>Sedang mengirim {items.length} ikan ke grup Telegram...</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Mohon tunggu beberapa detik, sistem memberi jeda otomatis agar tidak terkena limit Telegram.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <span className={styles.footerSummary}>
              {items.length} ikan siap dikirim
            </span>

            <div className={styles.actionButtons}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={isSending}
              >
                Batal
              </button>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSending || items.length === 0}
              >
                {isSending ? (
                  <>
                    <div className={styles.spinner} />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    Kirim ke Telegram ({items.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
