'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const AuthContext = createContext();

// Helper to notify other open browser tabs of session state mutations
function broadcastAuthChange() {
    if (typeof window === 'undefined') return;
    try {
        if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('sumde_auth_channel');
            bc.postMessage({ type: 'AUTH_STATE_CHANGED', timestamp: Date.now() });
            bc.close();
        }
        localStorage.setItem('sumde_auth_sync_event', String(Date.now()));
    } catch {
        // BroadcastChannel / localStorage access may be blocked in some private browsing modes
    }
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const refreshInFlightRef = React.useRef(false);

    const refreshSession = useCallback(async () => {
        if (refreshInFlightRef.current) return;
        refreshInFlightRef.current = true;
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
            const res = await fetch('/api/auth/me', {
                signal: controller?.signal
            });
            if (timeoutId) clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                const nextUser = data.user || null;
                // Cegah cascading re-render & re-fetch jika identitas user & role tidak berubah
                setCurrentUser((prev) => {
                    if (!prev && !nextUser) return null;
                    if (prev && nextUser && prev.id === nextUser.id && prev.role === nextUser.role) {
                        return prev;
                    }
                    return nextUser;
                });
            } else {
                setCurrentUser(null);
            }
        } catch {
            // Network failure or abort — retain current state
        } finally {
            refreshInFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server session bootstrap
        refreshSession().finally(() => {
            if (mounted) setIsLoading(false);
        });
        return () => {
            mounted = false;
        };
    }, [refreshSession]);

    // Cross-tab synchronization: gunakan BroadcastChannel jika didukung,
    // fallback ke storage event hanya jika BroadcastChannel tidak ada (mencegah double-fetch di Chrome).
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let bc = null;
        let handleStorage = null;

        if ('BroadcastChannel' in window) {
            try {
                bc = new BroadcastChannel('sumde_auth_channel');
                bc.onmessage = (event) => {
                    if (event.data?.type === 'AUTH_STATE_CHANGED') {
                        refreshSession();
                    }
                };
            } catch {
                // ignore
            }
        } else {
            handleStorage = (e) => {
                if (e.key === 'sumde_auth_sync_event') {
                    refreshSession();
                }
            };
            window.addEventListener('storage', handleStorage);
        }

        return () => {
            if (bc) {
                try { bc.close(); } catch {}
            }
            if (handleStorage) {
                window.removeEventListener('storage', handleStorage);
            }
        };
    }, [refreshSession]);

    const login = useCallback(async (email, password) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            const err = new Error(data.error || 'Login gagal.');
            // Preserve backend code/email supaya UI login bisa redirect ke
            // /verify-email saat EMAIL_NOT_VERIFIED (bukan hanya show error).
            if (data.code) err.code = data.code;
            if (data.email) err.email = data.email;
            throw err;
        }
        setCurrentUser(data);
        broadcastAuthChange();
        return data;
    }, []);

    const register = useCallback(async (name, email, password) => {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Registrasi gagal.');
        broadcastAuthChange();
        return data;
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // ignore network errors on logout
        }
        setCurrentUser(null);
        broadcastAuthChange();
    }, []);

    // Reads currentUser via functional-update-safe accessor. Since the caller
    // usually needs currentUser (e.g. to send id), we keep it as a dep.
    const updateUserProfile = useCallback(async (profileData) => {
        if (!currentUser) return;
        const response = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentUser.id, ...profileData }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memperbarui profil.');
        const updated = { ...currentUser, ...data };
        setCurrentUser(updated);
        return updated;
    }, [currentUser]);

    const fetchMyOrders = useCallback(async () => {
        // Server scopes orders by session, so no id needs to be passed
        const res = await fetch('/api/orders');
        if (res.ok) return res.json();
        return [];
    }, []);

    const fetchMyAddresses = useCallback(async () => {
        const res = await fetch('/api/addresses');
        if (res.ok) return res.json();
        return [];
    }, []);

    const createAddress = useCallback(async (data) => {
        const res = await fetch('/api/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menyimpan alamat.');
        return result;
    }, []);

    const updateAddress = useCallback(async (id, data) => {
        const res = await fetch(`/api/addresses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal memperbarui alamat.');
        return result;
    }, []);

    const deleteAddress = useCallback(async (id) => {
        const res = await fetch(`/api/addresses/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal menghapus alamat.');
    }, []);

    const value = useMemo(() => ({
        currentUser, isLoading,
        setCurrentUser, // Di-expose untuk verify-otp: setelah OTP valid, session
                        // cookie sudah di-set server-side + endpoint balikin user data.
                        // Update state langsung supaya /customer/dashboard tidak
                        // race dengan /api/auth/me.
        login, register, logout,
        updateUserProfile,
        fetchMyOrders, fetchMyAddresses,
        createAddress, updateAddress, deleteAddress,
    }), [
        currentUser, isLoading,
        login, register, logout,
        updateUserProfile,
        fetchMyOrders, fetchMyAddresses,
        createAddress, updateAddress, deleteAddress,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
