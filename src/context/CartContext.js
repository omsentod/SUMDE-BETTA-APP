'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
    const [cart, setCart] = useState([]);
    const [directCheckoutItem, setDirectCheckoutItem] = useState(null);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Load cart & directCheckout from localStorage on mount.
    // We intentionally hydrate here (not via a lazy useState initializer) so the
    // first client render matches the server-rendered HTML and avoids a hydration
    // mismatch. This is a legitimate one-time sync from an external store, so the
    // "setState in effect" rule is disabled just for these hydration lines.
    useEffect(() => {
        try {
            const savedCart = localStorage.getItem('sumde-cart');
            // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe localStorage hydration
            if (savedCart) setCart(JSON.parse(savedCart));
        } catch {
            localStorage.removeItem('sumde-cart');
        }

        try {
            const savedDirect = localStorage.getItem('sumde-direct-checkout');
            if (savedDirect) setDirectCheckoutItem(JSON.parse(savedDirect));
        } catch {
            localStorage.removeItem('sumde-direct-checkout');
        }
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
    };

    const buyNow = (product) => {
        const item = { ...product, quantity: 1, checked: true };
        setDirectCheckoutItem(item);
    };

    const toggleItemCheck = (id, selectedSize) => {
        setCart((prev) =>
            prev.map((item) =>
                (item.id === id && item.selectedSize === selectedSize) 
                    ? { ...item, checked: item.checked === false ? true : false } 
                    : item
            )
        );
    };

    const updateQuantity = (id, delta, selectedSize) => {
        if (directCheckoutItem && directCheckoutItem.id === id && directCheckoutItem.selectedSize === selectedSize) {
            setDirectCheckoutItem((prev) => {
                const newQty = (prev.quantity || 1) + delta;
                return { ...prev, quantity: newQty > 0 ? newQty : 1 };
            });
            return;
        }
        setCart((prev) => {
            return prev.map((item) => {
                if (item.id === id && item.selectedSize === selectedSize) {
                    const newQty = (item.quantity || 1) + delta;
                    return { ...item, quantity: newQty > 0 ? newQty : 1 };
                }
                return item;
            });
        });
    };

    const removeFromCart = (id, selectedSize) => {
        if (directCheckoutItem && directCheckoutItem.id === id && directCheckoutItem.selectedSize === selectedSize) {
            setDirectCheckoutItem(null);
            return;
        }
        setCart((prev) => prev.filter((item) => !(item.id === id && item.selectedSize === selectedSize)));
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
    
    // Checked Cart Totals (ignoring direct checkout)
    const cartCheckedTotal = cart
        .filter((item) => item.checked !== false)
        .reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

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
            cartCheckedTotal,
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
