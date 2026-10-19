'use client';

import React from 'react';
import styles from './ToastContainer.module.css';

function ToastIcon({ type }) {
    if (type === 'success') {
        return (
            <svg className={styles.iconSuccess} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        );
    }
    if (type === 'error') {
        return (
            <svg className={styles.iconError} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        );
    }
    if (type === 'warning') {
        return (
            <svg className={styles.iconWarning} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        );
    }
    return (
        <svg className={styles.iconInfo} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    );
}

export default function ToastContainer({ toasts, onRemove }) {
    if (!toasts || toasts.length === 0) return null;

    return (
        <div className={styles.toastViewport} role="region" aria-label="Notifikasi" aria-live="polite">
            {toasts.map((item) => (
                <div
                    key={item.id}
                    className={`${styles.toastCard} ${styles[`toast_${item.type}`] || ''}`}
                    role="alert"
                >
                    <div className={styles.iconArea}>
                        <ToastIcon type={item.type} />
                    </div>
                    <div className={styles.toastBody}>
                        {item.title && <div className={styles.toastTitle}>{item.title}</div>}
                        <div className={styles.toastMessage}>{item.message}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className={styles.closeBtn}
                        aria-label="Tutup"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}
