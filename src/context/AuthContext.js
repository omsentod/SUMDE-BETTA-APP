'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('sumde-current-user');
        if (savedUser) {
            setCurrentUser(JSON.parse(savedUser));
        }
        setIsLoading(false);
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

        setCurrentUser(data);
        localStorage.setItem('sumde-current-user', JSON.stringify(data));
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

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('sumde-current-user');
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

        // Keep the role from previous currentUser state if not returned
        const updated = { ...currentUser, ...data };
        setCurrentUser(updated);
        localStorage.setItem('sumde-current-user', JSON.stringify(updated));
        return updated;
    };

    const fetchMyOrders = async () => {
        if (!currentUser) return [];
        const res = await fetch('/api/orders');
        if (res.ok) {
            const allOrders = await res.json();
            return allOrders.filter(o => o.userId === currentUser.id);
        }
        return [];
    };

    const fetchMyAddresses = async () => {
        if (!currentUser) return [];
        const res = await fetch(`/api/addresses?userId=${currentUser.id}`);
        if (res.ok) return res.json();
        return [];
    };

    const createAddress = async (data) => {
        const res = await fetch('/api/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, ...data })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menyimpan alamat.');
        return result;
    };

    const updateAddress = async (id, data) => {
        const res = await fetch(`/api/addresses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, ...data })
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
