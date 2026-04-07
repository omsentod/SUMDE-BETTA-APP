'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Load cart from localStorage
    useEffect(() => {
        const savedCart = localStorage.getItem('sumde-cart');
        if (savedCart) setCart(JSON.parse(savedCart));
    }, []);

    const toggleCart = () => setIsCartOpen(!isCartOpen);

    // Save cart to localStorage
    useEffect(() => {
        localStorage.setItem('sumde-cart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = (product) => {
        setCart((prev) => {
            const exists = prev.find((item) => item.id === product.id);
            if (exists) {
                return prev.map((item) =>
                    item.id === product.id ? { ...item, quantity: (item.quantity || 1) + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setIsCartOpen(true);
    };

    const updateQuantity = (id, delta) => {
        setCart((prev) => {
            return prev.map((item) => {
                if (item.id === id) {
                    const newQty = (item.quantity || 1) + delta;
                    return { ...item, quantity: newQty > 0 ? newQty : 1 };
                }
                return item;
            });
        });
    };

    const removeFromCart = (id) => {
        setCart((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => setCart([]);

    const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
    const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart, total, itemCount, isCartOpen, toggleCart }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    return useContext(CartContext);
}
