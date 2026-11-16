'use client';

import { useMemo, useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import LiveSelect from './LiveSelect';
import styles from './tiktokLive.module.css';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

// Memformat angka string mentah menjadi format ribuan dengan titik (misal 100000 -> 100.000, mulai 1.000)
function formatThousands(val) {
  if (val === null || val === undefined || val === '') return '';
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Mengambil nilai angka integer murni dari string berformat ribuan
function parseThousands(val) {
  if (val === null || val === undefined || val === '') return 0;
  const clean = String(val).replace(/\D/g, '');
  return clean ? Number(clean) : 0;
}

export default function AddDealModal({
  accounts,
  selectedAccountId,
  onAccountChange,
  catalogProducts,
  initialUsername = '',
  onClose,
  onSaved,
}) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const selectableAccounts = useMemo(() => {
    const active = accounts.filter((a) => a.isActive);
    return active.length > 0 ? active : accounts;
  }, [accounts]);

  const accountOptions = useMemo(
    () =>
      selectableAccounts.map((acc) => ({
        value: acc.id,
        label: acc.name,
        sublabel: acc.handle,
      })),
    [selectableAccounts],
  );

  const productOptions = useMemo(
    () =>
      catalogProducts.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: `${formatRupiah(p.price)} • Stok ${p.quantity}`,
      })),
    [catalogProducts],
  );

  const [tiktokUsername, setTiktokUsername] = useState(initialUsername);
  const [entryMode, setEntryMode] = useState('custom'); // 'custom' | 'catalog'
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemNote, setItemNote] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(null);

  const selectedProduct = catalogProducts.find((p) => p.id === selectedProductId) || null;
  const variants = useMemo(() => selectedProduct?.variants || [], [selectedProduct]);

  const variantOptions = useMemo(
    () =>
      variants.map((v) => ({
        value: v.id,
        label: v.size,
        sublabel: `Stok ${v.stock} • ${formatRupiah(v.price ?? selectedProduct?.price)}`,
      })),
    [variants, selectedProduct],
  );

  const handleSelectProduct = (productId) => {
    setSelectedProductId(productId);
    setSelectedVariantId('');
    const prod = catalogProducts.find((p) => p.id === productId);
    if (!prod) {
      setItemName('');
      setItemPrice('');
      setItemImage('');
      return;
    }
    setItemName(prod.name);
    setItemImage(prod.image || '');
    if (prod.variants && prod.variants.length > 0) {
      const firstVar = prod.variants[0];
      setSelectedVariantId(firstVar.id);
      setItemPrice(formatThousands(firstVar.price ?? prod.price));
      if (firstVar.imageUrl) setItemImage(firstVar.imageUrl);
    } else {
      setItemPrice(formatThousands(prod.price));
    }
  };

  const handleSelectVariant = (variantId) => {
    setSelectedVariantId(variantId);
    const variant = variants.find((v) => v.id === variantId);
    if (!variant || !selectedProduct) return;
    setItemName(`${selectedProduct.name} (${variant.size})`);
    setItemPrice(formatThousands(variant.price ?? selectedProduct.price));
    if (variant.imageUrl) setItemImage(variant.imageUrl);
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal upload foto');
      setItemImage(data.url);
    } catch (err) {
      toast.error(err.message || 'Gagal upload foto');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const resetItemFields = (keepUsername) => {
    if (!keepUsername) setTiktokUsername('');
    setSelectedProductId('');
    setSelectedVariantId('');
    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setItemNote('');
    setItemImage('');
  };

  const submitDeal = async (keepOpenAfterSave) => {
    if (!selectedAccountId) {
      toast.warning('Pilih akun TikTok Live terlebih dahulu');
      return;
    }
    const cleanUser = tiktokUsername.trim().replace(/^@+/, '');
    if (!cleanUser) {
      toast.warning('Masukkan username TikTok pembeli');
      return;
    }
    if (!itemName.trim()) {
      toast.warning('Nama ikan atau item wajib diisi');
      return;
    }
    const numericPrice = parseThousands(itemPrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 1000) {
      toast.warning('Harga minimal Rp 1.000');
      return;
    }
    const numericQty = Math.max(1, parseInt(itemQty, 10) || 1);

    const activeVariant = variants.find((v) => v.id === selectedVariantId);

    setSubmitting(true);
    setSavedFeedback(null);
    try {
      const res = await fetch('/api/admin/tiktok-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiktokUsername: cleanUser,
          tiktokAccountId: selectedAccountId,
          productId: entryMode === 'catalog' && selectedProductId ? selectedProductId : null,
          variantId: entryMode === 'catalog' && selectedVariantId ? selectedVariantId : null,
          selectedSize: activeVariant?.size || null,
          name: itemName.trim(),
          price: numericPrice,
          quantity: numericQty,
          image: itemImage || null,
          note: itemNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan deal');

      await onSaved?.(data);

      if (keepOpenAfterSave) {
        resetItemFields(true);
        setSavedFeedback({
          text: `Tersimpan ke @${data.tiktokUsername} (${data.claimCode}). Akun TikTok tetap dipilih.`,
          claimToken: data.claimToken || '',
          tiktokUsername: data.tiktokUsername,
        });
      } else {
        toast.success(`Deal disimpan ke @${data.tiktokUsername} (${data.claimCode})`);
        onClose();
      }
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalCardWide} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div className={styles.modalHeadText}>
            <h2 className={styles.modalTitle}>Input Deal Live TikTok</h2>
            <p className={styles.cardDesc}>Catat ikan deal untuk pembeli live. Akun TikTok tidak akan reset saat simpan.</p>
          </div>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Tutup
          </button>
        </div>

        <form
          className={styles.formStack}
          onSubmit={(e) => {
            e.preventDefault();
            submitDeal(false);
          }}
        >
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="deal-account">
                Akun TikTok Live
              </label>
              <LiveSelect
                id="deal-account"
                value={selectedAccountId}
                onChange={onAccountChange}
                options={accountOptions}
                placeholder="Pilih Akun TikTok Live"
                ariaLabel="Pilih Akun TikTok Live"
              />
              <p className={styles.fieldHint}>Tetap tersimpan setelah simpan deal.</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="deal-username">
                Username Pembeli TikTok
              </label>
              <input
                id="deal-username"
                type="text"
                className={styles.input}
                placeholder="contoh: @budi_betta"
                value={tiktokUsername}
                onChange={(e) => setTiktokUsername(e.target.value)}
                autoFocus={!initialUsername}
                required
              />
            </div>
          </div>

          <div className={styles.modeSwitch}>
            <button
              type="button"
              className={`${styles.modeBtn} ${entryMode === 'custom' ? styles.modeBtnActive : ''}`}
              onClick={() => setEntryMode('custom')}
            >
              Input Bebas (Live)
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${entryMode === 'catalog' ? styles.modeBtnActive : ''}`}
              onClick={() => setEntryMode('catalog')}
            >
              Ambil dari Katalog
            </button>
          </div>

          {entryMode === 'catalog' && (
            <div className={variants.length > 0 ? styles.fieldRow : styles.field}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="deal-catalog">
                  Produk Katalog
                </label>
                <LiveSelect
                  id="deal-catalog"
                  value={selectedProductId}
                  onChange={handleSelectProduct}
                  options={productOptions}
                  placeholder="Pilih produk dari katalog..."
                  searchable
                  searchPlaceholder="Cari nama ikan atau produk..."
                  ariaLabel="Pilih produk dari katalog"
                />
              </div>

              {variants.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="deal-variant">
                    Varian / Ukuran
                  </label>
                  <LiveSelect
                    id="deal-variant"
                    value={selectedVariantId}
                    onChange={handleSelectVariant}
                    options={variantOptions}
                    placeholder="Pilih ukuran..."
                    ariaLabel="Pilih varian atau ukuran"
                  />
                </div>
              )}
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="deal-name">
              Nama Ikan / Item
            </label>
            <input
              id="deal-name"
              type="text"
              className={styles.input}
              placeholder="Contoh: HMPK Koi Galaxy Copper #12"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              autoFocus={Boolean(initialUsername)}
              required
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="deal-price">
                Harga Deal (Rp)
              </label>
              <input
                id="deal-price"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={styles.input}
                placeholder="Contoh: 150.000"
                value={itemPrice}
                onChange={(e) => setItemPrice(formatThousands(e.target.value))}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="deal-qty">
                Qty
              </label>
              <input
                id="deal-qty"
                type="number"
                min="1"
                className={styles.input}
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="deal-note">
                Catatan (Opsional)
              </label>
              <input
                id="deal-note"
                type="text"
                className={styles.input}
                placeholder="Bonus ketapang / video DM"
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Foto Singkat (Opsional)</span>
              <div className={styles.uploadRow}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.fileInputHidden}
                  onChange={handleUploadImage}
                />
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Mengunggah...' : itemImage ? 'Ganti Foto' : 'Upload Foto'}
                </button>
                {itemImage && (
                  <>
                    <img src={itemImage} alt="Preview" className={styles.uploadPreview} />
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setItemImage('')}
                    >
                      Hapus
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {savedFeedback && (
            <div className={styles.inlineFeedback}>
              <span>{savedFeedback.text}</span>
              {savedFeedback.claimToken && (
                <button
                  type="button"
                  className={styles.btnSmall}
                  onClick={async () => {
                    const url = `${window.location.origin}/live/${savedFeedback.claimToken}`;
                    const dmText = [
                      `Halo kak @${savedFeedback.tiktokUsername}!`,
                      ``,
                      `Terima kasih sudah ikutan sesi TikTok Live Sumde Betta.`,
                      `Berikut link rekap order & keep ikan kamu:`,
                      url,
                      ``,
                      `Silakan buka link di atas untuk cek rincian ikan, lengkapi alamat kirim, dan selesaikan pembayaran ya kak.`,
                      `Terima kasih & salam satu air!`,
                    ].join('\n');
                    try {
                      await navigator.clipboard.writeText(dmText);
                      toast.success(`Pesan DM untuk @${savedFeedback.tiktokUsername} disalin ke clipboard`);
                    } catch {
                      toast.info(`Link live: ${url}`);
                    }
                  }}
                >
                  Salin Pesan DM
                </button>
              )}
            </div>
          )}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnOutline} onClick={onClose} disabled={submitting}>
              Batal
            </button>
            <button
              type="button"
              className={styles.btnOutline}
              disabled={submitting}
              onClick={() => submitDeal(true)}
            >
              {submitting ? 'Menyimpan...' : 'Simpan & Tambah Lagi'}
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
