'use client';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';

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
    const { theme } = useTheme();
    const isDark = theme === 'dark';

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
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={handleTriggerClick}
                style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.7rem 1rem',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '0.5rem',
                    color: selected ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    textAlign: 'left',
                    transition: 'border-color 0.2s, background 0.2s',
                    opacity: disabled ? 0.55 : 1,
                    boxSizing: 'border-box',
                }}
                onMouseEnter={e => {
                    if (!disabled) e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={e => {
                    if (!disabled) e.currentTarget.style.borderColor = 'var(--input-border)';
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected ? selected.name : placeholder}
                </span>
                <span style={{
                    flexShrink: 0,
                    marginLeft: '0.5rem',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    color: 'var(--text-muted)',
                    fontSize: '0.7rem',
                }}>▼</span>
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 200,
                    background: 'var(--bg-card)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    boxShadow: isDark
                        ? '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)'
                        : '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                    maxHeight: '280px',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* Search Input */}
                    <div style={{
                        padding: '0.65rem 0.75rem',
                        borderBottom: '1px solid var(--border-color)',
                        flexShrink: 0,
                    }}>
                        <input
                            type="text"
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari..."
                            style={{
                                width: '100%',
                                padding: '0.45rem 0.75rem',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--input-border)',
                                borderRadius: '0.4rem',
                                color: 'var(--text-main)',
                                fontSize: '0.875rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Options List */}
                    <ul style={{
                        listStyle: 'none',
                        margin: 0,
                        padding: '0.4rem 0',
                        overflowY: 'auto',
                        flex: 1,
                    }}>
                        {filtered.length === 0 ? (
                            <li style={{
                                padding: '0.7rem 1rem',
                                color: 'var(--text-muted)',
                                fontSize: '0.875rem',
                            }}>
                                Tidak ditemukan
                            </li>
                        ) : filtered.map(option => (
                            <li
                                key={option.id}
                                onClick={() => handleSelect(option)}
                                style={{
                                    padding: '0.6rem 1rem',
                                    cursor: 'pointer',
                                    color: option.id === value ? 'var(--primary)' : 'var(--text-main)',
                                    background: option.id === value ? 'var(--primary-glow)' : 'transparent',
                                    fontSize: '0.875rem',
                                    transition: 'background 0.12s',
                                    userSelect: 'none',
                                }}
                                onMouseEnter={e => {
                                    if (option.id !== value) e.currentTarget.style.background = 'var(--qty-bg)';
                                }}
                                onMouseLeave={e => {
                                    if (option.id !== value) e.currentTarget.style.background = 'transparent';
                                }}
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
