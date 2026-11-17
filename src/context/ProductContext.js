'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';

const ProductContext = createContext();

const PRODUCTS_CACHE_KEY = 'sumde_products_cache_v1';

function getStoredProducts() {
    if (typeof window === 'undefined') return [];
    try {
        const item = sessionStorage.getItem(PRODUCTS_CACHE_KEY);
        if (!item) return [];
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch {
        // ignore
    }
    return [];
}

function saveStoredProducts(list) {
    if (typeof window === 'undefined') return;
    try {
        if (Array.isArray(list)) {
            sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(list));
        }
    } catch {
        // ignore quota limits
    }
}

export function ProductProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const activeControllerRef = useRef(null);

    const updateProductsAndCache = useCallback((updater) => {
        setProducts((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            saveStoredProducts(next);
            return next;
        });
    }, []);

    const fetchProducts = useCallback(async ({ showLoading = true } = {}) => {
        if (activeControllerRef.current) {
            activeControllerRef.current.abort();
        }
        const controller = new AbortController();
        activeControllerRef.current = controller;

        if (showLoading) setIsLoading(true);
        try {
            const res = await fetch('/api/products', {
                cache: 'no-store',
                signal: controller.signal,
            });
            if (res.ok) {
                const data = await res.json();
                updateProductsAndCache(data);
            }
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.error('Gagal mengambil data produk:', error);
            }
        } finally {
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;
                setIsLoading(false);
            }
        }
    }, [updateProductsAndCache]);

    useEffect(() => {
        // 1. Instant hydration dari cache sesi lokal (mencegah FOUC / halaman kosong saat refresh / navigasi)
        const cached = getStoredProducts();
        if (cached.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate cached products before network
            setProducts(cached);
            setIsLoading(false);
        }

        // 2. Background revalidation dengan AbortController
        const controller = new AbortController();
        activeControllerRef.current = controller;

        const load = async () => {
            try {
                const res = await fetch('/api/products', {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                if (res.ok) {
                    const data = await res.json();
                    updateProductsAndCache(data);
                }
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    console.error('Gagal mengambil data produk:', error);
                }
            } finally {
                if (activeControllerRef.current === controller) {
                    activeControllerRef.current = null;
                    setIsLoading(false);
                }
            }
        };

        load();

        let lastFetchTime = Date.now();
        const handleFocus = () => {
            if (Date.now() - lastFetchTime > 60_000) {
                lastFetchTime = Date.now();
                fetchProducts({ showLoading: false });
            }
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            controller.abort();
            window.removeEventListener('focus', handleFocus);
        };
    }, [updateProductsAndCache, fetchProducts]);

    const addProduct = useCallback(async (productData) => {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menambahkan produk.');
        updateProductsAndCache((prev) => [data, ...prev]);
        return data;
    }, [updateProductsAndCache]);

    const updateProduct = useCallback(async (id, productData) => {
        const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengubah produk.');
        updateProductsAndCache((prev) => prev.map((p) => (p.id === id ? data : p)));
        return data;
    }, [updateProductsAndCache]);

    const deleteProduct = useCallback(async (id, { permanent = false } = {}) => {
        const url = `/api/products/${id}${permanent ? '?permanent=true' : ''}`;
        const res = await fetch(url, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menghapus produk.');
        // Produk yang dihapus dikeluarkan dari daftar produk aktif toko.
        updateProductsAndCache((prev) => prev.filter((p) => p.id !== id));
        return data;
    }, [updateProductsAndCache]);

    const value = useMemo(() => ({
        products, isLoading, fetchProducts,
        addProduct, updateProduct, deleteProduct,
    }), [products, isLoading, fetchProducts, addProduct, updateProduct, deleteProduct]);

    return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProducts() {
    return useContext(ProductContext);
}
