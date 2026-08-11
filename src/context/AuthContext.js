'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Identity comes from the httpOnly session cookie, resolved server-side
    // via /api/auth/me — never from localStorage (that used to be spoofable).
    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => setCurrentUser(data.user || null))
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, []);

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
        return data;
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // ignore network errors on logout
        }
        setCurrentUser(null);
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
