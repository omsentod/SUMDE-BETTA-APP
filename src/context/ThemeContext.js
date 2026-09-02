'use client';
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('light');

    // Load persisted theme (SSR-safe: default first, hydrate on mount)
    useEffect(() => {
        // ── THEME TOGGLE DINONAKTIFKAN SEMENTARA ──────────────────────────
        // Fitur dark/light mode dimatikan sementara: app dikunci ke mode
        // terang, mengabaikan preferensi tersimpan (termasuk user yang dulu
        // menyimpan "dark"). Untuk mengaktifkan lagi: kembalikan baris
        // localStorage di bawah, hapus paksa-'light', dan uncomment tombol
        // toggle di Header.js + AdminHeader.js.
        // const savedTheme = localStorage.getItem('sumde-theme') || 'light';
        const savedTheme = 'light';
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe localStorage hydration
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('sumde-theme', next);
            return next;
        });
    }, []);

    const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
