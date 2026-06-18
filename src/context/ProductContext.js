'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const ProductContext = createContext();

export function ProductProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProducts = async () => {
        setIsLoading(true);
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
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const addProduct = async (productData) => {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Gagal menambahkan produk.');
        }
        setProducts(prev => [data, ...prev]);
        return data;
    };

    const updateProduct = async (id, productData) => {
        const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Gagal mengubah produk.');
        }
        setProducts(prev => prev.map(p => p.id === id ? data : p));
        return data;
    };

    const deleteProduct = async (id) => {
        const res = await fetch(`/api/products/${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Gagal menghapus produk.');
        }
        setProducts(prev => prev.filter(p => p.id !== id));
        return data;
    };

    return (
        <ProductContext.Provider value={{ products, isLoading, fetchProducts, addProduct, updateProduct, deleteProduct }}>
            {children}
        </ProductContext.Provider>
    );
}

export function useProducts() {
    return useContext(ProductContext);
}
