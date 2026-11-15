'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './TopProgressBar.module.css';

function ProgressBarInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'complete' | 'fade'
    const isFirstMount = useRef(true);
    const loadingTimeoutRef = useRef(null);

    // Route updated -> finish animation to 100% then fade out
    useEffect(() => {
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
        }

        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        setStatus('complete');
        const fadeTimer = setTimeout(() => {
            setStatus('fade');
        }, 180);

        const resetTimer = setTimeout(() => {
            setStatus('idle');
        }, 450);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(resetTimer);
        };
    }, [pathname, searchParams]);

    // Global listener: Cegah loading bar menggantung jika terjadi error runtime / ChunkLoadError
    useEffect(() => {
        const handleChunkError = (eventOrError) => {
            const error = eventOrError?.error || eventOrError?.reason || eventOrError;
            const message = error?.message || (typeof eventOrError === 'string' ? eventOrError : '');
            const isChunkError =
                error?.name === 'ChunkLoadError' ||
                /loading chunk/i.test(message) ||
                /chunkloaderror/i.test(message);

            if (isChunkError && typeof window !== 'undefined') {
                const retryKey = 'sumde_chunk_reload_cooldown';
                const lastRetry = sessionStorage.getItem(retryKey);
                const now = Date.now();
                // Cooldown 15 detik agar tidak reload berulang jika ada kendala jaringan sungguhan
                if (!lastRetry || now - parseInt(lastRetry, 10) > 15000) {
                    sessionStorage.setItem(retryKey, String(now));
                    window.location.reload();
                    return;
                }
            }

            // Jika error lain, batalkan status loading bar agar tidak stuck di layar
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
            setStatus('idle');
        };

        window.addEventListener('error', handleChunkError);
        window.addEventListener('unhandledrejection', handleChunkError);

        return () => {
            window.removeEventListener('error', handleChunkError);
            window.removeEventListener('unhandledrejection', handleChunkError);
        };
    }, []);

    // Intercept navigation link clicks globally
    useEffect(() => {
        const handleClick = (e) => {
            const anchor = e.target.closest('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href) return;

            // Ignore external links, mailto, tel, target=_blank, and hash-only links
            const isExternal =
                anchor.target === '_blank' ||
                href.startsWith('http://') ||
                href.startsWith('https://') ||
                href.startsWith('mailto:') ||
                href.startsWith('tel:');
            const isHash = href.startsWith('#');
            const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
            const isDownload = anchor.hasAttribute('download');

            if (isExternal || isHash || isModified || isDownload) return;

            // Check if navigating to the same URL
            try {
                const targetUrl = new URL(anchor.href, window.location.href);
                const currentUrl = new URL(window.location.href);

                // If origin is different or path+search is identical, skip
                if (targetUrl.origin !== currentUrl.origin) return;
                if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
                    return;
                }
            } catch {
                return;
            }

            // Immediately start loading indicator
            setStatus('loading');

            // Safety timeout: jika navigasi terhambat atau chunk macet, jangan biarkan bar ngehang selamanya
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = setTimeout(() => {
                setStatus('idle');
            }, 5000);
        };

        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('click', handleClick);
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        };
    }, []);

    if (status === 'idle') return null;

    const fillClass = [
        styles.barFill,
        status === 'loading' && styles.statusLoading,
        status === 'complete' && styles.statusComplete,
        status === 'fade' && styles.statusFade,
    ].filter(Boolean).join(' ');

    return (
        <div className={styles.barContainer} aria-hidden="true">
            <div className={fillClass}>
                <div className={styles.barGlow} />
            </div>
        </div>
    );
}

export default function TopProgressBar() {
    return (
        <Suspense fallback={null}>
            <ProgressBarInner />
        </Suspense>
    );
}
