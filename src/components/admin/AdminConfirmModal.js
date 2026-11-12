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

export default function AdminConfirmModal({ state = {}, onClose }) {
  if (!state?.isOpen) return null;

  const isDanger = state.isDanger !== false;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div className={styles.confirmHeader}>
          <div className={`${styles.confirmIcon} ${!isDanger ? styles.confirmIconWarning : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h4 id="confirm-modal-title" className={styles.confirmTitle}>{state.title}</h4>
          </div>
        </div>
        <p className={styles.confirmDesc}>{state.desc}</p>
        <div className={styles.confirmActions}>
          <button
            type="button"
            onClick={onClose}
            className={styles.confirmCancelBtn}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={async () => {
              if (state.onConfirm) await state.onConfirm();
              onClose();
            }}
            className={`${styles.confirmSubmitBtn} ${!isDanger ? styles.confirmSubmitBtnPrimary : ''}`}
          >
            {state.confirmText || 'Hapus Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
