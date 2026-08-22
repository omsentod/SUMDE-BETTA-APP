'use client';

import { useState, useCallback } from 'react';
import styles from '@/app/admin/dashboard/adminDashboard.module.css';

export function useConfirmModal() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    desc: '',
    confirmText: 'Hapus Data',
    isDanger: true,
    onConfirm: null,
  });

  const open = useCallback((opts) => {
    setState({
      isOpen: true,
      title: opts.title || 'Konfirmasi',
      desc: opts.desc || '',
      confirmText: opts.confirmText || 'Hapus Data',
      isDanger: opts.isDanger !== false,
      onConfirm: opts.onConfirm || null,
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return { state, open, close };
}

export default function AdminConfirmModal({ state, onClose }) {
  if (!state.isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.confirmModal}>
        <div className={styles.confirmIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h4 className={styles.confirmTitle}>{state.title}</h4>
        <p className={styles.confirmDesc}>{state.desc}</p>
        <div className={styles.confirmActions}>
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ flex: 1, borderRadius: '30px', padding: '0.75rem' }}
          >
            Batal
          </button>
          <button
            onClick={async () => {
              if (state.onConfirm) await state.onConfirm();
              onClose();
            }}
            className="btn btn-primary"
            style={{
              flex: 1,
              borderRadius: '30px',
              padding: '0.75rem',
              background: state.isDanger !== false ? 'var(--status-error)' : 'var(--primary)',
              borderColor: state.isDanger !== false ? 'var(--status-error)' : 'var(--primary)',
              color: '#fff',
            }}
          >
            {state.confirmText || 'Hapus Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
