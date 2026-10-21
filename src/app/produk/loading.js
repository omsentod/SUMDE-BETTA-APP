import styles from './loading.module.css';

export default function Loading() {
    return (
        <div className={styles.container} aria-busy="true" aria-label="Memuat katalog produk...">
            <div className={styles.headerSkeleton}>
                <div className={`${styles.bone} ${styles.titleBone}`} />
                <div className={`${styles.bone} ${styles.subtitleBone}`} />
            </div>

            <div className={styles.layout}>
                <div className={`${styles.bone} ${styles.sidebarBone}`} />

                <div className={styles.grid}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className={styles.card}>
                            <div className={`${styles.bone} ${styles.imageBone}`} />
                            <div className={styles.cardContent}>
                                <div className={`${styles.bone} ${styles.metaBone}`} />
                                <div className={`${styles.bone} ${styles.cardTitleBone}`} />
                                <div className={styles.priceRow}>
                                    <div className={`${styles.bone} ${styles.priceBone}`} />
                                    <div className={`${styles.bone} ${styles.btnBone}`} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
