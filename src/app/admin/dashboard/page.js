'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './adminDashboard.module.css';

// Custom Styled and Manageable Dropdown Component (CRUD)
function ManageableSelect({ label, value, onChange, options, setOptions }) {
    const [isOpen, setIsOpen] = useState(false);
    const [newValue, setNewValue] = useState('');
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setIsDeleteMode(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAdd = () => {
        const trimmed = newValue.trim();
        if (!trimmed) return;
        if (options.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
            alert('Opsi ini sudah ada.');
            return;
        }
        setOptions([...options, trimmed]);
        onChange(trimmed);
        setNewValue('');
    };

    const handleDelete = (opt, e) => {
        e.stopPropagation();
        if (opt === value) {
            const remaining = options.filter(o => o !== opt);
            onChange(remaining.length > 0 ? remaining[0] : '');
        }
        setOptions(options.filter(o => o !== opt));
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            <label className={styles.formLabel}>{label}</label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={styles.selectTrigger}
            >
                <span>{value || '-- Pilih --'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>

            {isOpen && (
                <div className={styles.selectDropdown}>
                    <div className={styles.selectHeader}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pilih Opsi</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDeleteMode(!isDeleteMode);
                            }}
                            className={styles.selectEditBtn}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            {isDeleteMode ? 'Selesai Edit' : 'Edit List'}
                        </button>
                    </div>

                    <div className={styles.selectList}>
                        {options.map((opt) => {
                            const isSelected = opt === value;
                            return (
                                <div 
                                    key={opt}
                                    onClick={() => {
                                        if (isDeleteMode) return;
                                        onChange(opt);
                                        setIsOpen(false);
                                    }}
                                    className={`${styles.selectItem} ${isSelected ? styles.selectItemSelected : ''}`}
                                    style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
                                >
                                    <span>{opt}</span>
                                    {isDeleteMode && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDelete(opt, e)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                padding: '0.2rem',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className={styles.selectFooter}>
                        <input
                            type="text"
                            placeholder="Tambah opsi baru..."
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            className={styles.formInput}
                            style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAdd();
                                }
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleAdd}
                            className="btn btn-primary"
                            style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem' }}
                        >
                            +
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminDashboard() {
    const { currentUser, isLoading: authLoading } = useAuth();
    const { products, addProduct, updateProduct, deleteProduct, isLoading: productsLoading } = useProducts();
    const router = useRouter();

    const defaultCategories = ['Plakat', 'Halfmoon', 'Crowntail', 'Giant', 'Double Tail', 'Dumbo Ear'];
    const defaultGenders = ['Male', 'Female', 'Pair'];
    const defaultGrades = ['COMP', 'COMPETITION', 'A', 'B', 'C'];

    const [categories, setCategories] = useState(defaultCategories);
    const [genders, setGenders] = useState(defaultGenders);
    const [grades, setGrades] = useState(defaultGrades);

    useEffect(() => {
        if (products.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCategories(prev => {
                const cats = new Set([...defaultCategories, ...prev]);
                products.forEach(p => { if (p.form) cats.add(p.form); });
                return Array.from(cats);
            });

            setGenders(prev => {
                const gens = new Set([...defaultGenders, ...prev]);
                products.forEach(p => { if (p.gender) gens.add(p.gender); });
                return Array.from(gens);
            });

            setGrades(prev => {
                const grds = new Set([...defaultGrades, ...prev]);
                products.forEach(p => { if (p.statsForm) grds.add(p.statsForm); });
                return Array.from(grds);
            });
        }
    }, [products]);

    const [activeTab, setActiveTab] = useState('products'); // 'products' | 'users' | 'transactions' | 'events'
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [events, setEvents] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [eventsLoading, setEventsLoading] = useState(false);

    // Search & Filtering states
    const [productSearch, setProductSearch] = useState('');
    const [productCategoryFilter, setProductCategoryFilter] = useState('All');
    const [productStockFilter, setProductStockFilter] = useState('All');

    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('All');

    const [eventSearch, setEventSearch] = useState('');

    // Confirmation Modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        desc: '',
        confirmText: 'Hapus Data',
        isDanger: true,
        onConfirm: null
    });

    // Modal state for Event CRUD
    const [isEventAddModalOpen, setIsEventAddModalOpen] = useState(false);
    const [isEventEditModalOpen, setIsEventEditModalOpen] = useState(false);
    const [currentEditEvent, setCurrentEditEvent] = useState(null);

    // Form inputs for Event CRUD
    const [eventForm, setEventForm] = useState({
        title: '',
        subtitle: '',
        description: '',
        image: '/betta-2.png',
        targetUrl: '',
        buttonText: 'Lihat Event',
        isActive: true,
        startDate: '',
        endDate: ''
    });

    // Modal state for Product CRUD
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentEditProduct, setCurrentEditProduct] = useState(null);

    // Form inputs for Product CRUD
    const [productForm, setProductForm] = useState({
        name: '',
        price: '',
        category: 'Plakat',
        gender: 'Male',
        form: 'Plakat',
        coloration: 'Multicolor',
        description: '',
        image: '/betta-1.png',
        isPremium: false,
        statsForm: 'COMP',
        age: '4 Month',
        statsSpirit: 'Aktif',
        quantity: 1,
        sizes: []
    });

    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    // Protect Route
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || currentUser.role !== 'admin') {
                router.push('/login');
            }
        }
    }, [currentUser, authLoading, router]);

    // Load users, orders, & events initially for KPI calculation
    const loadUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await fetch('/api/users');
            if (res.ok) setUsers(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setUsersLoading(false);
        }
    };

    const loadOrders = async () => {
        try {
            const res = await fetch('/api/orders');
            if (res.ok) setOrders(await res.json());
        } catch (err) {
            console.error(err);
        }
    };

    const loadEvents = async () => {
        setEventsLoading(true);
        try {
            const res = await fetch('/api/events');
            if (res.ok) setEvents(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setEventsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser && currentUser.role === 'admin') {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load when session resolves
            loadUsers();
            loadOrders();
            loadEvents();
        }
    }, [currentUser]);

    // KPI Metrics calculation
    const kpiMetrics = useMemo(() => {
        const totalRevenue = orders
            .filter(o => o.status === 'PROCESSING' || o.status === 'SHIPPED' || o.status === 'COMPLETED')
            .reduce((sum, o) => sum + (o.total || 0), 0);

        const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;
        const lowStockCount = products.filter(p => p.quantity <= 2).length;

        return {
            totalRevenue,
            totalOrders: orders.length,
            pendingOrdersCount,
            totalProducts: products.length,
            lowStockCount,
            totalUsers: users.length
        };
    }, [orders, products, users]);

    // Filtered lists
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                (p.form && p.form.toLowerCase().includes(productSearch.toLowerCase()));
            const matchCategory = productCategoryFilter === 'All' || p.form === productCategoryFilter;
            let matchStock = true;
            if (productStockFilter === 'Ready') matchStock = p.quantity > 0;
            if (productStockFilter === 'Sold') matchStock = p.quantity === 0;
            if (productStockFilter === 'LowStock') matchStock = p.quantity > 0 && p.quantity <= 2;

            return matchSearch && matchCategory && matchStock;
        });
    }, [products, productSearch, productCategoryFilter, productStockFilter]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                u.email.toLowerCase().includes(userSearch.toLowerCase());
            const matchRole = userRoleFilter === 'All' || u.role === userRoleFilter;
            return matchSearch && matchRole;
        });
    }, [users, userSearch, userRoleFilter]);

    const filteredEvents = useMemo(() => {
        return events.filter(e => e.title.toLowerCase().includes(eventSearch.toLowerCase()));
    }, [events, eventSearch]);

    // File Upload Handler
    const handleFileUpload = async (e, setTargetForm) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar.');

            setTargetForm(prev => ({ ...prev, image: data.url }));
        } catch (err) {
            console.error(err);
            setUploadError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Product Submit
    const handleAddProduct = async (e) => {
        e.preventDefault();
        try {
            await addProduct(productForm);
            setIsAddModalOpen(false);
            resetProductForm();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEditProductSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateProduct(currentEditProduct.id, productForm);
            setIsEditModalOpen(false);
            setCurrentEditProduct(null);
            resetProductForm();
        } catch (err) {
            alert(err.message);
        }
    };

    const confirmDeleteProduct = (product) => {
        setConfirmModal({
            isOpen: true,
            title: 'Hapus Produk',
            desc: `Apakah Anda yakin ingin menghapus produk "${product.name}"? Tindakan ini tidak dapat dibatalkan.`,
            onConfirm: async () => {
                try {
                    await deleteProduct(product.id);
                } catch (err) {
                    alert(err.message);
                }
            }
        });
    };

    const openEditProductModal = (product) => {
        setCurrentEditProduct(product);
        let parsedSizes = [];
        try {
            if (product.sizes) {
                parsedSizes = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes;
            }
        } catch (e) {
            console.error('Failed to parse sizes', e);
        }
        setProductForm({
            name: product.name,
            price: product.price,
            category: product.category,
            gender: product.gender,
            form: product.form,
            coloration: product.coloration,
            description: product.description,
            image: product.image,
            isPremium: product.isPremium,
            statsForm: product.statsForm || 'COMP',
            age: product.age || '4 Month',
            statsSpirit: product.statsSpirit || 'Aktif',
            quantity: product.quantity !== undefined ? product.quantity : 1,
            sizes: parsedSizes || []
        });
        setIsEditModalOpen(true);
    };

    const resetProductForm = () => {
        setProductForm({
            name: '',
            price: '',
            category: 'Plakat',
            gender: 'Male',
            form: 'Plakat',
            coloration: 'Multicolor',
            description: '',
            image: '/betta-1.png',
            isPremium: false,
            statsForm: 'COMP',
            age: '4 Month',
            statsSpirit: 'Aktif',
            quantity: 1,
            sizes: []
        });
    };

    // Event Submit
    const handleAddEvent = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventForm)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal menambahkan event.');
            setEvents(prev => [data, ...prev]);
            setIsEventAddModalOpen(false);
            resetEventForm();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEditEventSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/events', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: currentEditEvent.id, ...eventForm })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal memperbarui event.');
            setEvents(prev => prev.map(ev => ev.id === currentEditEvent.id ? data : ev));
            setIsEventEditModalOpen(false);
            setCurrentEditEvent(null);
            resetEventForm();
        } catch (err) {
            alert(err.message);
        }
    };

    const confirmDeleteEvent = (event) => {
        setConfirmModal({
            isOpen: true,
            title: 'Hapus Event Banner',
            desc: `Apakah Anda yakin ingin menghapus event "${event.title}"?`,
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/events?id=${event.id}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Gagal menghapus event.');
                    setEvents(prev => prev.filter(ev => ev.id !== event.id));
                } catch (err) {
                    alert(err.message);
                }
            }
        });
    };

    const openEditEventModal = (event) => {
        setCurrentEditEvent(event);
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            const pad = (num) => String(num).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setEventForm({
            title: event.title,
            subtitle: event.subtitle || '',
            description: event.description,
            image: event.image,
            targetUrl: event.targetUrl,
            buttonText: event.buttonText || 'Lihat Event',
            isActive: event.isActive,
            startDate: formatDate(event.startDate),
            endDate: formatDate(event.endDate)
        });
        setIsEventEditModalOpen(true);
    };

    const resetEventForm = () => {
        setEventForm({
            title: '',
            subtitle: '',
            description: '',
            image: '/betta-2.png',
            targetUrl: '',
            buttonText: 'Lihat Event',
            isActive: true,
            startDate: '',
            endDate: ''
        });
    };

    // User Operations
    const handleToggleRole = async (user) => {
        const newRole = user.role === 'admin' ? 'customer' : 'admin';
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, role: newRole })
            });
            if (res.ok) {
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const confirmDeleteUser = (user) => {
        if (user.id === currentUser.id) {
            alert('Anda tidak bisa menghapus akun Anda sendiri.');
            return;
        }
        setConfirmModal({
            isOpen: true,
            title: 'Hapus User',
            desc: `Apakah Anda yakin ingin menghapus akun "${user.name}" (${user.email})?`,
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' });
                    if (res.ok) setUsers(prev => prev.filter(u => u.id !== user.id));
                } catch (err) {
                    console.error(err);
                }
            }
        });
    };

    const formattedCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    if (authLoading || !currentUser || currentUser.role !== 'admin') {
        return (
            <div className="container" style={{ padding: '10rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
                <h2>Memverifikasi Otoritas Admin...</h2>
            </div>
        );
    }

    return (
        <div className={styles.dashboardWrapper}>
            <div className="container">
                {/* Header */}
                <div className={styles.dashboardHeader}>
                    <div>
                        <span className={styles.headerBadge}>Otoritas Tertinggi</span>
                        <h1 className={styles.headerTitle}>Admin Dashboard</h1>
                    </div>
                    <div className={styles.headerButtons}>
                        {activeTab === 'products' && (
                            <button
                                onClick={() => {
                                    setIsAddModalOpen(true);
                                    resetProductForm();
                                }}
                                className="btn btn-primary"
                                style={{ borderRadius: '30px', padding: '0.65rem 1.4rem' }}
                            >
                                + Tambah Produk
                            </button>
                        )}
                        {activeTab === 'events' && (
                            <button
                                onClick={() => {
                                    setIsEventAddModalOpen(true);
                                    resetEventForm();
                                }}
                                className="btn btn-primary"
                                style={{ borderRadius: '30px', padding: '0.65rem 1.4rem' }}
                            >
                                + Tambah Event
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Metrics Cards Grid */}
                <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}>
                        <div className={styles.kpiHeader}>
                            <span className={styles.kpiTitle}>Total Omset</span>
                            <div className={styles.kpiIconWrapper}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="1" x2="12" y2="23"></line>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                            </div>
                        </div>
                        <div className={styles.kpiValue}>{formattedCurrency(kpiMetrics.totalRevenue)}</div>
                        <div className={styles.kpiSubtext}>Dari transaksi berstatus diproses/selesai</div>
                    </div>

                    <div className={styles.kpiCard}>
                        <div className={styles.kpiHeader}>
                            <span className={styles.kpiTitle}>Total Pesanan</span>
                            <div className={styles.kpiIconWrapper}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                                    <line x1="3" y1="6" x2="21" y2="6"></line>
                                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                                </svg>
                            </div>
                        </div>
                        <div className={styles.kpiValue}>{kpiMetrics.totalOrders}</div>
                        <div className={styles.kpiSubtext}>
                            {kpiMetrics.pendingOrdersCount > 0 ? (
                                <span style={{ color: '#F59E0B', fontWeight: '600' }}>
                                    ⚠️ {kpiMetrics.pendingOrdersCount} Pesanan PENDING
                                </span>
                            ) : (
                                <span>Semua transaksi diproses</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.kpiCard}>
                        <div className={styles.kpiHeader}>
                            <span className={styles.kpiTitle}>Katalog Produk</span>
                            <div className={styles.kpiIconWrapper}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                </svg>
                            </div>
                        </div>
                        <div className={styles.kpiValue}>{kpiMetrics.totalProducts}</div>
                        <div className={styles.kpiSubtext}>
                            {kpiMetrics.lowStockCount > 0 ? (
                                <span style={{ color: '#EF4444', fontWeight: '600' }}>
                                    {kpiMetrics.lowStockCount} Produk Stok Menipis/Habis
                                </span>
                            ) : (
                                <span>Stok aman tersedia</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.kpiCard}>
                        <div className={styles.kpiHeader}>
                            <span className={styles.kpiTitle}>Total Pengguna</span>
                            <div className={styles.kpiIconWrapper}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                        </div>
                        <div className={styles.kpiValue}>{kpiMetrics.totalUsers}</div>
                        <div className={styles.kpiSubtext}>Pelanggan & Admin terdaftar</div>
                    </div>
                </div>

                {/* Tab Navigator */}
                <div className={styles.tabsContainer}>
                    {[
                        { 
                            id: 'products', 
                            name: 'Kelola Produk', 
                            count: products.length,
                            icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                    <polyline points="2 17 12 22 22 17"></polyline>
                                    <polyline points="2 12 12 17 22 12"></polyline>
                                </svg>
                            ) 
                        },
                        { 
                            id: 'users', 
                            name: 'Kelola User', 
                            count: users.length,
                            icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            ) 
                        },
                        { 
                            id: 'transactions', 
                            name: 'Daftar Transaksi', 
                            count: orders.length,
                            icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                    <line x1="1" y1="10" x2="23" y2="10"></line>
                                </svg>
                            ) 
                        },
                        { 
                            id: 'events', 
                            name: 'Kelola Event', 
                            count: events.length,
                            icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                            ) 
                        }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                if (tab.id === 'transactions') {
                                    router.push('/admin/orders');
                                    return;
                                }
                                setActiveTab(tab.id);
                            }}
                            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabActive : ''}`}
                        >
                            {tab.icon}
                            <span>{tab.name}</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '10px', background: activeTab === tab.id ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)' }}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Tab: Products */}
                {activeTab === 'products' && (
                    <div>
                        {/* Controls */}
                        <div className={styles.controlBar}>
                            <div className={styles.searchBox}>
                                <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Cari nama produk atau jenis form..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className={styles.searchInput}
                                />
                            </div>

                            <div className={styles.filterGroup}>
                                <select
                                    value={productCategoryFilter}
                                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                                    className={styles.selectInput}
                                >
                                    <option value="All">Semua Kategori</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>

                                <select
                                    value={productStockFilter}
                                    onChange={(e) => setProductStockFilter(e.target.value)}
                                    className={styles.selectInput}
                                >
                                    <option value="All">Semua Status Stok</option>
                                    <option value="Ready">Tersedia (Ready)</option>
                                    <option value="LowStock">Stok Menipis (≤ 2)</option>
                                    <option value="Sold">Terjual / Habis</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        {productsLoading ? (
                            <p style={{ color: 'var(--text-muted)' }}>Memuat produk...</p>
                        ) : filteredProducts.length === 0 ? (
                            <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Tidak ada produk yang sesuai dengan kriteria pencarian.
                            </div>
                        ) : (
                            <div className={styles.tableCard}>
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th>Gambar</th>
                                            <th>Nama Produk</th>
                                            <th>Kategori & Ukuran</th>
                                            <th>Harga</th>
                                            <th>Status Stok</th>
                                            <th style={{ textAlign: 'right' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.map(product => (
                                            <tr key={product.id} className={styles.tableRow}>
                                                <td>
                                                    <div className={styles.productThumb}>
                                                        <Image src={product.image} alt={product.name} fill style={{ objectFit: 'cover' }} />
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: '600' }}>
                                                    <div>{product.name}</div>
                                                    {product.isPremium && (
                                                        <span className={`${styles.badge} ${styles.badgeWarning}`} style={{ marginTop: '0.2rem', fontSize: '0.7rem' }}>
                                                            ★ Premium
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div>{product.form} ({product.gender})</div>
                                                    {product.sizes && (() => {
                                                        try {
                                                            const parsed = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes;
                                                            if (Array.isArray(parsed) && parsed.length > 0) {
                                                                return (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                                        Size: {parsed.map(s => `${s.size} (${s.quantity})`).join(', ')}
                                                                    </div>
                                                                );
                                                            }
                                                        } catch (e) {
                                                            console.error(e);
                                                        }
                                                        return null;
                                                    })()}
                                                </td>
                                                <td style={{ fontWeight: '600' }}>{formattedCurrency(product.price)}</td>
                                                <td>
                                                    {product.quantity > 0 ? (
                                                        <span className={`${styles.badge} ${product.quantity <= 2 ? styles.badgeWarning : styles.badgeSuccess}`}>
                                                            Stok: {product.quantity}
                                                        </span>
                                                    ) : (
                                                        <span className={`${styles.badge} ${styles.badgeMuted}`}>
                                                            Habis
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className={styles.actionGroup}>
                                                        <button 
                                                            onClick={() => openEditProductModal(product)} 
                                                            className={styles.iconBtn}
                                                            title="Edit Produk"
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => confirmDeleteProduct(product)} 
                                                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                                            title="Hapus Produk"
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Users */}
                {activeTab === 'users' && (
                    <div>
                        {/* Controls */}
                        <div className={styles.controlBar}>
                            <div className={styles.searchBox}>
                                <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Cari nama atau email pengguna..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className={styles.searchInput}
                                />
                            </div>

                            <div className={styles.filterGroup}>
                                <select
                                    value={userRoleFilter}
                                    onChange={(e) => setUserRoleFilter(e.target.value)}
                                    className={styles.selectInput}
                                >
                                    <option value="All">Semua Role</option>
                                    <option value="admin">Admin</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        {usersLoading ? (
                            <p style={{ color: 'var(--text-muted)' }}>Memuat pengguna...</p>
                        ) : filteredUsers.length === 0 ? (
                            <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Tidak ada pengguna yang sesuai dengan pencarian.
                            </div>
                        ) : (
                            <div className={styles.tableCard}>
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th>Nama Lengkap</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>No. Telepon</th>
                                            <th style={{ textAlign: 'right' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map(user => (
                                            <tr key={user.id} className={styles.tableRow}>
                                                <td style={{ fontWeight: '600' }}>{user.name}</td>
                                                <td>{user.email}</td>
                                                <td>
                                                    <span className={`${styles.badge} ${user.role === 'admin' ? styles.badgeWarning : styles.badgeInfo}`}>
                                                        {user.role.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>{user.phone || '-'}</td>
                                                <td>
                                                    <div className={styles.actionGroup}>
                                                        <button 
                                                            onClick={() => handleToggleRole(user)} 
                                                            className="btn btn-outline" 
                                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', borderRadius: '8px' }}
                                                        >
                                                            Ubah Role
                                                        </button>
                                                        <button 
                                                            onClick={() => confirmDeleteUser(user)} 
                                                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                                            disabled={user.id === currentUser.id}
                                                            title="Hapus User"
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Transactions */}
                {/* Tab: Events */}
                {activeTab === 'events' && (
                    <div>
                        {/* Controls */}
                        <div className={styles.controlBar}>
                            <div className={styles.searchBox}>
                                <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Cari judul event..."
                                    value={eventSearch}
                                    onChange={(e) => setEventSearch(e.target.value)}
                                    className={styles.searchInput}
                                />
                            </div>
                        </div>

                        {/* Table */}
                        {eventsLoading ? (
                            <p style={{ color: 'var(--text-muted)' }}>Memuat event...</p>
                        ) : filteredEvents.length === 0 ? (
                            <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Belum ada event terdaftar.
                            </div>
                        ) : (
                            <div className={styles.tableCard}>
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th>Banner</th>
                                            <th>Judul Event</th>
                                            <th>Link Target</th>
                                            <th>Jadwal Waktu</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'right' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEvents.map(event => {
                                            const now = new Date();
                                            const start = event.startDate ? new Date(event.startDate) : null;
                                            const end = event.endDate ? new Date(event.endDate) : null;

                                            let timeStatus = 'Sedang Berlangsung';
                                            let badgeStyle = styles.badgeSuccess;

                                            if (!event.isActive) {
                                                timeStatus = 'Nonaktif';
                                                badgeStyle = styles.badgeMuted;
                                            } else if (start && start > now) {
                                                timeStatus = 'Segera Hadir';
                                                badgeStyle = styles.badgeInfo;
                                            } else if (end && end < now) {
                                                timeStatus = 'Sudah Selesai';
                                                badgeStyle = styles.badgeDanger;
                                            }

                                            return (
                                                <tr key={event.id} className={styles.tableRow}>
                                                    <td>
                                                        <div className={styles.eventThumb}>
                                                            <Image src={event.image} alt={event.title} fill style={{ objectFit: 'cover' }} />
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight: '600' }}>
                                                        <div>{event.title}</div>
                                                        {event.subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{event.subtitle}</div>}
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem' }}>
                                                        <a href={event.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                            {event.targetUrl.length > 30 ? `${event.targetUrl.slice(0, 30)}...` : event.targetUrl}
                                                        </a>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                                        <div>Mulai: {start ? start.toLocaleString('id-ID') : 'Langsung'}</div>
                                                        <div>Selesai: {end ? end.toLocaleString('id-ID') : 'Selamanya'}</div>
                                                    </td>
                                                    <td>
                                                        <span className={`${styles.badge} ${badgeStyle}`}>
                                                            {timeStatus}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className={styles.actionGroup}>
                                                            <button 
                                                                onClick={() => openEditEventModal(event)} 
                                                                className={styles.iconBtn}
                                                                title="Edit Event"
                                                            >
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                            <button 
                                                                onClick={() => confirmDeleteEvent(event)} 
                                                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                                                title="Hapus Event"
                                                            >
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal CRUD: Product */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalContainer}>
                        <h3 className={styles.modalTitle}>
                            {isAddModalOpen ? 'Tambah Produk Baru' : 'Edit Detail Produk'}
                        </h3>

                        <form onSubmit={isAddModalOpen ? handleAddProduct : handleEditProductSubmit} className={styles.formGrid}>
                            <div className={styles.formFullWidth}>
                                <label className={styles.formLabel}>Nama Produk</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={productForm.name}
                                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className={styles.formLabel}>Harga (Rupiah)</label>
                                <input
                                    type="number"
                                    className={styles.formInput}
                                    value={productForm.price}
                                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <ManageableSelect
                                    label="Kategori Form"
                                    value={productForm.category}
                                    onChange={(val) => setProductForm({ ...productForm, category: val, form: val })}
                                    options={categories}
                                    setOptions={setCategories}
                                />
                            </div>

                            <div>
                                <ManageableSelect
                                    label="Gender"
                                    value={productForm.gender}
                                    onChange={(val) => setProductForm({ ...productForm, gender: val })}
                                    options={genders}
                                    setOptions={setGenders}
                                />
                            </div>

                            <div>
                                <label className={styles.formLabel}>Corak Warna (Coloration)</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={productForm.coloration}
                                    onChange={(e) => setProductForm({ ...productForm, coloration: e.target.value })}
                                    required
                                />
                            </div>

                            <div className={styles.formFullWidth}>
                                <label className={styles.formLabel} style={{ textAlign: 'center' }}>Foto Produk</label>
                                <div className={styles.uploadBox}>
                                    <div className={styles.previewThumb}>
                                        {productForm.image ? (
                                            <Image src={productForm.image} alt="Preview" fill style={{ objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                                No Image
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e, setProductForm)}
                                            id="product-image-upload"
                                            style={{ display: 'none' }}
                                        />
                                        <label 
                                            htmlFor="product-image-upload" 
                                            className="btn btn-outline" 
                                            style={{ cursor: 'pointer', padding: '0.6rem 1.5rem', fontSize: '0.85rem', borderRadius: '30px' }}
                                        >
                                            {isUploading ? 'Mengunggah...' : 'Pilih Foto dari Komputer'}
                                        </label>
                                        {uploadError && <p style={{ fontSize: '0.75rem', color: '#EF4444' }}>Error: {uploadError}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formFullWidth}>
                                <label className={styles.formLabel}>Deskripsi Produk</label>
                                <textarea
                                    className={styles.formInput}
                                    style={{ minHeight: '80px', resize: 'none' }}
                                    value={productForm.description}
                                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <ManageableSelect
                                    label="Grade Bentuk"
                                    value={productForm.statsForm}
                                    onChange={(val) => setProductForm({ ...productForm, statsForm: val })}
                                    options={grades}
                                    setOptions={setGrades}
                                />
                            </div>

                            <div>
                                <label className={styles.formLabel}>Umur (Age)</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: 4 Month, 5 Bulan"
                                    className={styles.formInput}
                                    value={productForm.age}
                                    onChange={(e) => setProductForm({ ...productForm, age: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Sizes & Stock */}
                            <div className={styles.formFullWidth} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                <label className={styles.formLabel} style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-main)', textAlign: 'center', marginBottom: '1rem' }}>
                                    Kelola Ukuran (Size) & Jumlah Stok
                                </label>
                                <div style={{ background: 'rgba(255,255,255,0.015)', padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {productForm.sizes && productForm.sizes.map((s, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.8rem', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <input
                                                type="text"
                                                placeholder="Size (S, M, L)"
                                                className={styles.formInput}
                                                style={{ flex: '1 1 120px' }}
                                                value={s.size}
                                                onChange={(e) => {
                                                    const newSizes = [...productForm.sizes];
                                                    newSizes[index].size = e.target.value;
                                                    const totalQty = newSizes.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
                                                    setProductForm({ ...productForm, sizes: newSizes, quantity: totalQty });
                                                }}
                                                required
                                            />
                                            <input
                                                type="number"
                                                placeholder="Stok"
                                                className={styles.formInput}
                                                style={{ flex: '1 1 120px' }}
                                                value={s.quantity}
                                                min="0"
                                                onChange={(e) => {
                                                    const newSizes = [...productForm.sizes];
                                                    newSizes[index].quantity = parseInt(e.target.value) || 0;
                                                    const totalQty = newSizes.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
                                                    setProductForm({ ...productForm, sizes: newSizes, quantity: totalQty });
                                                }}
                                                required
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-outline"
                                                style={{ color: '#EF4444', borderColor: '#EF4444', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}
                                                onClick={() => {
                                                    const newSizes = productForm.sizes.filter((_, idx) => idx !== index);
                                                    const totalQty = newSizes.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
                                                    setProductForm({ ...productForm, sizes: newSizes, quantity: totalQty });
                                                }}
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ width: '100%', maxWidth: '300px', fontSize: '0.85rem', padding: '0.75rem', borderRadius: '30px', marginTop: productForm.sizes?.length > 0 ? '0.5rem' : 0 }}
                                        onClick={() => {
                                            const newSizes = [...(productForm.sizes || []), { size: '', quantity: 1 }];
                                            const totalQty = newSizes.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
                                            setProductForm({ ...productForm, sizes: newSizes, quantity: totalQty });
                                        }}
                                    >
                                        + Tambah Baris Size & Stok
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className={styles.formLabel}>Total Jumlah Produk (Dihitung Otomatis)</label>
                                <input
                                    type="number"
                                    className={styles.formInput}
                                    style={{ opacity: 0.7 }}
                                    value={productForm.sizes?.length > 0 ? productForm.quantity : (productForm.quantity || 0)}
                                    onChange={(e) => {
                                        if (!productForm.sizes || productForm.sizes.length === 0) {
                                            setProductForm({ ...productForm, quantity: parseInt(e.target.value) || 0 });
                                        }
                                    }}
                                    readOnly={productForm.sizes?.length > 0}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.2rem' }}>
                                <input
                                    type="checkbox"
                                    id="isPremiumCheck"
                                    checked={productForm.isPremium}
                                    onChange={(e) => setProductForm({ ...productForm, isPremium: e.target.checked })}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="isPremiumCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>Ikan Premium</label>
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAddModalOpen(false);
                                        setIsEditModalOpen(false);
                                    }}
                                    className="btn btn-outline"
                                    style={{ flex: 1, padding: '0.9rem', borderRadius: '30px' }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '0.9rem', borderRadius: '30px' }}
                                >
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal CRUD: Event */}
            {(isEventAddModalOpen || isEventEditModalOpen) && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalContainer}>
                        <h3 className={styles.modalTitle}>
                            {isEventAddModalOpen ? 'Tambah Event Baru' : 'Edit Detail Event'}
                        </h3>

                        <form onSubmit={isEventAddModalOpen ? handleAddEvent : handleEditEventSubmit} className={styles.formGrid}>
                            <div className={styles.formFullWidth}>
                                <label className={styles.formLabel}>Judul Event / Promo</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: TikTok Shop Live Streaming"
                                    className={styles.formInput}
                                    value={eventForm.title}
                                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className={styles.formFullWidth}>
                                <label className={styles.formLabel}>Subjudul Event (Opsional)</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Dapatkan diskon 50% dan gift menarik selama live!"
                                    className={styles.formInput}
                                    value={eventForm.subtitle}
                                    onChange={(e) => setEventForm({ ...eventForm, subtitle: e.target.value })}
                                />
                            </div>

                            <div className={styles.formFullWidth}>
                                <label className={styles.formLabel}>Deskripsi Event</label>
                                <textarea
                                    placeholder="Jelaskan detail event Anda..."
                                    className={styles.formInput}
                                    style={{ minHeight: '80px', resize: 'none' }}
                                    value={eventForm.description}
                                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className={styles.formLabel}>Link Target (URL)</label>
                                <input
                                    type="url"
                                    placeholder="Contoh: https://tiktok.com/@sumdebetta/live"
                                    className={styles.formInput}
                                    value={eventForm.targetUrl}
                                    onChange={(e) => setEventForm({ ...eventForm, targetUrl: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className={styles.formLabel}>Teks Tombol (Button Text)</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Gabung Live, Beli Sekarang"
                                    className={styles.formInput}
                                    value={eventForm.buttonText}
                                    onChange={(e) => setEventForm({ ...eventForm, buttonText: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className={styles.formLabel}>Waktu Mulai (Opsional)</label>
                                <input
                                    type="datetime-local"
                                    className={styles.formInput}
                                    value={eventForm.startDate}
                                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className={styles.formLabel}>Waktu Selesai (Opsional)</label>
                                <input
                                    type="datetime-local"
                                    className={styles.formInput}
                                    value={eventForm.endDate}
                                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                                />
                            </div>

                            <div className={styles.formFullWidth}>
                                <label className={styles.formLabel} style={{ textAlign: 'center' }}>Banner / Gambar Promosi</label>
                                <div className={styles.uploadBox}>
                                    <div className={styles.eventPreviewThumb}>
                                        {eventForm.image ? (
                                            <Image src={eventForm.image} alt="Preview Banner" fill style={{ objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                                No Image Preview
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e, setEventForm)}
                                            id="event-image-upload"
                                            style={{ display: 'none' }}
                                        />
                                        <label 
                                            htmlFor="event-image-upload" 
                                            className="btn btn-outline" 
                                            style={{ cursor: 'pointer', padding: '0.6rem 1.5rem', fontSize: '0.85rem', borderRadius: '30px' }}
                                        >
                                            {isUploading ? 'Mengunggah...' : 'Pilih Banner dari Komputer'}
                                        </label>
                                        {uploadError && <p style={{ fontSize: '0.75rem', color: '#EF4444' }}>Error: {uploadError}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formFullWidth} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.2rem' }}>
                                <input
                                    type="checkbox"
                                    id="isEventActiveCheck"
                                    checked={eventForm.isActive}
                                    onChange={(e) => setEventForm({ ...eventForm, isActive: e.target.checked })}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="isEventActiveCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>Event Aktif (Ditampilkan di Website)</label>
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEventAddModalOpen(false);
                                        setIsEventEditModalOpen(false);
                                    }}
                                    className="btn btn-outline"
                                    style={{ flex: 1, padding: '0.9rem', borderRadius: '30px' }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '0.9rem', borderRadius: '30px' }}
                                >
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Confirmation Modal */}
            {confirmModal.isOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.confirmModal}>
                        <div className={styles.confirmIcon}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </div>
                        <h4 className={styles.confirmTitle}>{confirmModal.title}</h4>
                        <p className={styles.confirmDesc}>{confirmModal.desc}</p>
                        <div className={styles.confirmActions}>
                            <button
                                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                className="btn btn-outline"
                                style={{ flex: 1, borderRadius: '30px', padding: '0.75rem' }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirmModal.onConfirm) {
                                        await confirmModal.onConfirm();
                                    }
                                    setConfirmModal({ ...confirmModal, isOpen: false });
                                }}
                                className="btn btn-primary"
                                style={{ 
                                    flex: 1, 
                                    borderRadius: '30px', 
                                    padding: '0.75rem', 
                                    background: confirmModal.isDanger !== false ? '#EF4444' : 'var(--primary)', 
                                    borderColor: confirmModal.isDanger !== false ? '#EF4444' : 'var(--primary)', 
                                    color: '#fff' 
                                }}
                            >
                                {confirmModal.confirmText || 'Hapus Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
