'use client';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/context/ProductContext";

const SORT_OPTIONS = [
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' }
];

function parseVariantSizes(product) {
    if (!product || !product.sizes) return [];
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
    const paramCat = (searchParams.get('category') || searchParams.get('form') || '').trim();
    const paramGender = (searchParams.get('gender') || '').trim();
    const paramColor = (searchParams.get('color') || searchParams.get('coloration') || '').trim();

    const { products: allProducts, isLoading } = useProducts();
    // Hide soft-deleted (archived) products from the public gallery.
    const products = useMemo(() => allProducts.filter(p => !p.isArchived), [allProducts]);

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
    }, [filters, sortBy, products]);

    if (isLoading) {
        return (
            <div className="pageContainer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2rem', color: 'var(--text-muted)' }}>Memuat Galeri...</h2>
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
        <div className="pageContainer">
            <div className="innerContainer">

                {/* Header — compact di mobile, hero penuh di desktop */}
                <div className="produkHero">
                    <h1 className="produkHeroTitle">Premium Collection</h1>
                    <p className="produkHeroSubtitle">Finest Betta Genetics Ready for Acquisition</p>
                    <p className="produkHeroCountMobile">
                        <span className="topBarHighlight">{filteredProducts.length}</span> ikan tersedia
                    </p>
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
                <div className="mainLayout">

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
                    <aside className={`sidebar ${isMobileFiltersOpen ? "sidebarVisible" : "sidebarHidden"}`}>
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
                    <div className="contentArea">
                        {/* Top Bar — desktop only; mobile pakai action bar + hero count */}
                        <div className="topBar hide-on-mobile">
                            <p className="topBarText">
                                Showing <span className="topBarHighlight">{filteredProducts.length}</span> results
                            </p>
                            <div className="sortContainer">
                                <label className="sortLabel">Sort by:</label>
                                <select
                                    className="sortSelect"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    {SORT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value} className="sortOption">{opt.label}</option>
                                    ))}
                                </select>
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
                            <div className="productGrid">
                                {filteredProducts.map((product) => (
                                    <ProductCard key={product.id} {...product} />
                                ))}
                            </div>
                        ) : (
                            <div className="emptyState">
                                <div className="emptyStateIcon" aria-hidden="true">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        <line x1="8" y1="11" x2="14" y2="11" />
                                    </svg>
                                </div>
                                <h3 className="emptyStateTitle">Tidak ada spesimen ditemukan</h3>
                                <p className="emptyStateDesc">Tidak ada ikan cupang yang cocok dengan kriteria filter saat ini.</p>
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="emptyStateBtn"
                                >
                                    Reset Filter
                                </button>
                            </div>
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
