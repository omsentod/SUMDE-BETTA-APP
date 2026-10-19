'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import ToastContainer from '@/components/ToastContainer';
import ConfirmModal from '@/components/ConfirmModal';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null); // { title, message, confirmText, cancelText, isDanger, resolve }
    const toastCounter = useRef(0);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback(({ message, type = 'info', title = null, duration = 4000 }) => {
        const id = ++toastCounter.current;
        const newToast = { id, message, type, title, duration };

        setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 toasts

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
        return id;
    }, [removeToast]);

    const toast = {
        success: (message, title = null) => addToast({ message, type: 'success', title }),
        error: (message, title = null) => addToast({ message, type: 'error', title }),
        warning: (message, title = null) => addToast({ message, type: 'warning', title }),
        info: (message, title = null) => addToast({ message, type: 'info', title }),
        dismiss: removeToast,
    };

    const toastRef = useRef(toast);
    toastRef.current = toast;

    const confirmDialog = useCallback(({
        title = 'Konfirmasi',
        message = 'Apakah Anda yakin ingin melanjutkan?',
        confirmText = 'Lanjutkan',
        cancelText = 'Batal',
        isDanger = false,
    }) => {
        return new Promise((resolve) => {
            setConfirmState({
                title,
                message,
                confirmText,
                cancelText,
                isDanger,
                resolve,
            });
        });
    }, []);

    const confirmDialogRef = useRef(confirmDialog);
    confirmDialogRef.current = confirmDialog;

    const handleConfirmClose = (result) => {
        if (confirmState?.resolve) {
            confirmState.resolve(result);
        }
        setConfirmState(null);
    };

    // Intercept window.alert globally so system responses ("localhost:3000 says" / "sumdebetta.com says")
    // are replaced with our luxury UI automatically across all existing codebase
    useEffect(() => {
        if (typeof window === 'undefined') return;

        window.__sumdeToast = toastRef.current;

        window.alert = (msg) => {
            const str = String(msg ?? '');
            if (/berhasil|sukses|success|tersimpan|selesai|updated|saved/i.test(str)) {
                toastRef.current.success(str);
            } else if (/pilih|lengkapi|mohon|periksa|warning|perhatian/i.test(str)) {
                toastRef.current.warning(str);
            } else if (/gagal|error|salah|wajib|tidak boleh|harus|belum|kurang|invalid|failed/i.test(str)) {
                toastRef.current.error(str);
            } else {
                toastRef.current.info(str);
            }
        };

        window.confirm = (msg) => {
            console.warn('[SUMDE BETTA] Synchronous confirm intercepted:', msg);
            toastRef.current.warning(String(msg ?? ''), 'Konfirmasi Diperlukan');
            return true;
        };
    }, []);

    return (
        <ToastContext.Provider value={{ toast, confirmDialog }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
            {confirmState && (
                <ConfirmModal
                    {...confirmState}
                    onConfirm={() => handleConfirmClose(true)}
                    onCancel={() => handleConfirmClose(false)}
                />
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
