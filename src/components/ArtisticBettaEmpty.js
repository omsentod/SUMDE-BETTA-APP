'use client';
import styles from './ArtisticBettaEmpty.module.css';

/**
 * ArtisticBettaEmpty
 * Handcrafted empty state with an undulating vector betta fish and concentric water ripples.
 * Strictly adheres to Anti-AI-Slop standards: zero emojis, restrained editorial typography.
 */
export default function ArtisticBettaEmpty({
    title = 'Koleksi Belum Tersedia',
    description = 'Belum ada ikan cupang yang sesuai dengan kriteria kurasi ini. Silakan atur ulang filter Anda.',
    actionText = 'Lihat Semua Koleksi',
    onAction,
    className = '',
    theme = 'default'
}) {
    const isVip = theme === 'vip';

    return (
        <div className={`${styles.emptyWrapper} ${isVip ? styles.emptyWrapperVip : ''} ${className}`} role="status">
            {/* Ambient Water Vignette with Animated Swimming Betta Vector */}
            <div className={styles.vignetteRing} aria-hidden="true">
                <div className={styles.rippleCircle1} />
                <div className={styles.rippleCircle2} />

                <svg className={styles.bettaSvg} viewBox="0 0 100 100" fill="none">
                    {/* Billowing Caudal & Anal Fin Layer */}
                    <path
                        className={styles.finPath}
                        d="M38 52 C24 64, 8 72, 4 58 C0 44, 12 34, 34 46 Z"
                        fill="currentColor"
                        fillOpacity="0.45"
                    />
                    {/* Silken Dorsal Crest */}
                    <path
                        d="M44 38 C40 22, 54 16, 68 28 C60 36, 52 38, 44 38 Z"
                        fill="currentColor"
                        fillOpacity="0.35"
                    />
                    {/* Torpedo Body */}
                    <path
                        d="M32 50 C36 40, 52 38, 72 44 C84 48, 88 52, 78 56 C62 62, 42 60, 32 50 Z"
                        fill="currentColor"
                    />
                    {/* Operculum Line */}
                    <path
                        d="M66 45 C67 48, 67 52, 64 55"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeOpacity="0.6"
                    />
                    {/* Catchlight Eye */}
                    <circle cx="76" cy="48" r="2.2" fill="#ffffff" />
                    <circle cx="76.3" cy="47.7" r="1.2" fill="#0f172a" />
                    {/* Ventral Tassel Fin */}
                    <path
                        d="M56 57 C54 68, 48 76, 44 80"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeOpacity="0.7"
                    />
                </svg>
            </div>

            <h3 className={styles.emptyTitle}>{title}</h3>
            <p className={styles.emptyDescription}>{description}</p>

            {onAction && actionText && (
                <button
                    type="button"
                    onClick={onAction}
                    className={styles.emptyAction}
                >
                    <span>{actionText}</span>
                    <svg className={styles.emptyActionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            )}
        </div>
    );
}

