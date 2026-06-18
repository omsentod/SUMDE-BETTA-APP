'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CustomerDashboard() {
    const { currentUser, isLoading: authLoading, updateUserProfile } = useAuth();
    const router = useRouter();

    const [form, setForm] = useState({ name: '', phone: '' });
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!authLoading) {
            if (!currentUser) {
                router.push('/login');
            } else {
                setForm({ name: currentUser.name || '', phone: currentUser.phone || '' });
            }
        }
    }, [currentUser, authLoading, router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccess(false); setError(''); setSaving(true);
        try {
            await updateUserProfile(form);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err.message || 'Gagal menyimpan profil.');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || !currentUser) {
        return (
            <div className="pageContainer" style={{ paddingTop: '120px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--text-muted)' }}>Memverifikasi akun...</h2>
            </div>
        );
    }

    const inputStyle = { width: '100%', padding: '0.75rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '0.5rem', color: 'var(--text-main)', fontSize: '0.95rem', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' };

    const shortcuts = [
        { href: '/customer/addresses', icon: '📍', title: 'Alamat Saya', desc: 'Kelola alamat pengiriman tersimpan' },
        { href: '/customer/orders',    icon: '📦', title: 'Pesanan Saya', desc: 'Lacak status pesanan kamu' },
    ];

    return (
        <div className="pageContainer" style={{ paddingTop: '100px', minHeight: '100vh' }}>
            <div className="container" style={{ maxWidth: '700px', paddingBottom: '5rem' }}>

                {/* Header */}
                <div style={{ marginBottom: '2.5rem' }}>
                    <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Customer Area</span>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontStyle: 'italic', marginTop: '0.4rem', color: 'var(--text-main)' }}>
                        Halo, {currentUser.name.split(' ')[0]}
                    </h1>
                </div>

                {/* Shortcut Cards */}
                <div className="grid-shortcut">
                    {shortcuts.map(s => (
                        <Link key={s.href} href={s.href} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'border-color 0.2s, transform 0.2s', textDecoration: 'none !important' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <span style={{ fontSize: '2rem' }}>{s.icon}</span>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>{s.title}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.desc}</span>
                        </Link>
                    ))}
                </div>

                {/* Edit Profile Form */}
                <div className="dashboard-card">
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontStyle: 'italic', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Edit Profil</h3>

                    {success && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid #10B981', borderRadius: '8px', color: '#10B981', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Profil berhasil diperbarui!
                        </div>
                    )}
                    {error && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: '8px', color: '#EF4444', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <input style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} value={currentUser.email} readOnly />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>Email tidak dapat diubah</span>
                        </div>
                        <div>
                            <label style={labelStyle}>Nama Lengkap</label>
                            <input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Nama lengkap kamu" />
                        </div>
                        <div>
                            <label style={labelStyle}>Nomor Telepon</label>
                            <input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ cursor: 'pointer', alignSelf: 'flex-start' }} disabled={saving}>
                            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
