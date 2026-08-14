'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '@/app/admin/dashboard/adminDashboard.module.css';

export default function ManageableSelect({ label, value, onChange, options, setOptions }) {
  const [isOpen, setIsOpen] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsDeleteMode(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
      alert('Opsi ini sudah ada.');
      return;
    }
    setOptions([...options, trimmed]);
    onChange(trimmed);
    setNewValue('');
  };

  const handleDelete = (opt, e) => {
    e.stopPropagation();
    if (opt === value) {
      const remaining = options.filter((o) => o !== opt);
      onChange(remaining.length > 0 ? remaining[0] : '');
    }
    setOptions(options.filter((o) => o !== opt));
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <label className={styles.formLabel}>{label}</label>
      <div onClick={() => setIsOpen(!isOpen)} className={styles.selectTrigger}>
        <span>{value || '-- Pilih --'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && (
        <div className={styles.selectDropdown}>
          <div className={styles.selectHeader}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pilih Opsi</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteMode(!isDeleteMode);
              }}
              className={styles.selectEditBtn}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              {isDeleteMode ? 'Selesai Edit' : 'Edit List'}
            </button>
          </div>

          <div className={styles.selectList}>
            {options.map((opt) => {
              const isSelected = opt === value;
              return (
                <div
                  key={opt}
                  onClick={() => {
                    if (isDeleteMode) return;
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className={`${styles.selectItem} ${isSelected ? styles.selectItemSelected : ''}`}
                  style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
                >
                  <span>{opt}</span>
                  {isDeleteMode && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(opt, e)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className={styles.selectFooter}>
            <input
              type="text"
              placeholder="Tambah opsi baru..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className={styles.formInput}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAdd}
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem' }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
