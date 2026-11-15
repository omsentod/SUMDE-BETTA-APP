'use client';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

const VipContext = createContext({
    isVip: false,
    setIsVip: () => {},
});

export function VipProvider({ children }) {
    const pathname = usePathname() || '';
    const [isVip, setVipState] = useState(false);

    // Auto-reset jika rute berpindah keluar dari area produk
    useEffect(() => {
        if (!pathname.startsWith('/produk')) {
            setVipState(false);
        }
    }, [pathname]);

    const setIsVip = useCallback((value) => {
        setVipState(Boolean(value));
    }, []);

    // Sinkronkan attribute data-vip dan class ke <html> dan <body> untuk styling global
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (isVip) {
            document.documentElement.setAttribute('data-vip', 'true');
            document.body.classList.add('vip-mode-active');
        } else {
            document.documentElement.removeAttribute('data-vip');
            document.body.classList.remove('vip-mode-active');
        }
    }, [isVip]);

    const contextValue = useMemo(() => ({
        isVip,
        setIsVip,
    }), [isVip, setIsVip]);

    return (
        <VipContext.Provider value={contextValue}>
            {children}
        </VipContext.Provider>
    );
}

export function useVip() {
    return useContext(VipContext);
}
