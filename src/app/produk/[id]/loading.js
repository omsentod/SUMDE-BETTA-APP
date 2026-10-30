import styles from './loading.module.css';

export default function Loading() {
    return (
        <div className={styles.container} aria-busy="true" aria-label="Memuat produk ikan...">
            <div className={styles.grid}>
                {/* Left: Gallery Skeleton */}
                <div className={styles.galleryCol}>
                    <div className={`${styles.bone} ${styles.mainImageBone}`} />
                    <div className={styles.thumbsRow}>
                        <div className={`${styles.bone} ${styles.thumbBone}`} />
                        <div className={`${styles.bone} ${styles.thumbBone}`} />
                        <div className={`${styles.bone} ${styles.thumbBone}`} />
                    </div>
                </div>

                {/* Right: Info Skeleton */}
                <div className={styles.infoCol}>
                    <div className={`${styles.bone} ${styles.eyebrowBone}`} />
                    <div className={`${styles.bone} ${styles.titleBone}`} />
                    <div className={`${styles.bone} ${styles.priceBone}`} />
                    <div className={`${styles.bone} ${styles.descBone}`} />

                    <div className={styles.metaGridBone}>
                        <div className={`${styles.bone} ${styles.metaItemBone}`} />
                        <div className={`${styles.bone} ${styles.metaItemBone}`} />
                        <div className={`${styles.bone} ${styles.metaItemBone}`} />
                    </div>

                    <div className={styles.variantRowBone}>
                        <div className={`${styles.bone} ${styles.variantChipBone}`} />
                        <div className={`${styles.bone} ${styles.variantChipBone}`} />
                    </div>

                    <div className={styles.btnRowBone}>
                        <div className={`${styles.bone} ${styles.cartBtnBone}`} />
                        <div className={`${styles.bone} ${styles.buyBtnBone}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}
