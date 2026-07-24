'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './dashboard.module.css';

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
                // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate form with user profile when loaded
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
            <div className="pageContainer pt-[120px] text-center">
                <h2 className="text-[var(--text-muted)]">Memverifikasi akun...</h2>
            </div>
        );
    }

    const shortcuts = [
        { href: '/customer/addresses', icon: '📍', title: 'Alamat Saya', desc: 'Kelola alamat pengiriman tersimpan' },
        { href: '/customer/orders',    icon: '📦', title: 'Pesanan Saya', desc: 'Lacak status pesanan kamu' },
    ];

    return (
        <div className={`pageContainer ${styles.pagePadding}`}>
            <div className={`container ${styles.containerWrapper}`}>

                {/* Header */}
                <div className={styles.headerSection}>
                    <span className="text-[var(--primary)] tracking-[0.2rem] text-[0.75rem] font-bold uppercase">Customer Area</span>
                    <h1 className="font-[var(--font-serif)] text-[2.5rem] italic mt-[0.4rem] text-[var(--text-main)]">
                        Halo, {currentUser.name.split(' ')[0]}
                    </h1>
                </div>

                {/* Shortcut Cards */}
                <div className="grid-shortcut">
                    {shortcuts.map(s => (
                        <Link key={s.href} href={s.href} className={styles.shortcutCard}>
                            <span className={styles.shortcutIcon}>{s.icon}</span>
                            <span className={styles.shortcutTitle}>{s.title}</span>
                            <span className={styles.shortcutDesc}>{s.desc}</span>
                        </Link>
                    ))}
                </div>

                {/* Edit Profile Form */}
                <div className="dashboard-card">
                    <h3 className={styles.formTitle}>Edit Profil</h3>

                    {success && (
                        <div className={styles.successAlert}>
                            Profil berhasil diperbarui!
                        </div>
                    )}
                    {error && (
                        <div className={styles.errorAlert}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className={styles.formGroup}>
                        <div>
                            <label className={styles.label}>Email</label>
                            <input className={`${styles.input} ${styles.inputReadOnly}`} value={currentUser.email} readOnly />
                            <span className={styles.hintText}>Email tidak dapat diubah</span>
                        </div>
                        <div>
                            <label className={styles.label}>Nama Lengkap</label>
                            <input className={styles.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Nama lengkap kamu" />
                        </div>
                        <div>
                            <label className={styles.label}>Nomor Telepon</label>
                            <input className={styles.input} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
                        </div>
                        <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={saving}>
                            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

