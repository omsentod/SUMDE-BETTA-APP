'use client';
import { useState, useRef, useEffect } from 'react';

export default function SearchableSelect({
    options = [],
    value,
    onChange,
    disabled = false,
    placeholder = '-- Pilih --',
    onClickDisabled
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    const selected = options.find(o => o.id === value);
    const filtered = options.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleTriggerClick = () => {
        if (disabled) {
            onClickDisabled?.();
            return;
        }
        setIsOpen(prev => !prev);
        if (!isOpen) setSearch('');
    };

    const handleSelect = (option) => {
        onChange(option.id, option.name);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div ref={containerRef} className="searchable-select-container">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={handleTriggerClick}
                className={`searchable-select-trigger ${selected ? 'has-value' : ''} ${disabled ? 'disabled' : ''}`}
            >
                <span className="searchable-select-label">
                    {selected ? selected.name : placeholder}
                </span>
                <span className={`searchable-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="searchable-select-popover">
                    {/* Search Input */}
                    <div className="searchable-select-search-wrapper">
                        <input
                            type="text"
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari..."
                            className="searchable-select-search-input"
                        />
                    </div>

                    {/* Options List */}
                    <ul className="searchable-select-list">
                        {filtered.length === 0 ? (
                            <li className="searchable-select-empty">
                                Tidak ditemukan
                            </li>
                        ) : filtered.map(option => (
                            <li
                                key={option.id}
                                onClick={() => handleSelect(option)}
                                className={`searchable-select-option ${option.id === value ? 'selected' : ''}`}
                            >
                                {option.name}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
