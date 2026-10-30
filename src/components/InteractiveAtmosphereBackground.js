'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './InteractiveAtmosphereBackground.module.css';

export default function InteractiveAtmosphereBackground() {
    const pathname = usePathname() || '';
    const spotlightRef = useRef(null);
    const [isActive, setIsActive] = useState(false);

    // Determine current route context:
    // 1. Admin: ultra-quiet, minimal opacity for clean ERP tables
    // 2. Body-focused (Login, Register, Forgot Password, Checkout, Customer Dashboard, Orders):
    //    richer ambient depth, gold chamber atmosphere framing floating cards
    // 3. Sectioned (Home, Catalog, About):
    //    balanced atmospheric caustics framing section borders without visual clutter
    const isAdmin = pathname.startsWith('/admin');
    const isBodyFocused =
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/reset-password') ||
        pathname.startsWith('/verify-email') ||
        pathname.startsWith('/checkout') ||
        pathname.startsWith('/payment') ||
        pathname.startsWith('/customer');

    const modeClass = isAdmin
        ? styles.adminMode
        : isBodyFocused
        ? styles.bodyFocusMode
        : styles.sectionedMode;

    useEffect(() => {
        let animationFrameId;
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let currentX = mouseX;
        let currentY = mouseY;
        let hasMoved = false;

        const handleMouseMove = (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (!hasMoved) {
                hasMoved = true;
                setIsActive(true);
            }
        };

        const renderLoop = () => {
            if (spotlightRef.current) {
                // Smooth interpolation (lerp) for fluid glide
                currentX += (mouseX - currentX) * 0.08;
                currentY += (mouseY - currentY) * 0.08;
                spotlightRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
            animationFrameId = requestAnimationFrame(renderLoop);
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        animationFrameId = requestAnimationFrame(renderLoop);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className={`${styles.ambientBackdrop} ${modeClass}`} aria-hidden="true">
            {/* Elegant Vector Aquatic Wave Line Ornament */}
            <div className={styles.vectorOrnamentLayer} />

            {/* Living aquatic caustics gradient mesh */}
            <div className={styles.gradientMesh} />

            {/* Organic underwater caustics refraction texture */}
            <div className={styles.aquaticWaterTexture} />

            {/* Micro-light aquatic particles drifting through water column */}
            <div className={styles.particlesContainer}>
                <span className={`${styles.particle} ${styles.p1}`} />
                <span className={`${styles.particle} ${styles.p2}`} />
                <span className={`${styles.particle} ${styles.p3}`} />
                <span className={`${styles.particle} ${styles.p4}`} />
                <span className={`${styles.particle} ${styles.p5}`} />
                <span className={`${styles.particle} ${styles.p6}`} />
            </div>

            {/* Interactive smooth cursor spotlight */}
            <div
                ref={spotlightRef}
                className={`${styles.cursorSpotlight} ${isActive ? styles.spotlightActive : ''}`}
            />
        </div>
    );
}

