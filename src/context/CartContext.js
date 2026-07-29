'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const CartContext = createContext();

export function CartProvider({ children }) {
    const { currentUser } = useAuth();
    const userId = currentUser?.id || 'guest';

    const [activeUserId, setActiveUserId] = useState(null);
    const [cart, setCart] = useState([]);
    const [directCheckoutItem, setDirectCheckoutItem] = useState(null);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Hydrate cart from localStorage whenever the active user changes.
    // Includes migration from legacy global 'sumde-cart' key if guest cart is empty.
    useEffect(() => {
        let initialCart = [];
        let initialDirect = null;

        const cartKey = `sumde-cart-${userId}`;
        const directKey = `sumde-direct-${userId}`;

        try {
            const savedCart = localStorage.getItem(cartKey);
            if (savedCart) {
                initialCart = JSON.parse(savedCart);
            } else if (userId === 'guest') {
                // Backward compatibility: fallback to legacy key for guest
                const legacyCart = localStorage.getItem('sumde-cart');
                if (legacyCart) {
                    initialCart = JSON.parse(legacyCart);
                    localStorage.setItem(cartKey, legacyCart);
                }
            }
        } catch {
            localStorage.removeItem(cartKey);
        }

        try {
            const savedDirect = localStorage.getItem(directKey);
            if (savedDirect) {
                initialDirect = JSON.parse(savedDirect);
            } else if (userId === 'guest') {
                const legacyDirect = localStorage.getItem('sumde-direct-checkout');
                if (legacyDirect) {
                    initialDirect = JSON.parse(legacyDirect);
                    localStorage.setItem(directKey, legacyDirect);
                }
            }
        } catch {
            localStorage.removeItem(directKey);
        }

        setCart(initialCart);
        setDirectCheckoutItem(initialDirect);
        setActiveUserId(userId);
    }, [userId]);

    // Persist cart changes ONLY when activeUserId matches the current userId (hydration completed)
    useEffect(() => {
        if (activeUserId !== userId) return;
        try {
            localStorage.setItem(`sumde-cart-${userId}`, JSON.stringify(cart));
        } catch {
            // Ignore quota errors
        }
    }, [cart, userId, activeUserId]);

    // Persist directCheckout changes ONLY when activeUserId matches current userId
    useEffect(() => {
        if (activeUserId !== userId) return;
        try {
            const directKey = `sumde-direct-${userId}`;
            if (directCheckoutItem) {
                localStorage.setItem(directKey, JSON.stringify(directCheckoutItem));
            } else {
                localStorage.removeItem(directKey);
            }
        } catch {
            // Ignore storage errors
        }
    }, [directCheckoutItem, userId, activeUserId]);

    // ---- Handlers: all stable across renders (no state in deps; use setter
    //      functional-updates to read current state safely). ----

    const toggleCart = useCallback(() => setIsCartOpen((p) => !p), []);

    const addToCart = useCallback((product) => {
        setCart((prev) => {
            const exists = prev.find((item) => item.id === product.id && item.selectedSize === product.selectedSize);
            if (exists) {
                return prev.map((item) =>
                    (item.id === product.id && item.selectedSize === product.selectedSize)
                        ? { ...item, quantity: (item.quantity || 1) + 1, checked: true }
                        : item
                );
            }
            return [...prev, { ...product, quantity: 1, checked: true }];
        });
        setIsCartOpen(true);
    }, []);

    const buyNow = useCallback((product) => {
        setDirectCheckoutItem({ ...product, quantity: 1, checked: true });
    }, []);

    const toggleItemCheck = useCallback((id, selectedSize) => {
        setCart((prev) =>
            prev.map((item) =>
                (item.id === id && item.selectedSize === selectedSize)
                    ? { ...item, checked: item.checked === false ? true : false }
                    : item
            )
        );
    }, []);

    const updateQuantity = useCallback((id, delta, selectedSize) => {
        // Prefer directCheckoutItem when it matches; otherwise mutate cart.
        // We read state via the setter's `prev` so the handler stays stable.
        setDirectCheckoutItem((prev) => {
            if (prev && prev.id === id && prev.selectedSize === selectedSize) {
                const newQty = (prev.quantity || 1) + delta;
                return { ...prev, quantity: newQty > 0 ? newQty : 1 };
            }
            return prev;
        });
        setCart((prev) =>
            prev.map((item) => {
                if (item.id === id && item.selectedSize === selectedSize) {
                    const newQty = (item.quantity || 1) + delta;
                    return { ...item, quantity: newQty > 0 ? newQty : 1 };
                }
                return item;
            })
        );
    }, []);

    const removeFromCart = useCallback((id, selectedSize) => {
        setDirectCheckoutItem((prev) =>
            (prev && prev.id === id && prev.selectedSize === selectedSize) ? null : prev
        );
        setCart((prev) => prev.filter((item) => !(item.id === id && item.selectedSize === selectedSize)));
    }, []);

    const clearCart = useCallback(() => setCart([]), []);

    const clearCheckout = useCallback(() => {
        setDirectCheckoutItem((prev) => (prev ? null : prev));
        setCart((prev) => prev.filter((item) => item.checked === false));
    }, []);

    // ---- Derived values: only recompute when their source state changes. ----

    const total = useMemo(
        () => cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0),
        [cart]
    );

    const itemCount = useMemo(
        () => cart.reduce((sum, item) => sum + (item.quantity || 1), 0),
        [cart]
    );

    const cartCheckedTotal = useMemo(
        () => cart.filter((i) => i.checked !== false)
                  .reduce((sum, item) => sum + item.price * (item.quantity || 1), 0),
        [cart]
    );

    const checkoutItems = useMemo(
        () => directCheckoutItem ? [directCheckoutItem] : cart.filter((i) => i.checked !== false),
        [cart, directCheckoutItem]
    );

    const checkoutTotal = useMemo(
        () => directCheckoutItem
            ? directCheckoutItem.price * (directCheckoutItem.quantity || 1)
            : checkoutItems.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0),
        [directCheckoutItem, checkoutItems]
    );

    const checkoutCount = useMemo(
        () => directCheckoutItem
            ? (directCheckoutItem.quantity || 1)
            : checkoutItems.reduce((sum, i) => sum + (i.quantity || 1), 0),
        [directCheckoutItem, checkoutItems]
    );

    // ---- Stable provider value — this is the fix. Without useMemo, every
    //      consumer re-renders on every parent render, which is what caused
    //      the checkout OOM (cart reference change fired the rate effect
    //      infinitely). ----
    const value = useMemo(() => ({
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
        cartCheckedTotal,
        isCartOpen,
        toggleCart,
        directCheckoutItem,
        setDirectCheckoutItem,
        checkoutItems,
        checkoutTotal,
        checkoutCount,
    }), [
        cart, directCheckoutItem, isCartOpen,
        total, itemCount, cartCheckedTotal, checkoutItems, checkoutTotal, checkoutCount,
        addToCart, buyNow, toggleItemCheck, updateQuantity, removeFromCart,
        clearCart, clearCheckout, toggleCart,
    ]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    return useContext(CartContext);
}
