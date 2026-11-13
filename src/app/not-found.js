import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '75vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        background: 'var(--bg-card, rgba(18, 20, 26, 0.75))',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        borderRadius: '20px',
        padding: '40px 28px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          margin: '0 auto 20px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Image src="/img/logo.png" alt="SUMDE BETTA" width={40} height={40} style={{ objectFit: 'contain' }} />
        </div>

        <div style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '9999px',
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          color: 'var(--primary, #d4af37)',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}>
          Error 404
        </div>

        <h1 style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          color: 'var(--text-main, #f3f4f6)',
          marginBottom: '10px',
        }}>
          Halaman Tidak Ditemukan
        </h1>

        <p style={{
          fontSize: '0.9rem',
          lineHeight: '1.6',
          color: 'var(--text-muted, #9ca3af)',
          marginBottom: '28px',
        }}>
          Koleksi atau tautan yang Anda tuju mungkin telah dipindahkan atau tidak tersedia saat ini.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 20px',
              borderRadius: '12px',
              background: 'var(--primary, #d4af37)',
              color: '#090a0d',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.25)',
            }}
          >
            Kembali ke Beranda
          </Link>

          <Link
            href="/produk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 20px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
              color: 'var(--text-main, #e5e7eb)',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            Lihat Koleksi Ikan
          </Link>
        </div>
      </div>
    </div>
  );
}
