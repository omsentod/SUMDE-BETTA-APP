'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
    const [cart, setCart] = useState([]);
    const [directCheckoutItem, setDirectCheckoutItem] = useState(null);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Load cart & directCheckout from localStorage
    useEffect(() => {
        const savedCart = localStorage.getItem('sumde-cart');
        if (savedCart) setCart(JSON.parse(savedCart));

        const savedDirect = localStorage.getItem('sumde-direct-checkout');
        if (savedDirect) setDirectCheckoutItem(JSON.parse(savedDirect));
    }, []);

    const toggleCart = () => setIsCartOpen(!isCartOpen);

    // Save cart to localStorage
    useEffect(() => {
        localStorage.setItem('sumde-cart', JSON.stringify(cart));
    }, [cart]);

    // Save directCheckout to localStorage
    useEffect(() => {
        if (directCheckoutItem) {
            localStorage.setItem('sumde-direct-checkout', JSON.stringify(directCheckoutItem));
        } else {
            localStorage.removeItem('sumde-direct-checkout');
        }
    }, [directCheckoutItem]);

    const addToCart = (product) => {
        setCart((prev) => {
            const exists = prev.find((item) => item.id === product.id);
            if (exists) {
                return prev.map((item) =>
                    item.id === product.id ? { ...item, quantity: (item.quantity || 1) + 1, checked: true } : item
                );
            }
            return [...prev, { ...product, quantity: 1, checked: true }];
        });
        setIsCartOpen(true);
    };

    const buyNow = (product) => {
        const item = { ...product, quantity: 1, checked: true };
        setDirectCheckoutItem(item);
    };

    const toggleItemCheck = (id) => {
        setCart((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, checked: item.checked === false ? true : false } : item
            )
        );
    };

    const updateQuantity = (id, delta) => {
        if (directCheckoutItem && directCheckoutItem.id === id) {
            setDirectCheckoutItem((prev) => {
                const newQty = (prev.quantity || 1) + delta;
                return { ...prev, quantity: newQty > 0 ? newQty : 1 };
            });
            return;
        }
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
        if (directCheckoutItem && directCheckoutItem.id === id) {
            setDirectCheckoutItem(null);
            return;
        }
        setCart((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => setCart([]);

    const clearCheckout = () => {
        if (directCheckoutItem) {
            setDirectCheckoutItem(null);
        } else {
            // Remove only the items that were checked out (checked = true)
            setCart((prev) => prev.filter((item) => item.checked === false));
        }
    };

    // Main Cart Totals
    const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
    const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

    // Selected Checkout Totals & Items (Shopee style)
    const checkoutItems = directCheckoutItem 
        ? [directCheckoutItem] 
        : cart.filter((item) => item.checked !== false);

    const checkoutTotal = directCheckoutItem
        ? directCheckoutItem.price * (directCheckoutItem.quantity || 1)
        : checkoutItems.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

    const checkoutCount = directCheckoutItem
        ? (directCheckoutItem.quantity || 1)
        : checkoutItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

    return (
        <CartContext.Provider value={{ 
            cart, 
            addToCart, 
            buyNow,
            toggleItemCheck,
            updateQuantity, 
            removeFromCart, 
            clearCart, 
            clearCheckout,
            total, 
            itemCount, 
            isCartOpen, 
            toggleCart,
            directCheckoutItem,
            setDirectCheckoutItem,
            checkoutItems,
            checkoutTotal,
            checkoutCount
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    return useContext(CartContext);
}
