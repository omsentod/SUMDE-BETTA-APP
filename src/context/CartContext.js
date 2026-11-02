'use client';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getEffectiveUnitPrice } from '@/lib/wholesale';

const CartContext = createContext();

// "Beli Sekarang" cuma boleh hidup selama satu sesi checkout wajar — bukan
// selamanya. Tanpa ini, directCheckoutItem yang ditinggal begitu saja (mis.
// user klik Beli Sekarang lalu kabur sebelum bayar) nyangkut di localStorage
// dan MEMBAJAK checkout berikutnya: karena ia selalu menang atas cart asli
// (lihat checkoutItems di bawah), refresh /payment kapan pun bisa tiba-tiba
// menampilkan produk lama itu sebagai "default" — termasuk saat order
// beneran dikirim ke server. TTL disamakan dengan payment_due_date DOKU (60
// menit, lihat createCheckoutSession di src/lib/doku.js) — kalau sesi DOKU
// sendiri sudah pasti expired, niat Beli Sekarang di client juga tidak masuk
// akal bertahan lebih lama dari itu.
const BUY_NOW_TTL_MS = 60 * 60 * 1000;

/**
 * Rekalkulasi harga tiap item di keranjang dengan cross-variant pooling.
 * Jika ada beberapa varian dari produk yang sama (misal 5 Male + 5 Female = 10 ekor),
 * kuantitasnya diakumulasikan untuk memeriksa kelayakan tier partai (wholesale).
 */
export function recalculateCartItems(items) {
    if (!Array.isArray(items) || items.length === 0) return items;

    // 1. Akumulasi total kuantitas per productId untuk item yang sedang aktif (checked !== false)
    const checkedPooledQtyById = {};
    for (const item of items) {
        if (!item?.id || item.checked === false) continue;
        checkedPooledQtyById[item.id] = (checkedPooledQtyById[item.id] || 0) + (item.quantity || 1);
    }

    return items.map((item) => {
        if (!item || !item.isWholesale) return item;

        const isChecked = item.checked !== false;
        const pooledQty = isChecked
            ? (checkedPooledQtyById[item.id] || item.quantity || 1)
            : (item.quantity || 1);

        const productBasePrice = item.productPrice ?? item.regularPrice ?? item.basePrice ?? item.price;
        const variantBasePrice = item.basePrice ?? productBasePrice;

        const effectivePrice = getEffectiveUnitPrice(
            { ...item, price: productBasePrice },
            { price: variantBasePrice },
            pooledQty
        );

        return {
            ...item,
            price: effectivePrice,
        };
    });
}

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
            // Legacy entries (migrated pre-TTL, no _buyNowAt) dan entry yang
            // sudah lewat TTL dianggap basi — buang supaya tidak membajak
            // checkout session yang sedang berjalan sekarang.
            if (initialDirect && Date.now() - (initialDirect._buyNowAt || 0) > BUY_NOW_TTL_MS) {
                initialDirect = null;
                localStorage.removeItem(directKey);
            }
        } catch {
            localStorage.removeItem(directKey);
        }

        setCart(recalculateCartItems(initialCart));
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

    const addToCart = useCallback((product, qty = 1) => {
        const addedQty = typeof qty === 'number' && qty > 0 ? qty : (product?.quantity || 1);
        const basePrice = product.basePrice ?? product.regularPrice ?? product.price;
        const productPrice = product.productPrice ?? product.price ?? basePrice;
        setCart((prev) => {
            const exists = prev.find((item) => item.id === product.id && item.selectedSize === product.selectedSize);
            let nextCart;
            if (exists) {
                nextCart = prev.map((item) => {
                    if (item.id === product.id && item.selectedSize === product.selectedSize) {
                        const newQty = (item.quantity || 1) + addedQty;
                        return { ...item, quantity: newQty, checked: true };
                    }
                    return item;
                });
            } else {
                nextCart = [...prev, { ...product, basePrice, productPrice, quantity: addedQty, checked: true }];
            }
            return recalculateCartItems(nextCart);
        });
        setIsCartOpen(true);
    }, []);

    const buyNow = useCallback((product, qty = 1) => {
        const buyQty = typeof qty === 'number' && qty > 0 ? qty : (product?.quantity || 1);
        const basePrice = product.basePrice ?? product.regularPrice ?? product.price;
        const productPrice = product.productPrice ?? product.price ?? basePrice;
        const itemPrice = getEffectiveUnitPrice(
            { ...product, price: productPrice },
            { price: basePrice },
            buyQty
        );
        setDirectCheckoutItem({
            ...product,
            productPrice,
            basePrice,
            price: itemPrice,
            quantity: buyQty,
            checked: true,
            _buyNowAt: Date.now(),
        });
    }, []);

    const toggleItemCheck = useCallback((id, selectedSize) => {
        setCart((prev) => {
            const nextCart = prev.map((item) =>
                (item.id === id && item.selectedSize === selectedSize)
                    ? { ...item, checked: item.checked === false ? true : false }
                    : item
            );
            return recalculateCartItems(nextCart);
        });
    }, []);

    // Bulk action: flip every item's checked flag based on current all-checked state.
    // If everything is already checked, uncheck all; otherwise check all.
    const toggleAllChecked = useCallback(() => {
        setCart((prev) => {
            if (prev.length === 0) return prev;
            const allChecked = prev.every((item) => item.checked !== false);
            const nextCart = prev.map((item) => ({ ...item, checked: !allChecked }));
            return recalculateCartItems(nextCart);
        });
    }, []);

    // Bulk action: remove every item whose checkbox is currently on.
    const removeCheckedItems = useCallback(() => {
        setCart((prev) => {
            const nextCart = prev.filter((item) => item.checked === false);
            return recalculateCartItems(nextCart);
        });
    }, []);

    const updateQuantity = useCallback((id, delta, selectedSize) => {
        setDirectCheckoutItem((prev) => {
            if (prev && prev.id === id && prev.selectedSize === selectedSize) {
                const newQty = Math.max(1, (prev.quantity || 1) + delta);
                const productPrice = prev.productPrice ?? prev.price;
                const basePrice = prev.basePrice ?? productPrice;
                const newPrice = getEffectiveUnitPrice(
                    { ...prev, price: productPrice },
                    { price: basePrice },
                    newQty
                );
                return { ...prev, quantity: newQty, price: newPrice };
            }
            return prev;
        });
        setCart((prev) => {
            const nextCart = prev.map((item) => {
                if (item.id === id && item.selectedSize === selectedSize) {
                    const newQty = Math.max(1, (item.quantity || 1) + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            });
            return recalculateCartItems(nextCart);
        });
    }, []);

    const setQuantity = useCallback((id, newQty, selectedSize) => {
        const targetQty = Math.max(1, parseInt(newQty, 10) || 1);
        setDirectCheckoutItem((prev) => {
            if (prev && prev.id === id && prev.selectedSize === selectedSize) {
                const productPrice = prev.productPrice ?? prev.price;
                const basePrice = prev.basePrice ?? productPrice;
                const newPrice = getEffectiveUnitPrice(
                    { ...prev, price: productPrice },
                    { price: basePrice },
                    targetQty
                );
                return { ...prev, quantity: targetQty, price: newPrice };
            }
            return prev;
        });
        setCart((prev) => {
            const nextCart = prev.map((item) => {
                if (item.id === id && item.selectedSize === selectedSize) {
                    return { ...item, quantity: targetQty };
                }
                return item;
            });
            return recalculateCartItems(nextCart);
        });
    }, []);

    const removeFromCart = useCallback((id, selectedSize) => {
        setDirectCheckoutItem((prev) =>
            (prev && prev.id === id && prev.selectedSize === selectedSize) ? null : prev
        );
        setCart((prev) => {
            const nextCart = prev.filter((item) => !(item.id === id && item.selectedSize === selectedSize));
            return recalculateCartItems(nextCart);
        });
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

    const checkedCount = useMemo(
        () => cart.filter((i) => i.checked !== false).length,
        [cart]
    );

    const allChecked = useMemo(
        () => cart.length > 0 && cart.every((i) => i.checked !== false),
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
        toggleAllChecked,
        removeCheckedItems,
        updateQuantity,
        setQuantity,
        removeFromCart,
        clearCart,
        clearCheckout,
        total,
        itemCount,
        cartCheckedTotal,
        checkedCount,
        allChecked,
        isCartOpen,
        toggleCart,
        directCheckoutItem,
        setDirectCheckoutItem,
        checkoutItems,
        checkoutTotal,
        checkoutCount,
    }), [
        cart, directCheckoutItem, isCartOpen,
        total, itemCount, cartCheckedTotal, checkedCount, allChecked,
        checkoutItems, checkoutTotal, checkoutCount,
        addToCart, buyNow, toggleItemCheck, toggleAllChecked, removeCheckedItems,
        updateQuantity, setQuantity, removeFromCart,
        clearCart, clearCheckout, toggleCart,
    ]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    return useContext(CartContext);
}
