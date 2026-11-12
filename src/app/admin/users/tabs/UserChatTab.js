'use client';

import Link from 'next/link';
import styles from '../users.module.css';

export default function UserChatTab({ conversations = [] }) {
  if (!conversations || conversations.length === 0) {
    return (
      <div className={styles.tabEmptyState}>
        <svg className={styles.tabEmptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <h4 className={styles.tabEmptyTitle}>Belum Ada Percakapan Chat</h4>
        <p className={styles.tabEmptyDesc}>
          Pengguna belum pernah mengirim pesan atau berinteraksi via widget Live Chat.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.chatSessionsList}>
      {conversations.map((conv) => {
        const isOpen = conv.status === 'OPEN';
        const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[0] : null;

        return (
          <div key={conv.id} className={styles.chatSessionCard}>
            <div className={styles.chatSessionTop}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  className={`${styles.chatStatusBadge} ${
                    isOpen ? styles.chatStatusOpen : styles.chatStatusClosed
                  }`}
                >
                  {isOpen ? 'AKTIF / TERBUKA' : 'DITUTUP'}
                </span>
                {conv.unreadAdminCount > 0 && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      background: '#EF4444',
                      color: '#ffffff',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '999px',
                    }}
                  >
                    {conv.unreadAdminCount} Belum Dibaca
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Aktivitas terakhir:{' '}
                  {new Date(conv.lastMessageAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB
                </span>
              </div>

              <Link
                href={`/admin/chat?conversationId=${conv.id}`}
                target="_blank"
                className={styles.btnSecondarySmall}
                style={{ textDecoration: 'none' }}
              >
                Buka di Live Chat
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </Link>
            </div>

            {lastMsg ? (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Pesan Terakhir ({lastMsg.senderRole}):
                </div>
                <div className={styles.chatSnippet}>{lastMsg.message}</div>
              </div>
            ) : (
              <div className={styles.chatSnippet} style={{ fontStyle: 'italic' }}>
                Tidak ada riwayat pesan snapshot.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
