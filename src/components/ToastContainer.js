'use client';

import React from 'react';
import styles from './ToastContainer.module.css';

function ToastIcon({ type }) {
    if (type === 'success') {
        return (
            <div className={`${styles.iconWrapper} ${styles.iconSuccess}`} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                </svg>
            </div>
        );
    }
    if (type === 'error') {
        return (
            <div className={`${styles.iconWrapper} ${styles.iconError}`} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
        );
    }
    if (type === 'warning') {
        return (
            <div className={`${styles.iconWrapper} ${styles.iconWarning}`} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </div>
        );
    }
    return (
        <div className={`${styles.iconWrapper} ${styles.iconInfo}`} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
        </div>
    );
}

export default function ToastContainer({ toasts, onRemove }) {
    if (!toasts || toasts.length === 0) return null;

    return (
        <div className={styles.toastViewport} role="region" aria-label="Notifikasi Sistem" aria-live="polite">
            {toasts.map((item) => (
                <div
                    key={item.id}
                    className={`${styles.toastCard} ${styles[`toast_${item.type}`] || styles.toast_info}`}
                    role="alert"
                >
                    <ToastIcon type={item.type} />
                    <div className={styles.toastContent}>
                        <div className={styles.toastHeader}>
                            <span className={styles.toastBadge}>{item.title}</span>
                            <span className={styles.systemTag}>SUMDE BETTA</span>
                        </div>
                        <p className={styles.toastMessage}>{item.message}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className={styles.closeBtn}
                        aria-label="Tutup Notifikasi"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                    {item.duration > 0 && (
                        <div
                            className={styles.progressBar}
                            style={{ animationDuration: `${item.duration}ms` }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
