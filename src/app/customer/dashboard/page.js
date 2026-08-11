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

    const iconPin = (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="28" height="28">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
    );
    const iconPackage = (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="28" height="28">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
    );
    const iconLock = (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width="28" height="28">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
    );

    const shortcuts = [
        { href: '/customer/addresses',        icon: iconPin,     title: 'Alamat Saya',  desc: 'Kelola alamat pengiriman tersimpan' },
        { href: '/customer/orders',           icon: iconPackage, title: 'Pesanan Saya', desc: 'Lacak status pesanan kamu' },
        { href: '/customer/settings/password', icon: iconLock,   title: 'Ubah Password', desc: 'Ganti password akun kamu' },
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

