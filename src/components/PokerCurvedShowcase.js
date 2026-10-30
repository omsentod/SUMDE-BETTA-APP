'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import ProductCard from './ProductCard';
import styles from './PokerCurvedShowcase.module.css';

export default function PokerCurvedShowcase({ products = [] }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const total = products.length;

    const handlePrev = useCallback(() => {
        if (total === 0) return;
        setActiveIndex((prev) => (prev - 1 + total) % total);
    }, [total]);

    const handleNext = useCallback(() => {
        if (total === 0) return;
        setActiveIndex((prev) => (prev + 1) % total);
    }, [total]);

    const handleCardClick = (index) => {
        if (index !== activeIndex) {
            setActiveIndex(index);
        }
    };

    // Keyboard Arrow navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') handlePrev();
            else if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlePrev, handleNext]);

    // Touch Swipe Support
    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e) => {
        touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
        const distance = touchStartX.current - touchEndX.current;
        if (Math.abs(distance) > 40) {
            if (distance > 0) handleNext();
            else handlePrev();
        }
    };

    if (!products || products.length === 0) {
        return null;
    }

    return (
        <section className={styles.pokerSectionContainer}>
            <div className={styles.pokerStageBand}>
                {/* Betta Fin Watermark in Background */}
                <div className={styles.stageWatermark} aria-hidden="true" />

                <div className="container">
                    {/* Header with Title & Action */}
                    <div className={styles.stageHeader}>
                        <div className={styles.headerLeft}>
                            <div className={styles.eyebrowBadge}>
                                <span className={styles.eyebrowSparkle}>✦</span>
                                <span>EDISI KOLEKTOR • 3D CURATED STAGE</span>
                            </div>
                            <h2 className={styles.stageTitle}>
                                Kurasi Koleksi <span className={styles.stageTitleHighlight}>Gallery</span>
                            </h2>
                            <p className={styles.stageSubtitle}>
                                Mahakarya pilihan kurator dengan genetika tunggal dan kualitas visual tertinggi. Format panggung kurva eksklusif 1 of 1.
                            </p>
                        </div>

                        <Link href="/produk?tab=premium" className={styles.exploreAllLink}>
                            <span>Buka Ruang Gallery VIP</span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </Link>
                    </div>

                    {/* 3D Perspective Curved Arc Stage */}
                    <div
                        className={styles.stagePerspective}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* Glowing Pedestal Spotlight under Active Center Card */}
                        <div className={styles.pedestalSpotlight} aria-hidden="true" />

                        {/* Curved Table Rail Arc */}
                        <div className={styles.curvedTableRail} aria-hidden="true" />

                        {/* Left / Right Nav Buttons */}
                        {total > 1 && (
                            <>
                                <button
                                    type="button"
                                    className={`${styles.navArrowBtn} ${styles.navArrowLeft}`}
                                    onClick={handlePrev}
                                    aria-label="Ikan Sebelumnya"
                                >
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.navArrowBtn} ${styles.navArrowRight}`}
                                    onClick={handleNext}
                                    aria-label="Ikan Selanjutnya"
                                >
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </button>
                            </>
                        )}

                        {/* Card Container in 3D Space */}
                        <div className={styles.cardsContainer}>
                            {products.map((product, idx) => {
                                // Calculate circular distance relative to activeIndex
                                let diff = idx - activeIndex;
                                if (diff > total / 2) diff -= total;
                                if (diff < -total / 2) diff += total;

                                let slotClass = styles.cardCenter;
                                if (diff === 0) slotClass = styles.cardCenter;
                                else if (diff === -1) slotClass = styles.cardLeft1;
                                else if (diff === 1) slotClass = styles.cardRight1;
                                else if (diff === -2) slotClass = styles.cardLeft2;
                                else if (diff === 2) slotClass = styles.cardRight2;
                                else if (diff < -2) slotClass = styles.cardHiddenLeft;
                                else if (diff > 2) slotClass = styles.cardHiddenRight;

                                const isCenter = diff === 0;

                                return (
                                    <div
                                        key={product.id}
                                        className={`${styles.cardSlot} ${slotClass}`}
                                    >
                                        {/* Product Card Rendering */}
                                        <ProductCard {...product} />

                                        {/* Click overlay for flanking cards so clicking centers them */}
                                        {!isCenter && (
                                            <button
                                                type="button"
                                                className={styles.flankingClickArea}
                                                onClick={() => handleCardClick(idx)}
                                                aria-label={`Pilih ${product.name}`}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stage Footer Controls: Dots & Index Counter */}
                    {total > 1 && (
                        <div className={styles.stageFooterControls}>
                            <div className={styles.dotsContainer}>
                                {products.map((_, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`${styles.dotBtn} ${idx === activeIndex ? styles.dotBtnActive : ''}`}
                                        onClick={() => setActiveIndex(idx)}
                                        aria-label={`Ke kartu ke-${idx + 1}`}
                                    />
                                ))}
                            </div>

                            <div className={styles.counterBadge}>
                                <span className={styles.counterCurrent}>
                                    {String(activeIndex + 1).padStart(2, '0')}
                                </span>
                                <span> / {String(total).padStart(2, '0')}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

