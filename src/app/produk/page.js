'use client';
import { useState, useMemo } from 'react';
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";


// Filter Options
const GENDERS = ['Male', 'Female', 'Pair'];
const FORMS = ['Plakat', 'Halfmoon', 'Crowntail', 'Giant', 'Double Tail', 'Dumbo Ear'];
const COLORS = ['Avatar', 'Multicolor', 'Koi', 'Copper', 'Solid', 'Super Red', 'Galaxy', 'Nemo', 'Black Samurai'];
const SORT_OPTIONS = [
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' }
];

export default function GalleryPage() {
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

    // Filter Logic
    const filteredProducts = useMemo(() => {
        let result = products;

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

        // Sort Logic
        if (sortBy === 'price_asc') {
            result.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price_desc') {
            result.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'newest') {
            // Since dummy data doesn't have dates, sort by ID descending to pretend newest
            result.sort((a, b) => Number(b.id) - Number(a.id));
        }

        return result;
    }, [filters, sortBy]);

    return (
        <div className="pageContainer">
            <div className="innerContainer">

                {/* Header */}
                <div className="produkHero">
                    <h1 className="produkHeroTitle">Premium Collection</h1>
                    <p className="produkHeroSubtitle">Finest Betta Genetics Ready for Acquisition</p>
                </div>

                {/* Main Content Area */}
                <div className="mainLayout">

                    {/* Mobile Filter Toggle */}
                    <button
                        className="mobileFilterBtn"
                        onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                        </svg>
                        Filters
                    </button>

                    {/* Sidebar */}
                    <aside className={`sidebar ${isMobileFiltersOpen ? "sidebarVisible" : "sidebarHidden"}`}>
                        <div className="filterHeader">
                            <h2 className="filterHeaderTitle">Filters</h2>
                            {(filters.genders.length > 0 || filters.forms.length > 0 || filters.colors.length > 0 || filters.priceMin !== '' || filters.priceMax !== '') && (
                                <button onClick={clearFilters} className="clearFiltersBtn">Clear All</button>
                            )}
                        </div>

                        {/* Gender Filter */}
                        <div className="filterSection">
                            <h3 className="filterSectionTitle">Gender</h3>
                            <div className="checkboxGroup">
                                {GENDERS.map(gender => (
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
                                {FORMS.map(form => (
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
                                {COLORS.map(color => (
                                    <label key={color} className="checkboxLabel">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 bg-[#222222] rounded border-[#333333] text-[#FF6B35] focus:ring-[#FF6B35] focus:ring-offset-[#111111]"
                                            checked={filters.colors.includes(color)}
                                            onChange={() => handleCheckboxChange('colors', color)}
                                        />
                                        <span className="text-sm text-[#F5F5F7] group-hover:text-[#FF6B35] transition-colors">{color}</span>
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
                    </aside>

                    {/* Products Grid Area */}
                    <div className="contentArea">
                        {/* Top Bar */}
                        <div className="topBar">
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
