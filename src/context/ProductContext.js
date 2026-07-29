'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const ProductContext = createContext();

export function ProductProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProducts = useCallback(async ({ showLoading = true } = {}) => {
        if (showLoading) setIsLoading(true);
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (error) {
            console.error('Gagal mengambil data produk:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/products');
                if (res.ok) {
                    const data = await res.json();
                    if (!cancelled) setProducts(data);
                }
            } catch (error) {
                console.error('Gagal mengambil data produk:', error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const addProduct = useCallback(async (productData) => {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menambahkan produk.');
        setProducts((prev) => [data, ...prev]);
        return data;
    }, []);

    const updateProduct = useCallback(async (id, productData) => {
        const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengubah produk.');
        setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
        return data;
    }, []);

    const deleteProduct = useCallback(async (id) => {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menghapus produk.');
        // The endpoint may soft-delete (returns { archived: true }) — in that
        // case flip the local flag instead of removing the row, so admin can
        // still see + restore it.
        setProducts((prev) =>
            data.archived
                ? prev.map((p) => (p.id === id ? { ...p, isArchived: true } : p))
                : prev.filter((p) => p.id !== id)
        );
        return data;
    }, []);

    const value = useMemo(() => ({
        products, isLoading, fetchProducts,
        addProduct, updateProduct, deleteProduct,
    }), [products, isLoading, fetchProducts, addProduct, updateProduct, deleteProduct]);

    return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProducts() {
    return useContext(ProductContext);
}
