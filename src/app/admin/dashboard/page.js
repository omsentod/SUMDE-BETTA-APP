'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Custom Styled and Manageable Dropdown Component (CRUD)
function ManageableSelect({ label, value, onChange, options, setOptions, defaultOptions }) {
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
        // Case-insensitive check
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
        if (confirm(`Apakah Anda yakin ingin menghapus opsi "${opt}" dari daftar?`)) {
            if (opt === value) {
                const remaining = options.filter(o => o !== opt);
                if (remaining.length > 0) {
                    onChange(remaining[0]);
                } else {
                    onChange('');
                }
            }
            setOptions(options.filter(o => o !== opt));
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{label}</label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`manageable-select-trigger ${isOpen ? 'open' : ''}`}
            >
                <span>{value || '-- Pilih --'}</span>
                <span style={{ fontSize: '0.65rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }}>▼</span>
            </div>

            {isOpen && (
                <div className="manageable-select-dropdown">
                    <div className="manageable-select-header">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pilih Opsi</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDeleteMode(!isDeleteMode);
                            }}
                            className={`manageable-select-edit-btn ${isDeleteMode ? 'active' : ''}`}
                        >
                            {isDeleteMode ? 'Selesai Edit' : 'Edit List ⚙️'}
                        </button>
                    </div>

                    <div className="manageable-select-list">
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
                                    className={`manageable-select-item ${isSelected ? 'selected' : ''}`}
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
                                                color: '#ff4d4f',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                padding: '0.2rem 0.5rem',
                                                opacity: 0.8,
                                                transition: 'opacity 0.2s, transform 0.2s'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'scale(1.1)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.8; e.currentTarget.style.transform = 'scale(1)'; }}
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="manageable-select-footer">
                        <input
                            type="text"
                            placeholder="Tambah opsi baru..."
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            className="manageable-select-input"
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
                            style={{
                                background: 'var(--primary)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'black',
                                padding: '0.45rem 0.8rem',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = 0.9}
                            onMouseLeave={(e) => e.target.style.opacity = 1}
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
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [eventsLoading, setEventsLoading] = useState(false);

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

    // Form inputs for CRUD
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

    const handleFileUpload = async (e) => {
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
            if (!res.ok) {
                throw new Error(data.error || 'Gagal mengunggah gambar.');
            }

            setProductForm(prev => ({ ...prev, image: data.url }));
        } catch (err) {
            console.error(err);
            setUploadError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Protect Route
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || currentUser.role !== 'admin') {
                router.push('/login');
            }
        }
    }, [currentUser, authLoading, router]);

    // Load users & orders
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
        setOrdersLoading(true);
        try {
            const res = await fetch('/api/orders');
            if (res.ok) setOrders(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setOrdersLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser && currentUser.role === 'admin') {
            if (activeTab === 'users') loadUsers();
            if (activeTab === 'transactions') loadOrders();
            if (activeTab === 'events') loadEvents();
        }
    }, [activeTab, currentUser]);

    // Load events
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

    // Handle event file upload
    const handleEventFileUpload = async (e) => {
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
            if (!res.ok) {
                throw new Error(data.error || 'Gagal mengunggah gambar.');
            }

            setEventForm(prev => ({ ...prev, image: data.url }));
        } catch (err) {
            console.error(err);
            setUploadError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Handle event submit (Create)
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

    // Handle event update (Edit)
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

    // Handle event delete
    const handleDeleteEvent = async (id) => {
        if (!confirm('Apakah Anda yakin ingin menghapus event ini?')) return;
        try {
            const res = await fetch(`/api/events?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal menghapus event.');
            setEvents(prev => prev.filter(ev => ev.id !== id));
        } catch (err) {
            alert(err.message);
        }
    };

    // Open Edit Event Modal
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

    // Reset Event Form
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

    // Handle user toggle role
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

    // Handle user delete
    const handleDeleteUser = async (id) => {
        if (id === currentUser.id) {
            alert('Anda tidak bisa menghapus akun Anda sendiri.');
            return;
        }
        if (!confirm('Apakah Anda yakin ingin menghapus user ini?')) return;

        try {
            const res = await fetch(`/api/users?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Handle product submit
    const handleAddProduct = async (e) => {
        e.preventDefault();
        try {
            await addProduct(productForm);
            setIsAddModalOpen(false);
            resetForm();
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
            resetForm();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
        try {
            await deleteProduct(id);
        } catch (err) {
            alert(err.message);
        }
    };

    const openEditModal = (product) => {
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

    const resetForm = () => {
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
        <div className="pageContainer" style={{ paddingTop: '100px', minHeight: '100vh' }}>
            <div className="container" style={{ paddingBottom: '5rem' }}>
                {/* Header Dashboard */}
                <div className="dashboard-header">
                    <div>
                        <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                            Otoritas Tertinggi
                        </span>
                        <h1>
                            Admin Dashboard
                        </h1>
                    </div>
                    <div className="dashboard-header-buttons">
                        <button
                            onClick={() => {
                                setIsAddModalOpen(true);
                                resetForm();
                            }}
                            className="btn btn-primary"
                            style={{ display: activeTab === 'products' ? 'block' : 'none' }}
                        >
                            + Tambah Produk
                        </button>
                        <button
                            onClick={() => {
                                setIsEventAddModalOpen(true);
                                resetEventForm();
                            }}
                            className="btn btn-primary"
                            style={{ display: activeTab === 'events' ? 'block' : 'none' }}
                        >
                            + Tambah Event
                        </button>
                    </div>
                </div>

                {/* Tab Navigator */}
                <div className="dashboard-tabs">
                    {[
                        { id: 'products', name: 'Kelola Produk' },
                        { id: 'users', name: 'Kelola User' },
                        { id: 'transactions', name: 'Daftar Transaksi' },
                        { id: 'events', name: 'Kelola Event' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: activeTab === tab.id ? '700' : '500',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                paddingBottom: '1rem',
                                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
                                marginBottom: '-1.1rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Tab Contents: Kelola Produk */}
                {activeTab === 'products' && (
                    <div>
                        {productsLoading ? (
                            <p style={{ color: 'var(--text-muted)' }}>Memuat produk...</p>
                        ) : products.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>Belum ada produk terdaftar di database.</p>
                        ) : (
                            <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text-main)' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                                            <th style={{ padding: '1.2rem' }}>Gambar</th>
                                            <th style={{ padding: '1.2rem' }}>Nama</th>
                                            <th style={{ padding: '1.2rem' }}>Kategori</th>
                                            <th style={{ padding: '1.2rem' }}>Harga</th>
                                            <th style={{ padding: '1.2rem' }}>Status</th>
                                            <th style={{ padding: '1.2rem', textAlign: 'right' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map(product => (
                                            <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                                                <td style={{ padding: '1rem 1.2rem' }}>
                                                    <div style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden' }}>
                                                        <Image src={product.image} alt={product.name} fill style={{ objectFit: 'cover' }} />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.2rem', fontWeight: '600' }}>{product.name}</td>
                                                <td style={{ padding: '1.2rem' }}>
                                                    <div>{product.form} ({product.gender})</div>
                                                    {product.sizes && (() => {
                                                        try {
                                                            const parsed = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes;
                                                            if (Array.isArray(parsed) && parsed.length > 0) {
                                                                return (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                                        Sizes: {parsed.map(s => `${s.size} (stok:${s.quantity})`).join(', ')}
                                                                    </div>
                                                                );
                                                            }
                                                        } catch (e) {
                                                            console.error(e);
                                                        }
                                                        return null;
                                                    })()}
                                                </td>
                                                <td style={{ padding: '1.2rem' }}>{formattedCurrency(product.price)}</td>
                                                <td style={{ padding: '1.2rem' }}>
                                                    {product.quantity > 0 ? (
                                                        <span style={{ color: '#10B981', fontSize: '0.85rem', padding: '0.2rem 0.6rem', border: '1px solid #10B981', borderRadius: '4px' }}>Ready (Stok: {product.quantity})</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>Terjual</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1.2rem', textAlign: 'right' }}>
                                                    <button onClick={() => openEditModal(product)} className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', marginRight: '0.5rem', borderRadius: '6px' }}>Edit</button>
                                                    <button onClick={() => handleDeleteProduct(product.id)} className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '6px' }}>Hapus</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Contents: Kelola User */}
                {activeTab === 'users' && (
                    <div>
                        {usersLoading ? (
                            <p style={{ color: 'var(--text-muted)' }}>Memuat pengguna...</p>
                        ) : (
                            <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text-main)' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                                            <th style={{ padding: '1.2rem' }}>Nama</th>
                                            <th style={{ padding: '1.2rem' }}>Email</th>
                                            <th style={{ padding: '1.2rem' }}>Role</th>
                                            <th style={{ padding: '1.2rem' }}>Kontak</th>
                                            <th style={{ padding: '1.2rem', textAlign: 'right' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '1.2rem', fontWeight: '600' }}>{user.name}</td>
                                                <td style={{ padding: '1.2rem' }}>{user.email}</td>
                                                <td style={{ padding: '1.2rem', textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 'bold', color: user.role === 'admin' ? 'var(--primary)' : 'var(--secondary)' }}>{user.role}</td>
                                                <td style={{ padding: '1.2rem', color: 'var(--text-muted)' }}>{user.phone || '-'}</td>
                                                <td style={{ padding: '1.2rem', textAlign: 'right' }}>
                                                    <button onClick={() => handleToggleRole(user)} className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', marginRight: '0.5rem', borderRadius: '6px' }}>Ubah Role</button>
                                                    <button onClick={() => handleDeleteUser(user.id)} className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '6px' }} disabled={user.id === currentUser.id}>Hapus</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Contents: Daftar Transaksi */}
                {activeTab === 'transactions' && (
                    <div>
                        {ordersLoading ? (
                            <p style={{ color: 'var(--text-muted)' }}>Memuat transaksi...</p>
                        ) : orders.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>Belum ada transaksi pembelian tercatat.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {orders.map(order => (
                                    <div key={order.id} style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                                            <div>
                                                <h4 style={{ fontSize: '1.1rem', margin: 0 }}>Pesanan #{order.id.slice(0, 8)}</h4>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleString()}</span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{
                                                    fontSize: '0.85rem',
                                                    padding: '0.2rem 0.8rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid',
                                                    color: order.status === 'PAID' ? '#10B981' : '#F59E0B',
                                                    borderColor: order.status === 'PAID' ? '#10B981' : '#F59E0B',
                                                    fontWeight: '600'
                                                }}>{order.status}</span>
                                            </div>
                                        </div>

                                        <div className="grid-transaction-inner">
                                            <div>
                                                <h5 style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--primary)', letterSpacing: '0.1rem', marginBottom: '1rem' }}>Produk Dibeli</h5>
                                                {order.items.map(item => (
                                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                                        <span>{item.product?.name || 'Produk dihapus'} (x{item.quantity})</span>
                                                        <span>{formattedCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', fontWeight: '700' }}>
                                                    <span>Total</span>
                                                    <span>{formattedCurrency(order.total)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <h5 style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--primary)', letterSpacing: '0.1rem', marginBottom: '1rem' }}>Pelanggan & Pengiriman</h5>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                                    <p style={{ color: 'var(--text-main)', fontWeight: '600' }}>{order.name}</p>
                                                    <p>Email: {order.email}</p>
                                                    <p>Telp: {order.phone}</p>
                                                    <p>Alamat: {order.streetAddress}, {order.rtRw}, Kel. {order.village}, Kec. {order.district}, {order.city}, {order.province}, {order.postalCode}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Contents: Kelola Event */}
                {activeTab === 'events' && (
                    <div>
                        {eventsLoading ? (
                            <p style={{ color: 'var(--text-muted)' }}>Memuat event...</p>
                        ) : events.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>Belum ada event terdaftar di database.</p>
                        ) : (
                            <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text-main)' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                                            <th style={{ padding: '1.2rem' }}>Banner</th>
                                            <th style={{ padding: '1.2rem' }}>Judul</th>
                                            <th style={{ padding: '1.2rem' }}>Link Target</th>
                                            <th style={{ padding: '1.2rem' }}>Jadwal Waktu</th>
                                            <th style={{ padding: '1.2rem' }}>Status</th>
                                            <th style={{ padding: '1.2rem', textAlign: 'right' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.map(event => {
                                            const now = new Date();
                                            const start = event.startDate ? new Date(event.startDate) : null;
                                            const end = event.endDate ? new Date(event.endDate) : null;
                                            
                                            let timeStatus = 'Sedang Berlangsung';
                                            let statusColor = '#10B981'; // Green
                                            
                                            if (!event.isActive) {
                                                timeStatus = 'Nonaktif';
                                                statusColor = 'var(--text-muted)';
                                            } else if (start && start > now) {
                                                timeStatus = 'Segera Hadir';
                                                statusColor = '#3B82F6'; // Blue
                                            } else if (end && end < now) {
                                                timeStatus = 'Sudah Selesai';
                                                statusColor = '#EF4444'; // Red
                                            }

                                            return (
                                                <tr key={event.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                                                    <td style={{ padding: '1rem 1.2rem' }}>
                                                        <div style={{ position: 'relative', width: '80px', height: '45px', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <Image src={event.image} alt={event.title} fill style={{ objectFit: 'cover' }} />
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1.2rem', fontWeight: '600' }}>
                                                        <div>{event.title}</div>
                                                        {event.subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{event.subtitle}</div>}
                                                    </td>
                                                    <td style={{ padding: '1.2rem', fontSize: '0.85rem' }}>
                                                        <a href={event.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                            {event.targetUrl.length > 30 ? `${event.targetUrl.slice(0, 30)}...` : event.targetUrl}
                                                        </a>
                                                    </td>
                                                    <td style={{ padding: '1.2rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                                        <div>Mulai: {start ? start.toLocaleString('id-ID') : 'Langsung'}</div>
                                                        <div>Selesai: {end ? end.toLocaleString('id-ID') : 'Selamanya'}</div>
                                                    </td>
                                                    <td style={{ padding: '1.2rem' }}>
                                                        <span style={{ color: statusColor, fontSize: '0.85rem', padding: '0.2rem 0.6rem', border: `1px solid ${statusColor}`, borderRadius: '4px' }}>
                                                            {timeStatus}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1.2rem', textAlign: 'right' }}>
                                                        <button onClick={() => openEditEventModal(event)} className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', marginRight: '0.5rem', borderRadius: '6px' }}>Edit</button>
                                                        <button onClick={() => handleDeleteEvent(event.id)} className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '6px' }}>Hapus</button>
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

            {/* Modal CRUD: Add/Edit Product */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div className="modal-backdrop">
                    <div className="modal-container">
                        <h3 style={{ 
                            fontFamily: 'var(--font-serif)', 
                            fontSize: '2.2rem', 
                            fontStyle: 'italic', 
                            marginBottom: '2rem', 
                            color: 'var(--text-main)',
                            textAlign: 'center'
                        }}>
                            {isAddModalOpen ? 'Tambah Produk Baru' : 'Edit Detail Produk'}
                        </h3>

                        <form onSubmit={isAddModalOpen ? handleAddProduct : handleEditProductSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nama Produk</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={productForm.name}
                                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Harga (Rupiah)</label>
                                <input
                                    type="number"
                                    className="search-input"
                                    style={{ width: '100%' }}
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
                                    defaultOptions={defaultCategories}
                                />
                            </div>

                            <div>
                                <ManageableSelect
                                    label="Gender"
                                    value={productForm.gender}
                                    onChange={(val) => setProductForm({ ...productForm, gender: val })}
                                    options={genders}
                                    setOptions={setGenders}
                                    defaultOptions={defaultGenders}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Corak Warna (Coloration)</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={productForm.coloration}
                                    onChange={(e) => setProductForm({ ...productForm, coloration: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center' }}>Foto Produk</label>
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    gap: '1.5rem', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.02)', 
                                    padding: '2rem 1.5rem', 
                                    borderRadius: '16px', 
                                    border: '1px dashed var(--border-color)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ 
                                        position: 'relative', 
                                        width: '150px', 
                                        height: '150px', 
                                        borderRadius: '12px', 
                                        overflow: 'hidden', 
                                        background: 'rgba(255,255,255,0.05)',
                                        boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                                        flexShrink: 0
                                    }}>
                                        {productForm.image ? (
                                            <Image 
                                                src={productForm.image} 
                                                alt="Preview" 
                                                fill 
                                                style={{ objectFit: 'cover' }} 
                                            />
                                        ) : (
                                            <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                height: '100%', 
                                                color: 'var(--text-muted)' 
                                            }}>
                                                No Image
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            id="product-image-upload"
                                            style={{ display: 'none' }}
                                        />
                                        <label 
                                            htmlFor="product-image-upload" 
                                            className="btn btn-outline" 
                                            style={{ 
                                                display: 'inline-block', 
                                                cursor: 'pointer', 
                                                padding: '0.6rem 1.5rem', 
                                                fontSize: '0.85rem',
                                                borderRadius: '30px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {isUploading ? 'Mengunggah...' : 'Pilih Foto dari Komputer'}
                                        </label>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
                                            Format yang didukung: JPG, PNG, GIF, WEBP. Maksimal 20MB.
                                        </p>
                                        {uploadError && (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--primary)', margin: '0.25rem 0 0 0' }}>
                                                Error: {uploadError}
                                            </p>
                                        )}
                                        <input 
                                            type="hidden" 
                                            value={productForm.image} 
                                            required 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Deskripsi Produk</label>
                                <textarea
                                    className="search-input"
                                    style={{ width: '100%', minHeight: '80px', resize: 'none' }}
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
                                    defaultOptions={defaultGrades}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Umur (Age)</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: 4 Month, 5 Bulan"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={productForm.age}
                                    onChange={(e) => setProductForm({ ...productForm, age: e.target.value })}
                                    required
                                />
                            </div>


                            {/* Sizes and Stock Management Section */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '1rem', textAlign: 'center' }}>Kelola Ukuran (Size) & Jumlah Stok</label>
                                <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1.5rem 1rem', border: '1px dashed var(--border-color)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {productForm.sizes && productForm.sizes.map((s, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.8rem', alignItems: 'center', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <input
                                                type="text"
                                                placeholder="Size (S, M, L)"
                                                className="search-input"
                                                style={{ flex: '1 1 120px', minWidth: '80px', margin: 0 }}
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
                                                className="search-input"
                                                style={{ flex: '1 1 120px', minWidth: '80px', margin: 0 }}
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
                                                style={{ color: 'var(--primary)', borderColor: 'var(--primary)', padding: '0.6rem 1.2rem', borderRadius: '8px', fontSize: '0.85rem', flexShrink: 0 }}
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
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Jumlah Produk (Dihitung Otomatis)</label>
                                <input
                                    type="number"
                                    className="search-input"
                                    style={{ width: '100%', opacity: 0.7 }}
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
                                    className="checkboxInput"
                                    id="isPremiumCheck"
                                    checked={productForm.isPremium}
                                    onChange={(e) => setProductForm({ ...productForm, isPremium: e.target.checked })}
                                />
                                <label htmlFor="isPremiumCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>Ikan Premium</label>
                            </div>

                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '2rem' }}>
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

            {/* Modal CRUD: Add/Edit Event */}
            {(isEventAddModalOpen || isEventEditModalOpen) && (
                <div className="modal-backdrop">
                    <div className="modal-container">
                        <h3 style={{ 
                            fontFamily: 'var(--font-serif)', 
                            fontSize: '2.2rem', 
                            fontStyle: 'italic', 
                            marginBottom: '2rem', 
                            color: 'var(--text-main)',
                            textAlign: 'center'
                        }}>
                            {isEventAddModalOpen ? 'Tambah Event Baru' : 'Edit Detail Event'}
                        </h3>

                        <form onSubmit={isEventAddModalOpen ? handleAddEvent : handleEditEventSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Judul Event / Promo</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: TikTok Shop Live Streaming"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={eventForm.title}
                                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Subjudul Event (Opsional)</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Dapatkan diskon 50% dan gift menarik selama live!"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={eventForm.subtitle}
                                    onChange={(e) => setEventForm({ ...eventForm, subtitle: e.target.value })}
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Deskripsi Event</label>
                                <textarea
                                    placeholder="Jelaskan detail event Anda..."
                                    className="search-input"
                                    style={{ width: '100%', minHeight: '80px', resize: 'none' }}
                                    value={eventForm.description}
                                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Link Target (URL)</label>
                                <input
                                    type="url"
                                    placeholder="Contoh: https://tiktok.com/@sumdebetta/live"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={eventForm.targetUrl}
                                    onChange={(e) => setEventForm({ ...eventForm, targetUrl: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Teks Tombol (Button Text)</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Gabung Live, Beli Sekarang"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={eventForm.buttonText}
                                    onChange={(e) => setEventForm({ ...eventForm, buttonText: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Waktu Mulai (Opsional)</label>
                                <input
                                    type="datetime-local"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={eventForm.startDate}
                                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Waktu Selesai (Opsional)</label>
                                <input
                                    type="datetime-local"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={eventForm.endDate}
                                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center' }}>Banner / Gambar Promosi</label>
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    gap: '1.5rem', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.02)', 
                                    padding: '2rem 1.5rem', 
                                    borderRadius: '16px', 
                                    border: '1px dashed var(--border-color)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ 
                                        position: 'relative', 
                                        width: '240px', 
                                        height: '135px', 
                                        borderRadius: '12px', 
                                        overflow: 'hidden', 
                                        background: 'rgba(255,255,255,0.05)',
                                        boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                                        flexShrink: 0
                                    }}>
                                        {eventForm.image ? (
                                            <Image 
                                                src={eventForm.image} 
                                                alt="Preview Banner" 
                                                fill 
                                                style={{ objectFit: 'cover' }} 
                                            />
                                        ) : (
                                            <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                height: '100%', 
                                                color: 'var(--text-muted)' 
                                            }}>
                                                No Image Preview
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleEventFileUpload}
                                            id="event-image-upload"
                                            style={{ display: 'none' }}
                                        />
                                        <label 
                                            htmlFor="event-image-upload" 
                                            className="btn btn-outline" 
                                            style={{ 
                                                display: 'inline-block', 
                                                cursor: 'pointer', 
                                                padding: '0.6rem 1.5rem', 
                                                fontSize: '0.85rem',
                                                borderRadius: '30px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {isUploading ? 'Mengunggah...' : 'Pilih Banner dari Komputer'}
                                        </label>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
                                            Format yang didukung: JPG, PNG, GIF, WEBP. Maksimal 20MB.
                                        </p>
                                        {uploadError && (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--primary)', margin: '0.25rem 0 0 0' }}>
                                                Error: {uploadError}
                                            </p>
                                        )}
                                        <input 
                                            type="hidden" 
                                            value={eventForm.image} 
                                            required 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.2rem', gridColumn: '1 / -1' }}>
                                <input
                                    type="checkbox"
                                    className="checkboxInput"
                                    id="isEventActiveCheck"
                                    checked={eventForm.isActive}
                                    onChange={(e) => setEventForm({ ...eventForm, isActive: e.target.checked })}
                                />
                                <label htmlFor="isEventActiveCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>Event Aktif (Ditampilkan di Website)</label>
                            </div>

                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '2rem' }}>
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
        </div>
    );
}
