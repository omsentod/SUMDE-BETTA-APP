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
        success: (message, title) => addToast({ message, type: 'success', title: title || 'Berhasil' }),
        error: (message, title) => addToast({ message, type: 'error', title: title || 'Perhatian' }),
        warning: (message, title) => addToast({ message, type: 'warning', title: title || 'Peringatan' }),
        info: (message, title) => addToast({ message, type: 'info', title: title || 'Informasi' }),
        dismiss: removeToast,
    };

    const confirmDialog = useCallback(({
        title = 'Konfirmasi Tindakan',
        message = 'Apakah Anda yakin ingin melanjutkan?',
        confirmText = 'Ya, Lanjutkan',
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

    const handleConfirmClose = (result) => {
        if (confirmState?.resolve) {
            confirmState.resolve(result);
        }
        setConfirmState(null);
    };

    // Intercept window.alert & window.confirm globally so system responses ("sumdebetta. says")
    // are replaced with our luxury UI automatically across all existing codebase
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const originalAlert = window.alert;

        window.alert = (msg) => {
            const str = String(msg ?? '');
            if (/berhasil|sukses|success|tersimpan|selesai/i.test(str)) {
                toast.success(str);
            } else if (/gagal|error|salah|wajib|tidak boleh|harus|belum/i.test(str)) {
                toast.error(str);
            } else {
                toast.info(str);
            }
        };

        return () => {
            window.alert = originalAlert;
        };
    }, [addToast]);

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
