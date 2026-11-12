'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import ToggleSwitch from '@/components/admin/ToggleSwitch';
import styles from './roles.module.css';

const ROLE_COLOR_PRESETS = [
  { name: 'Flame', hex: '#FF6B35' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Teal', hex: '#0D9488' },
  { name: 'Sky', hex: '#0284C7' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'Violet', hex: '#7C3AED' },
  { name: 'Fuchsia', hex: '#C026D3' },
  { name: 'Slate', hex: '#475569' },
];

function isValidHex(hex) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);
}

function getActionBadgeClass(action) {
  switch (action) {
    case 'view':
      return styles.actionBadgeView;
    case 'create':
      return styles.actionBadgeCreate;
    case 'update':
      return styles.actionBadgeUpdate;
    case 'delete':
      return styles.actionBadgeDelete;
    case 'widget':
      return styles.actionBadgeWidget;
    default:
      return styles.actionBadgeCustom;
  }
}

export default function RoleModal({ isOpen, onClose, onSaved, role, systemPermissions = [] }) {
  const { toast } = useToast();
  const isEditing = !!role;

  const [name, setName] = useState(role?.name || '');
  const [slug, setSlug] = useState(role?.slug || '');
  const [description, setDescription] = useState(role?.description || '');
  const [color, setColor] = useState(role?.color || '#3B82F6');
  const [selectedPerms, setSelectedPerms] = useState(
    () => new Set(Array.isArray(role?.permissions) ? role.permissions : [])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allAvailableKeys = useMemo(() => {
    return systemPermissions.flatMap((m) => m.permissions.map((p) => p.key));
  }, [systemPermissions]);

  const isAllGlobalSelected = useMemo(() => {
    return allAvailableKeys.length > 0 && allAvailableKeys.every((k) => selectedPerms.has(k));
  }, [allAvailableKeys, selectedPerms]);

  const handleToggleGlobalAll = (enable) => {
    if (enable) {
      setSelectedPerms(new Set(allAvailableKeys));
    } else {
      setSelectedPerms(new Set());
    }
  };

  const togglePermission = (key) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleModulePermissions = (module, enable) => {
    const keys = module.permissions.map((p) => p.key);
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (enable) {
        keys.forEach((k) => next.add(k));
      } else {
        keys.forEach((k) => next.delete(k));
      }
      return next;
    });
  };

  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return systemPermissions;

    return systemPermissions
      .map((mod) => {
        const matchingPerms = mod.permissions.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            (p.action && p.action.toLowerCase().includes(q))
        );
        const matchesModuleHeader =
          mod.moduleLabel.toLowerCase().includes(q) || mod.description.toLowerCase().includes(q);

        if (matchingPerms.length > 0) {
          return { ...mod, permissions: matchingPerms };
        }
        if (matchesModuleHeader) {
          return mod;
        }
        return null;
      })
      .filter(Boolean);
  }, [systemPermissions, searchQuery]);

  if (!isOpen) return null;

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!isEditing) {
      setSlug(slugify(val));
    }
  };

  const handleColorChange = (newHex) => {
    setColor(newHex.toUpperCase());
  };

  const handleHexInputChange = (val) => {
    const sanitized = val.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setColor(`#${sanitized}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('Nama role wajib diisi.');
      return;
    }
    if (!isEditing && !slug.trim()) {
      toast.warning('Slug role wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const url = isEditing ? `/api/admin/roles/${role.id}` : '/api/admin/roles';
      const method = isEditing ? 'PUT' : 'POST';
      const finalColor = isValidHex(color) ? color.toUpperCase() : '#3B82F6';
      const payload = {
        name: name.trim(),
        description: description.trim(),
        color: finalColor,
        permissions: Array.from(selectedPerms),
      };
      if (!isEditing) {
        payload.slug = slug.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan role.');
        return;
      }

      toast.success(isEditing ? `Role "${data.name}" berhasil diperbarui.` : `Role "${data.name}" berhasil dibuat.`);
      onSaved(data);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{isEditing ? `Edit Role: ${role.name}` : 'Tambah Role Baru'}</h2>
            <div className={styles.modalSubtitle}>
              Atur identitas dan hak akses operasional untuk posisi ini.
            </div>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Tutup">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.modalBody}>
            {/* Field Informasi Role */}
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Nama Role *</label>
                <input
                  type="text"
                  className={styles.inputControl}
                  placeholder="Contoh: Staff Gudang & Logistik"
                  value={name}
                  onChange={handleNameChange}
                  maxLength={50}
                  required
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Slug Identifier *</label>
                <input
                  type="text"
                  className={styles.inputControl}
                  placeholder="staff_gudang"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  disabled={isEditing}
                  maxLength={30}
                  required
                />
                <span className={styles.fieldHelp}>
                  {isEditing ? 'Slug permanen dan tidak dapat diubah.' : 'Hanya huruf kecil, angka, atau underscore.'}
                </span>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Deskripsi Role</label>
              <input
                type="text"
                className={styles.inputControl}
                placeholder="Penjelasan wewenang operasional untuk posisi ini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
              />
            </div>

            {/* Warna Label Role (Linear-Grade Color Control) */}
            <div className={styles.colorFieldSection}>
              <label className={styles.fieldLabel}>Warna Label</label>
              <div className={styles.colorControlBar}>
                {/* Swatch Button with hidden native color input */}
                <label className={styles.colorSwatchBtn} title="Pilih warna kustom">
                  <input
                    type="color"
                    className={styles.colorInputHidden}
                    value={isValidHex(color) ? color : '#3B82F6'}
                    onChange={(e) => handleColorChange(e.target.value)}
                    aria-label="Pilih spektrum warna role"
                  />
                  <span
                    className={styles.colorSwatchDisc}
                    style={{ '--swatch-color': isValidHex(color) ? color : '#3B82F6' }}
                  />
                </label>

                {/* Hex Input */}
                <div className={styles.hexInputControl}>
                  <span className={styles.hexPrefix}>#</span>
                  <input
                    type="text"
                    className={styles.hexInputText}
                    placeholder="3B82F6"
                    value={color.startsWith('#') ? color.slice(1) : color}
                    onChange={(e) => handleHexInputChange(e.target.value)}
                    maxLength={6}
                    spellCheck={false}
                    aria-label="Kode Hex warna role"
                  />
                </div>

                <div className={styles.colorBarDivider} />

                {/* Preset Swatches Palette */}
                <div className={styles.presetPaletteGroup} role="group" aria-label="Palet warna kurasi">
                  {ROLE_COLOR_PRESETS.map((preset) => {
                    const isSelected = color.toUpperCase() === preset.hex.toUpperCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        className={`${styles.presetSwatchItem} ${isSelected ? styles.presetSwatchItemActive : ''}`}
                        style={{ '--preset-color': preset.hex }}
                        onClick={() => handleColorChange(preset.hex)}
                        title={preset.name}
                        aria-label={preset.name}
                      />
                    );
                  })}
                </div>

                {/* Live Preview Badge */}
                <div className={styles.previewBadgeContainer}>
                  <span
                    className={styles.rolePreviewBadge}
                    style={{ '--role-color': isValidHex(color) ? color : '#3B82F6' }}
                  >
                    <span className={styles.rolePreviewDot} />
                    {name.trim() || 'Label Role'}
                  </span>
                </div>
              </div>
            </div>

            {/* Permission Toolbar */}
            <div className={styles.permToolbar}>
              <div className={styles.permSearchBox}>
                <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className={styles.permSearchInput}
                  placeholder="Cari aksi (view, create, update, delete, kpi, dll)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={styles.searchClearBtn}
                  >
                    Batal
                  </button>
                )}
              </div>

              <div className={styles.permToolbarRight}>
                <span className={styles.permCounterBadge}>
                  {selectedPerms.size} / {allAvailableKeys.length} Izin Aktif
                </span>
                <div className={styles.toolbarToggleWrap}>
                  <ToggleSwitch
                    checked={isAllGlobalSelected}
                    onChange={handleToggleGlobalAll}
                    size="sm"
                    label={isAllGlobalSelected ? 'Semua Aktif' : 'Aktifkan Semua'}
                    ariaLabel="Toggle seluruh izin sistem"
                  />
                </div>
              </div>
            </div>

            {/* Module Matrix */}
            <div className={styles.matrixWrapper}>
              {filteredModules.length === 0 ? (
                <div className={styles.emptyMatrixBox}>
                  Tidak ada izin atau modul yang cocok dengan pencarian &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredModules.map((mod) => {
                  const modKeys = mod.permissions.map((p) => p.key);
                  const activeModCount = modKeys.filter((k) => selectedPerms.has(k)).length;
                  const isModAllActive = modKeys.length > 0 && activeModCount === modKeys.length;

                  return (
                    <div key={mod.module} className={styles.moduleBox}>
                      <div className={styles.moduleHeader}>
                        <div className={styles.moduleTitleWrap}>
                          <div className={styles.moduleLabel}>
                            <span>{mod.moduleLabel}</span>
                            <span className={styles.moduleActiveCount}>
                              ({activeModCount}/{modKeys.length} Aktif)
                            </span>
                          </div>
                          <div className={styles.moduleDesc}>{mod.description}</div>
                        </div>

                        <div className={styles.moduleHeaderRight}>
                          <ToggleSwitch
                            checked={isModAllActive}
                            onChange={(enable) => toggleModulePermissions(mod, enable)}
                            size="sm"
                            label={isModAllActive ? 'Semua Aktif' : 'Aktifkan Modul'}
                            ariaLabel={`Toggle semua izin modul ${mod.moduleLabel}`}
                          />
                        </div>
                      </div>

                      <div className={styles.modulePermsGrid}>
                        {mod.permissions.map((p) => {
                          const isChecked = selectedPerms.has(p.key);
                          const actionType = p.action || 'custom';

                          return (
                            <div
                              key={p.key}
                              className={`${styles.permActionCard} ${isChecked ? styles.permActionCardActive : ''}`}
                              onClick={() => togglePermission(p.key)}
                            >
                              <div className={styles.permActionLeft}>
                                <div className={styles.permActionHeader}>
                                  <span className={`${styles.actionBadge} ${getActionBadgeClass(actionType)}`}>
                                    {actionType.toUpperCase()}
                                  </span>
                                  <span className={styles.permActionTitle}>{p.label}</span>
                                </div>
                                <div className={styles.permActionDesc}>{p.description}</div>
                              </div>

                              <ToggleSwitch
                                checked={isChecked}
                                onChange={() => togglePermission(p.key)}
                                size="md"
                                ariaLabel={`Saklar hak akses ${p.label}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.outlineBtn} onClick={onClose} disabled={submitting}>
              Batal
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Buat Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
