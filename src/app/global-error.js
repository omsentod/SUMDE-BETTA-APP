'use client';

import { useEffect } from 'react';
import Image from 'next/image';

export default function RootGlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Root global error:', error);
  }, [error]);
  return (
    <html lang="id">
      <body style={{
        backgroundColor: '#090a0d',
        color: '#f3f4f6',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        margin: 0,
        padding: '24px 16px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}>
        <div style={{
          maxWidth: '460px',
          width: '100%',
          background: 'rgba(18, 20, 26, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '40px 28px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
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
            color: '#d4af37',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            Layanan Sistem
          </div>

          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 10px 0',
          }}>
            Sedang Menyiapkan Tampilan
          </h1>

          <p style={{
            fontSize: '0.9rem',
            lineHeight: '1.6',
            color: '#9ca3af',
            margin: '0 0 28px 0',
          }}>
            Sistem kami sedang menyelaraskan antrean data. Silakan tekan tombol di bawah untuk memuat ulang.
          </p>

          <button
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '13px 20px',
              borderRadius: '12px',
              background: '#d4af37',
              color: '#090a0d',
              fontWeight: 600,
              fontSize: '0.92rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.25)',
            }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      </body>
    </html>
  );
}
