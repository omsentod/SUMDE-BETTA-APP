'use client';
import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductCard from "@/components/ProductCard";
import InteractiveBettaAquarium from "@/components/InteractiveBettaAquarium";
import ArtisticBettaEmpty from "@/components/ArtisticBettaEmpty";
import { useProducts } from "@/context/ProductContext";
import Loading from "./loading";
import styles from './produk.module.css';

const SORT_OPTIONS = [
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' }
];

function parseVariantSizes(product) {
    if (!product) return [];
    if (Array.isArray(product.variants) && product.variants.length > 0) return product.variants;
    if (Array.isArray(product.sizes)) return product.sizes;
    if (typeof product.sizes === 'string') {
        try {
            const parsed = JSON.parse(product.sizes);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            return [];
        }
    }
    return [];
}

function GalleryContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const paramCat = (searchParams.get('category') || searchParams.get('form') || '').trim();
    const paramGender = (searchParams.get('gender') || '').trim();
    const paramColor = (searchParams.get('color') || searchParams.get('coloration') || '').trim();
    const paramTab = (searchParams.get('tab') || '').trim().toLowerCase();

    const { products: allProducts, isLoading } = useProducts();
    // Hide soft-deleted (archived) products from the public gallery.
    const products = useMemo(() => allProducts.filter(p => !p.isArchived), [allProducts]);

    // Hitung jumlah spesimen premium vs katalog strain
    const counts = useMemo(() => {
        let premium = 0;
        let sample = 0;
        products.forEach(p => {
            if (p.isPremium) premium++;
            else sample++;
        });
        return { premium, sample, all: products.length };
    }, [products]);

    // Tentukan tab aktif: hormati ?tab= dari URL, default ke 'sample' (Koleksi Reguler) saat masuk /produk
    const activeTab = useMemo(() => {
        if (paramTab === 'premium' || paramTab === 'sample' || paramTab === 'all') {
            return paramTab;
        }
        // Default menampilkan koleksi reguler dahulu sesuai preferensi user
        return 'sample';
    }, [paramTab]);

    const handleTabChange = (newTab) => {
        const params = new URLSearchParams(searchParams.toString());
        if (newTab === 'premium') {
            params.set('tab', 'premium');
        } else if (newTab === 'sample') {
            params.set('tab', 'sample');
        } else {
            params.set('tab', 'all');
        }
        router.replace(`/produk?${params.toString()}`, { scroll: false });
    };

    // Derive gender filter options by inspecting product variants (sizes) & name
    const genders = useMemo(() => {
        const detected = new Set();
        products.forEach(p => {
            const variants = parseVariantSizes(p);
            if (variants.length > 0) {
                variants.forEach(v => {
                    const s = String(v.size || '').toLowerCase();
                    if (s.includes('female') || s.includes('betina')) detected.add('Female');
                    else if (s.includes('male') || s.includes('jantan')) detected.add('Male');
                    if (s.includes('pair') || s.includes('sepasang')) detected.add('Pair');
                });
            } else {
                const n = (p.name || '').toLowerCase();
                if (n.includes('female') || n.includes('betina')) detected.add('Female');
                else if (n.includes('male') || n.includes('jantan')) detected.add('Male');
                if (n.includes('pair') || n.includes('sepasang')) detected.add('Pair');
            }
        });
        if (detected.size === 0) {
            return ['Male', 'Female', 'Pair'];
        }
        return ['Male', 'Female', 'Pair'].filter(g => detected.has(g));
    }, [products]);

    const forms = useMemo(() => {
        const map = new Map();
        products.forEach(p => {
            const formVal = (p.form || '').trim();
            const catVal = (p.category || '').trim();
            const val = formVal || catVal;
            if (val && !map.has(val.toLowerCase())) {
                map.set(val.toLowerCase(), val);
            }
        });
        if (map.size === 0) {
            ['Plakat', 'Halfmoon', 'Crowntail', 'Giant', 'Double Tail', 'Dumbo Ear'].forEach(f => {
                map.set(f.toLowerCase(), f);
            });
        }
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [products]);

    const colors = useMemo(() => {
        const map = new Map();
        products.forEach(p => {
            const val = (p.coloration || '').trim();
            if (val && !map.has(val.toLowerCase())) {
                map.set(val.toLowerCase(), val);
            }
        });
        if (map.size === 0) {
            ['Avatar', 'Multicolor', 'Koi', 'Copper', 'Solid', 'Super Red', 'Galaxy', 'Nemo', 'Black Samurai'].forEach(c => {
                map.set(c.toLowerCase(), c);
            });
        }
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [products]);

    // State Management
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const [isDesktopFilterOpen, setIsDesktopFilterOpen] = useState(false);
    const catalogAnchorRef = useRef(null);

    // Auto-scroll halus ke kartu produk saat pertama masuk atau berganti tab
    useEffect(() => {
        const timer = setTimeout(() => {
            if (catalogAnchorRef.current) {
                const rect = catalogAnchorRef.current.getBoundingClientRect();
                // Hanya trigger jika scroll belum berada di area produk
                if (rect.top > 200 || window.scrollY < 120) {
                    catalogAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [activeTab]);

    const [filters, setFilters] = useState(() => ({
        genders: paramGender ? [paramGender] : [],
        forms: paramCat ? [paramCat] : [],
        colors: paramColor ? [paramColor] : [],
        priceMin: 0,
        priceMax: 5000000,
    }));
    const [sortBy, setSortBy] = useState('newest');

    // Sinkronkan filter saat query param category/form/gender/color berubah via navigasi
    useEffect(() => {
        const cat = (searchParams.get('category') || searchParams.get('form') || '').trim();
        const gender = (searchParams.get('gender') || '').trim();
        const color = (searchParams.get('color') || searchParams.get('coloration') || '').trim();

        setFilters(prev => {
            const nextForms = cat ? [cat] : [];
            const nextGenders = gender ? [gender] : [];
            const nextColors = color ? [color] : [];

            const formsMatch = prev.forms.length === nextForms.length &&
                prev.forms.every((f, i) => f.toLowerCase() === nextForms[i].toLowerCase());
            const gendersMatch = prev.genders.length === nextGenders.length &&
                prev.genders.every((g, i) => g.toLowerCase() === nextGenders[i].toLowerCase());
            const colorsMatch = prev.colors.length === nextColors.length &&
                prev.colors.every((c, i) => c.toLowerCase() === nextColors[i].toLowerCase());

            if (formsMatch && gendersMatch && colorsMatch) return prev;

            return {
                ...prev,
                ...(cat ? { forms: nextForms } : {}),
                ...(gender ? { genders: nextGenders } : {}),
                ...(color ? { colors: nextColors } : {}),
            };
        });
    }, [searchParams]);

    // Lock body scroll while mobile filter sheet is open — prevents background
    // page scroll leaking through when user drags inside the sheet.
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const prev = document.body.style.overflow;
        if (isMobileFiltersOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isMobileFiltersOpen]);

    // Count active filters — untuk badge di action bar dan tombol Reset visibility.
    const activeFilterCount =
        filters.genders.length +
        filters.forms.length +
        filters.colors.length +
        (Number(filters.priceMin) > 0 ? 1 : 0) +
        (Number(filters.priceMax) < 5000000 ? 1 : 0);

    // Filter Logic — case-insensitive and robust against whitespace/empty fields
    const filteredProducts = useMemo(() => {
        let result = [...products];

        // 1. Filter Koleksi (Spesimen Premium 1 of 1 vs Katalog Strain)
        if (activeTab === 'premium') {
            result = result.filter(p => p.isPremium);
        } else if (activeTab === 'sample') {
            result = result.filter(p => !p.isPremium);
        }

        if (filters.genders.length > 0) {
            const selectedGenders = filters.genders.map(g => g.trim().toLowerCase());
            result = result.filter(p => {
                const variants = parseVariantSizes(p);
                if (variants.length > 0) {
                    return variants.some(v => {
                        const s = String(v.size || '').toLowerCase();
                        const isFemale = s.includes('female') || s.includes('betina');
                        const isMale = (s.includes('male') || s.includes('jantan')) && !isFemale;
                        const isPair = s.includes('pair') || s.includes('sepasang');

                        if (selectedGenders.includes('male') && isMale) return true;
                        if (selectedGenders.includes('female') && isFemale) return true;
                        if (selectedGenders.includes('pair') && isPair) return true;
                        return false;
                    });
                }
                const nameLower = (p.name || '').toLowerCase();
                const isFemaleName = nameLower.includes('female') || nameLower.includes('betina');
                const isMaleName = (nameLower.includes('male') || nameLower.includes('jantan')) && !isFemaleName;
                const isPairName = nameLower.includes('pair') || nameLower.includes('sepasang');

                if (selectedGenders.includes('male') && isMaleName) return true;
                if (selectedGenders.includes('female') && isFemaleName) return true;
                if (selectedGenders.includes('pair') && isPairName) return true;
                return false;
            });
        }

        if (filters.forms.length > 0) {
            const selectedForms = filters.forms.map(f => f.trim().toLowerCase());
            result = result.filter(p => {
                const pForm = (p.form || '').trim().toLowerCase();
                const pCat = (p.category || '').trim().toLowerCase();
                return selectedForms.includes(pForm) || selectedForms.includes(pCat);
            });
        }

        if (filters.colors.length > 0) {
            const selectedColors = filters.colors.map(c => c.trim().toLowerCase());
            result = result.filter(p => selectedColors.includes((p.coloration || '').trim().toLowerCase()));
        }

        if (filters.priceMin !== '' && filters.priceMin !== undefined) {
            result = result.filter(p => p.price >= Number(filters.priceMin));
        }
        if (filters.priceMax !== '' && filters.priceMax !== undefined) {
            result = result.filter(p => p.price <= Number(filters.priceMax));
        }

        if (sortBy === 'price_asc') {
            result.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price_desc') {
            result.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'newest') {
            result.sort((a, b) => {
                const aNum = parseInt(a.id);
                const bNum = parseInt(b.id);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return bNum - aNum;
                }
                return b.id.localeCompare(a.id);
            });
        }

        return result;
    }, [filters, sortBy, products, activeTab]);

    if (isLoading) {
        return (
            <div className="pageContainer">
                <Loading />
            </div>
        );
    }

    // Handlers
    const handleCheckboxChange = (type, value) => {
        setFilters(prev => {
            const current = prev[type] || [];
            const valLower = value.trim().toLowerCase();
            const exists = current.some(item => item.trim().toLowerCase() === valLower);
            const updated = exists
                ? current.filter(item => item.trim().toLowerCase() !== valLower)
                : [...current, value];
            return { ...prev, [type]: updated };
        });
    };

    const removeSingleFilter = (type, value) => {
        setFilters(prev => ({
            ...prev,
            [type]: (prev[type] || []).filter(item => item.trim().toLowerCase() !== value.trim().toLowerCase())
        }));
    };

    const clearFilters = () => {
        setFilters({ genders: [], forms: [], colors: [], priceMin: 0, priceMax: 5000000 });
    };

    return (
        <div className={`pageContainer ${activeTab === 'premium' ? styles.vipRoomContainer : ''}`}>
            <div className="innerContainer">

                {/* Atmospheric Aquatic Hero */}
                <div className={`${styles.heroWrapper} ${activeTab === 'premium' ? styles.heroWrapperPremium : ''}`}>
                    {/* Living Aquatic Betta Canvas */}
                    <InteractiveBettaAquarium fishCount={1} />

                    <div className={styles.ambientAquaticLayer} aria-hidden="true">
                        <svg className={styles.finWaveSvg} viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path d="M0,160 C320,300 420,40 720,160 C1020,280 1120,60 1440,160 L1440,320 L0,320 Z" />
                            <path d="M0,192 C280,80 500,260 800,140 C1100,20 1280,220 1440,192 L1440,320 L0,320 Z" opacity="0.6" />
                        </svg>
                    </div>

                    {/* Shimmering Blink-Blink Particles in Premium Mode */}
                    {activeTab === 'premium' && (
                        <div className={styles.heroSparklesWrapper} aria-hidden="true">
                            <span className={`${styles.sparkleParticle} ${styles.sp1}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp2}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp3}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp4}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp5}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp6}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp7}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp8}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp9}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp10}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp11}`} />
                            <span className={`${styles.sparkleParticle} ${styles.sp12}`} />
                        </div>
                    )}

                    <div className={styles.heroInner}>
                        <div className={styles.curationBadge}>
                            <span className={activeTab === 'premium' ? styles.curationPulse : styles.curationPulseSample} />
                            <span>
                                {activeTab === 'premium'
                                    ? 'Spesimen Terkurasi • Edisi Premium'
                                    : activeTab === 'sample'
                                    ? 'Koleksi Reguler • Farm SUMDE'
                                    : 'Seluruh Koleksi Farm'}
                            </span>
                        </div>

                        <h1 className={styles.heroTitle}>
                            {activeTab === 'premium' ? (
                                <>Spesimen Elit <span className={styles.heroTitleEmphasized}>Premium</span></>
                            ) : activeTab === 'sample' ? (
                                <>Koleksi Reguler <span className={styles.heroTitleEmphasized}>Pilihan</span></>
                            ) : (
                                <>Seluruh Koleksi <span className={styles.heroTitleEmphasized}>Akuatik</span></>
                            )}
                        </h1>

                        <p className={styles.heroSubtitle}>
                            {activeTab === 'premium'
                                ? 'Setiap spesimen premium diabadikan secara individual dengan keunikan genetika tunggal dan kualitas visual pilihan tertinggi.'
                                : activeTab === 'sample'
                                ? 'Pilihan ikan cupang hias berkualitas langsung dari pembudidayaan farm SUMDE BETTA. Tersedia berbagai form, corak, dan pilihan varian ukuran.'
                                : 'Eksplorasi lengkap seluruh lini spesimen premium dan katalog reguler farm SUMDE BETTA.'}
                        </p>

                        <div className={styles.editorialPills}>
                            {activeTab === 'premium' ? (
                                <>
                                    <span className={styles.editorialPillItem}>
                                        <svg className={styles.editorialPillIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                        </svg>
                                        Jaminan Seleksi Spesimen Elit
                                    </span>
                                    <span className={styles.editorialPillItem}>
                                        <svg className={styles.editorialPillIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>
                                        </svg>
                                        Rekaman Flaring Video Aktif
                                    </span>
                                    <span className={styles.editorialPillItem}>
                                        <svg className={styles.editorialPillIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                        </svg>
                                        Garansi Hidup Selamat (DOA)
                                    </span>
                                </>
                            ) : activeTab === 'sample' ? (
                                <>
                                    <span className={styles.editorialPillItem}>
                                        <svg className={styles.editorialPillIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                        Standar Grade Farm Teruji
                                    </span>
                                    <span className={styles.editorialPillItem}>
                                        <svg className={styles.editorialPillIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                        Pilihan Size S, M, &amp; L
                                    </span>
                                    <span className={styles.editorialPillItem}>
                                        <svg className={styles.editorialPillIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                        </svg>
                                        Garansi Hidup Selamat (DOA)
                                    </span>
                                </>
                            ) : (
                                <span className={styles.editorialPillItem}>
                                    Total {filteredProducts.length} karya akuatik siap diadopsi
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Smooth Scroll Anchor */}
                <div ref={catalogAnchorRef} className={styles.catalogAnchor} aria-hidden="true" />

                {/* Tactile Luxury Segmented Switcher (Inspired by reference project .filters) */}
                <div className={styles.switcherContainer}>
                    <div className={styles.switcherShell} role="tablist" aria-label="Pilih Jenis Koleksi">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'sample'}
                            onClick={() => handleTabChange('sample')}
                            className={`${styles.switcherTab} ${activeTab === 'sample' ? styles.tabActive : ''}`}
                        >
                            <svg className={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                            </svg>
                            <span>Koleksi Reguler</span>
                            <span className={`${styles.tabCountPill} ${activeTab === 'sample' ? styles.tabCountActive : ''}`}>
                                {counts.sample}
                            </span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'premium'}
                            onClick={() => handleTabChange('premium')}
                            className={`${styles.switcherTab} ${styles.switcherTabPremium} ${activeTab === 'premium' ? styles.tabActivePremium : ''}`}
                        >
                            <svg className={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                            <span>✦ Spesimen Premium</span>
                            <span className={`${styles.tabCountPill} ${activeTab === 'premium' ? styles.tabCountActivePremium : ''}`}>
                                {counts.premium}
                            </span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'all'}
                            onClick={() => handleTabChange('all')}
                            className={`${styles.switcherTab} ${activeTab === 'all' ? styles.tabActive : ''}`}
                        >
                            <svg className={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="8" y1="6" x2="21" y2="6" />
                                <line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" />
                                <line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                            <span>Semua Koleksi</span>
                            <span className={`${styles.tabCountPill} ${activeTab === 'all' ? styles.tabCountActive : ''}`}>
                                {counts.all}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Mobile action bar — Filter + Sort sejajar (mobile only) */}
                <div className="mobileActionBar">
                    <button
                        type="button"
                        className="mobileActionBtn"
                        onClick={() => setIsMobileFiltersOpen(true)}
                        aria-label="Buka filter"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                        </svg>
                        <span>Filter</span>
                        {activeFilterCount > 0 && <span className="mobileActionBadge">{activeFilterCount}</span>}
                    </button>

                    <div className="mobileActionDivider" aria-hidden="true" />

                    <label className="mobileActionBtn mobileActionSort">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h13M3 12h9M3 18h5"/><path d="M17 3v18l4-4M17 21l-4-4"/>
                        </svg>
                        <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Urutkan'}</span>
                        {/* Native select — picker OS lebih ergonomis di mobile */}
                        <select
                            className="mobileActionSelect"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            aria-label="Urutkan"
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {/* Main Content Area */}
                <div className={`mainLayout ${activeTab === 'premium' ? styles.mainLayoutVip : ''}`}>

                    {/* Mobile Filter Toggle (desktop hide via CSS; mobile pakai action bar di atas) */}
                    <button
                        className="mobileFilterBtn"
                        onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                        </svg>
                        Filters
                    </button>

                    {/* Backdrop (mobile bottom-sheet only) */}
                    {isMobileFiltersOpen && (
                        <div
                            className="filterBackdrop"
                            onClick={() => setIsMobileFiltersOpen(false)}
                            aria-hidden="true"
                        />
                    )}

                    {/* Sidebar / bottom-sheet */}
                    <aside className={`sidebar ${isMobileFiltersOpen ? "sidebarVisible" : "sidebarHidden"} ${isDesktopFilterOpen ? styles.sidebarDesktopOpen : styles.sidebarDesktopClosed} ${activeTab === 'premium' ? styles.sidebarVip : ''}`}>
                        <div className="filterHeader">
                            <h2 className="filterHeaderTitle">Filter</h2>
                            {/* Desktop: Clear All di header (mobile: pakai Reset di footer) */}
                            {activeFilterCount > 0 && (
                                <button onClick={clearFilters} className="clearFiltersBtn hide-on-mobile">Clear All</button>
                            )}
                            {/* Mobile: close X (desktop: hidden via CSS) */}
                            <button
                                type="button"
                                className="filterCloseBtn"
                                onClick={() => setIsMobileFiltersOpen(false)}
                                aria-label="Tutup filter"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="filterSheetBody">

                        {/* Gender Filter */}
                        <div className="filterSection">
                            <h3 className="filterSectionTitle">Gender</h3>
                            <div className="checkboxGroup">
                                {genders.map(gender => (
                                    <label key={gender} className="checkboxLabel">
                                        <input
                                            type="checkbox"
                                            className="checkboxInput"
                                            checked={filters.genders.some(g => g.trim().toLowerCase() === gender.trim().toLowerCase())}
                                            onChange={() => handleCheckboxChange('genders', gender)}
                                        />
                                        <span className="checkboxText">{gender}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <hr className="divider" />

                        {/* Form Filter */}
                        <div className="filterSection">
                            <h3 className="filterSectionTitle">Form / Tail Type</h3>
                            <div className="checkboxGroupScrollable">
                                {forms.map(form => (
                                    <label key={form} className="checkboxLabel">
                                        <input
                                            type="checkbox"
                                            className="checkboxInput"
                                            checked={filters.forms.some(f => f.trim().toLowerCase() === form.trim().toLowerCase())}
                                            onChange={() => handleCheckboxChange('forms', form)}
                                        />
                                        <span className="checkboxText">{form}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <hr className="divider" />

                        {/* Coloration Filter */}
                        <div className="filterSection">
                            <h3 className="filterSectionTitle">Coloration</h3>
                            <div className="checkboxGroupScrollable">
                                {colors.map(color => (
                                    <label key={color} className="checkboxLabel">
                                        <input
                                            type="checkbox"
                                            className="checkboxInput"
                                            checked={filters.colors.some(c => c.trim().toLowerCase() === color.trim().toLowerCase())}
                                            onChange={() => handleCheckboxChange('colors', color)}
                                        />
                                        <span className="checkboxText">{color}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <hr className="divider" />

                        {/* Price Filter */}
                        <div className="filterSection">
                            <h3 className="filterSectionTitle">Price (Rp)</h3>
                            <div className="rangeSliderContainer">
                                <div
                                    className="rangeSliderTrack"
                                    style={{
                                        left: `${(filters.priceMin / 5000000) * 100}%`,
                                        right: `${100 - (filters.priceMax / 5000000) * 100}%`
                                    }}
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="5000000"
                                    step="50000"
                                    className="rangeInput"
                                    value={filters.priceMin || 0}
                                    onChange={(e) => {
                                        const value = Math.min(Number(e.target.value), filters.priceMax - 100000);
                                        setFilters(prev => ({ ...prev, priceMin: value }));
                                    }}
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="5000000"
                                    step="50000"
                                    className="rangeInput"
                                    value={filters.priceMax || 5000000}
                                    onChange={(e) => {
                                        const value = Math.max(Number(e.target.value), Number(filters.priceMin) + 100000);
                                        setFilters(prev => ({ ...prev, priceMax: value }));
                                    }}
                                />
                            </div>
                            <div className="rangeLabelContainer">
                                <span className="rangeValue">Rp {Number(filters.priceMin || 0).toLocaleString()}</span>
                                <span className="rangeValue">Rp {Number(filters.priceMax || 5000000).toLocaleString()}</span>
                            </div>
                        </div>
                        </div>{/* /filterSheetBody */}

                        <div className="filterSheetFooter">
                            <button
                                type="button"
                                className="filterResetBtn"
                                onClick={clearFilters}
                                disabled={activeFilterCount === 0}
                            >
                                Reset
                            </button>
                            <button
                                type="button"
                                className="filterApplyBtn"
                                onClick={() => setIsMobileFiltersOpen(false)}
                            >
                                Terapkan ({filteredProducts.length})
                            </button>
                        </div>
                    </aside>

                    {/* Products Grid Area */}
                    <div className={`contentArea ${!isDesktopFilterOpen ? styles.contentAreaExpanded : ''}`}>
                        {/* Modern Flush Toolbar (Zero AI-slop white box) */}
                        <div className={`${styles.galleryToolbar} ${activeTab === 'premium' ? styles.galleryToolbarVip : ''} hide-on-mobile`}>
                            <div className={styles.toolbarLeft}>
                                <button
                                    type="button"
                                    onClick={() => setIsDesktopFilterOpen(prev => !prev)}
                                    className={`${styles.desktopFilterToggleBtn} ${isDesktopFilterOpen ? styles.filterToggleActive : ''}`}
                                    aria-expanded={isDesktopFilterOpen}
                                    title={isDesktopFilterOpen ? "Sembunyikan panel filter" : "Tampilkan panel filter"}
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <line x1="4" y1="21" x2="4" y2="14" />
                                        <line x1="4" y1="10" x2="4" y2="3" />
                                        <line x1="12" y1="21" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12" y2="3" />
                                        <line x1="20" y1="21" x2="20" y2="16" />
                                        <line x1="20" y1="12" x2="20" y2="3" />
                                        <line x1="1" y1="14" x2="7" y2="14" />
                                        <line x1="9" y1="8" x2="15" y2="8" />
                                        <line x1="17" y1="16" x2="23" y2="16" />
                                    </svg>
                                    <span>{isDesktopFilterOpen ? 'Sembunyikan Filter' : 'Filter & Urutkan'}</span>
                                    {activeFilterCount > 0 && (
                                        <span className={styles.filterBadgeCount}>{activeFilterCount}</span>
                                    )}
                                </button>

                                <p className={styles.toolbarCountText}>
                                    Menampilkan <span className={styles.toolbarCountHighlight}>{filteredProducts.length}</span> spesimen
                                </p>
                            </div>

                            <div className={styles.toolbarRight}>
                                <div className={styles.sortWrapper}>
                                    <label htmlFor="gallerySort" className={styles.sortLabelText}>Urutkan:</label>
                                    <select
                                        id="gallerySort"
                                        className={styles.sortSelectElement}
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                    >
                                        {SORT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value} className={styles.sortSelectOption}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Active Filter Chips Bar */}
                        {activeFilterCount > 0 && (
                            <div className="activeFiltersBar">
                                <span className="activeFiltersLabel">Filter Aktif:</span>
                                {filters.forms.map(form => (
                                    <button
                                        key={`form-${form}`}
                                        type="button"
                                        className="filterChip"
                                        onClick={() => removeSingleFilter('forms', form)}
                                        title="Hapus filter form"
                                    >
                                        <span>{form}</span>
                                        <span className="filterChipRemove" aria-hidden="true">✕</span>
                                    </button>
                                ))}
                                {filters.genders.map(gender => (
                                    <button
                                        key={`gender-${gender}`}
                                        type="button"
                                        className="filterChip"
                                        onClick={() => removeSingleFilter('genders', gender)}
                                        title="Hapus filter gender"
                                    >
                                        <span>{gender}</span>
                                        <span className="filterChipRemove" aria-hidden="true">✕</span>
                                    </button>
                                ))}
                                {filters.colors.map(color => (
                                    <button
                                        key={`color-${color}`}
                                        type="button"
                                        className="filterChip"
                                        onClick={() => removeSingleFilter('colors', color)}
                                        title="Hapus filter warna"
                                    >
                                        <span>{color}</span>
                                        <span className="filterChipRemove" aria-hidden="true">✕</span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className="clearAllChipsBtn"
                                    onClick={clearFilters}
                                >
                                    Reset Semua
                                </button>
                            </div>
                        )}

                        {/* Grid */}
                        {filteredProducts.length > 0 ? (
                            <div className={`productGrid ${!isDesktopFilterOpen ? styles.productGridExpanded : ''} ${activeTab === 'premium' ? styles.productGridVip : ''}`}>
                                {filteredProducts.map((product) => (
                                    <ProductCard key={product.id} {...product} />
                                ))}
                            </div>
                        ) : (
                            <ArtisticBettaEmpty
                                title={
                                    activeTab === 'premium'
                                        ? 'Belum Ada Spesimen Premium'
                                        : activeTab === 'sample'
                                        ? 'Koleksi Reguler Belum Tersedia'
                                        : 'Tidak Ada Spesimen Ditemukan'
                                }
                                description={
                                    activeTab === 'premium'
                                        ? 'Seluruh spesimen premium saat ini sedang teradopsi atau dalam kurasi farm. Silakan jelajahi Koleksi Reguler kami.'
                                        : activeTab === 'sample'
                                        ? 'Tidak ada produk reguler yang cocok dengan kriteria filter saat ini.'
                                        : 'Tidak ada spesimen akuatik yang cocok dengan kombinasi filter saat ini.'
                                }
                                actionText={
                                    filters.genders.length > 0 || filters.forms.length > 0 || filters.colors.length > 0 || filters.priceMin > 0
                                        ? 'Reset Filter'
                                        : activeTab === 'premium'
                                        ? 'Buka Koleksi Reguler'
                                        : 'Tampilkan Seluruh Koleksi'
                                }
                                onAction={() => {
                                    if (filters.genders.length > 0 || filters.forms.length > 0 || filters.colors.length > 0 || filters.priceMin > 0) {
                                        clearFilters();
                                    } else if (activeTab === 'premium') {
                                        handleTabChange('sample');
                                    } else {
                                        handleTabChange('all');
                                    }
                                }}
                            />
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

export default function GalleryPage() {
    return (
        <Suspense fallback={<div className="container" style={{ padding: '6rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat katalog produk...</div>}>
            <GalleryContent />
        </Suspense>
    );
}
