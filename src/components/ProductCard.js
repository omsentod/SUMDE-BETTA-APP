'use client';
import Link from 'next/link';
import Image from 'next/image';
import styles from './ProductCard.module.css';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';

export default function ProductCard({ id, name, price, form, coloration, gender, isSold, isPremium, image, category, description, statsForm, age, statsSpirit }) {
    const { addToCart, buyNow } = useCart();
    const router = useRouter();
    const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price);

    const handleAddToCart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart({ id, name, price, form, coloration, gender, image, category, description, statsForm, age, statsSpirit });
    };

    const handleBuyNow = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSold) {
            buyNow({ id, name, price, form, coloration, gender, image, category, description, statsForm, age, statsSpirit });
            router.push('/checkout');
        }
    };

    return (
        <div className={styles.card}>
            {/* Card Body wrapped in Link for direct navigation to details */}
            <Link href={`/produk/${id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Image Container */}
                <div className={styles.imageContainer}>
                    {image ? (
                        <Image
                            src={image}
                            alt={name}
                            fill
                            className={`${styles.image} ${isSold ? styles.imageSold : ''}`}
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                    ) : (
                        <div className={styles.placeholderIcon}>🐟</div>
                    )}

                    {/* Badges container */}
                    <div className={styles.badgesContainer}>
                        {isSold ? (
                            <span className={styles.badgeSold}>
                                Terjual
                            </span>
                        ) : (
                            <span className={styles.badgeReady}>
                                Ready Stock
                            </span>
                        )}
                        {isPremium && !isSold && (
                            <span className={styles.badgePremium}>
                                Premium
                            </span>
                        )}
                    </div>
                </div>

                {/* Content Container */}
                <div className={styles.contentContainer}>
                    {/* Taxonomy quick details */}
                    <div className={styles.taxonomyContainer}>
                        <span>{gender}</span>
                        <span className={styles.dot}></span>
                        <span>{form}</span>
                        <span className={styles.dot}></span>
                        <span>{age}</span>
                    </div>

                    {/* Title */}
                    <h3 className={styles.title} title={name}>
                        {name}
                    </h3>

                    {/* Price */}
                    <p className={styles.price}>
                        {formattedPrice}
                    </p>
                </div>
            </Link>

            {/* Actions (Isolated from card click) */}
            <div className={styles.actionsContainer} style={{ padding: '0 1.25rem 1.25rem 1.25rem', marginTop: 'auto' }}>
                <button
                    onClick={handleBuyNow}
                    className={isSold ? styles.buyBtnSold : styles.buyBtnActive}
                    disabled={isSold}
                    style={{ border: 'none', cursor: isSold ? 'not-allowed' : 'pointer' }}
                >
                    {isSold ? 'Lihat Arsip' : 'Beli Sekarang'}
                </button>

                {!isSold && (
                    <button
                        onClick={handleAddToCart}
                        className={styles.cartBtn}
                        aria-label="Add to cart"
                        title="Tambah ke Keranjang"
                        style={{ cursor: 'pointer' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={styles.cartIconBase}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4.5m0 0v-4.5m0 4.5h3.5m-3.5 0H8.5" className={styles.cartIconHover} />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
