'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Identity now comes from the httpOnly session cookie, resolved server-side
    // via /api/auth/me — no longer from localStorage (which was spoofable).
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => setCurrentUser(data.user || null))
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, []);

    const login = async (email, password) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Login gagal.');
        }
        // The server set the session cookie; keep a copy of the user in state.
        setCurrentUser(data);
        return data;
    };

    const register = async (name, email, password) => {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Registrasi gagal.');
        }
        return data;
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // ignore network errors on logout
        }
        setCurrentUser(null);
    };

    const updateUserProfile = async (profileData) => {
        if (!currentUser) return;
        const response = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentUser.id, ...profileData })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Gagal memperbarui profil.');
        }

        const updated = { ...currentUser, ...data };
        setCurrentUser(updated);
        return updated;
    };

    const fetchMyOrders = async () => {
        if (!currentUser) return [];
        // The server already scopes orders to the session user.
        const res = await fetch('/api/orders');
        if (res.ok) return res.json();
        return [];
    };

    const fetchMyAddresses = async () => {
        if (!currentUser) return [];
        const res = await fetch('/api/addresses');
        if (res.ok) return res.json();
        return [];
    };

    const createAddress = async (data) => {
        const res = await fetch('/api/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menyimpan alamat.');
        return result;
    };

    const updateAddress = async (id, data) => {
        const res = await fetch(`/api/addresses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal memperbarui alamat.');
        return result;
    };

    const deleteAddress = async (id) => {
        const res = await fetch(`/api/addresses/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal menghapus alamat.');
    };

    return (
        <AuthContext.Provider value={{ currentUser, isLoading, login, register, logout, updateUserProfile, fetchMyOrders, fetchMyAddresses, createAddress, updateAddress, deleteAddress }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
