'use client';
import { useState, useMemo, useEffect } from 'react';
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/context/ProductContext";


const SORT_OPTIONS = [
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' }
];

export default function GalleryPage() {
    const { products: allProducts, isLoading } = useProducts();
    // Hide soft-deleted (archived) products from the public gallery.
    const products = useMemo(() => allProducts.filter(p => !p.isArchived), [allProducts]);

    // Derive filter options dynamically from current products list
    const genders = useMemo(() => {
        const set = new Set(products.map(p => p.gender).filter(Boolean));
        ['Male', 'Female', 'Pair'].forEach(g => set.add(g));
        return Array.from(set).sort();
    }, [products]);

    const forms = useMemo(() => {
        const set = new Set(products.map(p => p.form).filter(Boolean));
        ['Plakat', 'Halfmoon', 'Crowntail', 'Giant', 'Double Tail', 'Dumbo Ear'].forEach(f => set.add(f));
        return Array.from(set).sort();
    }, [products]);

    const colors = useMemo(() => {
        const set = new Set(products.map(p => p.coloration).filter(Boolean));
        ['Avatar', 'Multicolor', 'Koi', 'Copper', 'Solid', 'Super Red', 'Galaxy', 'Nemo', 'Black Samurai'].forEach(c => set.add(c));
        return Array.from(set).sort();
    }, [products]);

    // State Management
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

    const [filters, setFilters] = useState({
        genders: [],
        forms: [],
        colors: [],
        priceMin: 0,
        priceMax: 5000000,
    });
    const [sortBy, setSortBy] = useState('newest');

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

    // Filter Logic — must be before any conditional return (Rules of Hooks)
    const filteredProducts = useMemo(() => {
        let result = [...products];

        if (filters.genders.length > 0) {
            result = result.filter(p => filters.genders.includes(p.gender));
        }
        if (filters.forms.length > 0) {
            result = result.filter(p => filters.forms.includes(p.form));
        }
        if (filters.colors.length > 0) {
            result = result.filter(p => filters.colors.includes(p.coloration));
        }
        if (filters.priceMin !== '') {
            result = result.filter(p => p.price >= Number(filters.priceMin));
        }
        if (filters.priceMax !== '') {
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
            const current = prev[type];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [type]: updated };
        });
    };

    const handlePriceChange = (e, minOrMax) => {
        setFilters(prev => ({ ...prev, [minOrMax]: e.target.value }));
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
                                            checked={filters.genders.includes(gender)}
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
                                            checked={filters.forms.includes(form)}
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
                                            checked={filters.colors.includes(color)}
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

                        {/* Grid */}
                        {filteredProducts.length > 0 ? (
                            <div className="productGrid">
                                {filteredProducts.map((product) => (
                                    <ProductCard key={product.id} {...product} />
                                ))}
                            </div>
                        ) : (
                            <div className="emptyState">
                                <div className="emptyStateIcon">🐟</div>
                                <h3 className="emptyStateTitle">No Betta found</h3>
                                <p className="emptyStateDesc">Try adjusting your filters to find your perfect match.</p>
                                <button
                                    onClick={clearFilters}
                                    className="emptyStateBtn"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
