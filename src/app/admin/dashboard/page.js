'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const CATEGORIES = ['Plakat', 'Halfmoon', 'Crowntail', 'Giant', 'Double Tail', 'Dumbo Ear'];
const GENDERS = ['Male', 'Female', 'Pair'];

export default function AdminDashboard() {
    const { currentUser, isLoading: authLoading } = useAuth();
    const { products, addProduct, updateProduct, deleteProduct, isLoading: productsLoading } = useProducts();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('products'); // 'products' | 'users' | 'transactions'
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [ordersLoading, setOrdersLoading] = useState(false);

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
        statsForm: '9.0/10',
        statsColor: '9.0/10',
        statsSpirit: 'Aktif'
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
        }
    }, [activeTab, currentUser]);

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
            statsForm: product.statsForm,
            statsColor: product.statsColor,
            statsSpirit: product.statsSpirit
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
            statsForm: '9.0/10',
            statsColor: '9.0/10',
            statsSpirit: 'Aktif'
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
                    <div>
                        <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                            Otoritas Tertinggi
                        </span>
                        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', fontStyle: 'italic', marginTop: '0.5rem', color: 'var(--text-main)' }}>
                            Admin Dashboard
                        </h1>
                    </div>
                    <div>
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
                    </div>
                </div>

                {/* Tab Navigator */}
                <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '3rem', paddingBottom: '1rem' }}>
                    {[
                        { id: 'products', name: 'Kelola Produk' },
                        { id: 'users', name: 'Kelola User' },
                        { id: 'transactions', name: 'Daftar Transaksi' }
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
                                                <td style={{ padding: '1.2rem' }}>{product.form} ({product.gender})</td>
                                                <td style={{ padding: '1.2rem' }}>{formattedCurrency(product.price)}</td>
                                                <td style={{ padding: '1.2rem' }}>
                                                    {product.isSold ? (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>Terjual</span>
                                                    ) : (
                                                        <span style={{ color: '#10B981', fontSize: '0.85rem', padding: '0.2rem 0.6rem', border: '1px solid #10B981', borderRadius: '4px' }}>Ready</span>
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

                                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
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
            </div>

            {/* Modal CRUD: Add/Edit Product */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2000,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifycontent: 'center',
                    padding: '2rem',
                    overflowY: 'auto'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        padding: '2.5rem',
                        width: '100%',
                        maxWidth: '650px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        position: 'relative',
                        margin: 'auto'
                    }}>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontStyle: 'italic', marginBottom: '2rem', color: 'var(--text-main)' }}>
                            {isAddModalOpen ? 'Tambah Produk Baru' : 'Edit Detail Produk'}
                        </h3>

                        <form onSubmit={isAddModalOpen ? handleAddProduct : handleEditProductSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
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
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Kategori Form</label>
                                <select
                                    className="sortSelect"
                                    value={productForm.category}
                                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value, form: e.target.value })}
                                >
                                    {CATEGORIES.map(cat => <option key={cat} value={cat} className="sortOption">{cat}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Gender</label>
                                <select
                                    className="sortSelect"
                                    value={productForm.gender}
                                    onChange={(e) => setProductForm({ ...productForm, gender: e.target.value })}
                                >
                                    {GENDERS.map(g => <option key={g} value={g} className="sortOption">{g}</option>)}
                                </select>
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
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Foto Produk</label>
                                <div style={{ 
                                    display: 'flex', 
                                    gap: '1.5rem', 
                                    alignItems: 'center', 
                                    background: 'rgba(255,255,255,0.02)', 
                                    padding: '1.2rem', 
                                    borderRadius: '12px', 
                                    border: '1px dashed var(--border-color)' 
                                }}>
                                    <div style={{ 
                                        position: 'relative', 
                                        width: '100px', 
                                        height: '100px', 
                                        borderRadius: '8px', 
                                        overflow: 'hidden', 
                                        background: 'rgba(255,255,255,0.05)',
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
                                    <div style={{ flexGrow: 1 }}>
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
                                                padding: '0.5rem 1rem', 
                                                fontSize: '0.85rem',
                                                borderRadius: '6px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {isUploading ? 'Mengunggah...' : 'Pilih Foto dari Komputer'}
                                        </label>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                                            Format yang didukung: JPG, PNG, GIF, WEBP. Maksimal 20MB.
                                        </p>
                                        {uploadError && (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>
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
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Grade Bentuk (Form Stats)</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={productForm.statsForm}
                                    onChange={(e) => setProductForm({ ...productForm, statsForm: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Grade Warna (Color Stats)</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={productForm.statsColor}
                                    onChange={(e) => setProductForm({ ...productForm, statsColor: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Kondisi Mental (Spirit Stats)</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={productForm.statsSpirit}
                                    onChange={(e) => setProductForm({ ...productForm, statsSpirit: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                                    style={{ flex: 1, padding: '0.9rem' }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '0.9rem' }}
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
