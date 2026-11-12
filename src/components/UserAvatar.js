'use client';

import { useState } from 'react';
import styles from './UserAvatar.module.css';

function AvatarImage({ src, alt, initials }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span>{initials}</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={styles.img}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export default function UserAvatar({ user, size = 'md', className = '', fallback = 'AK' }) {
  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : fallback;

  const rawUrl = typeof user?.avatarUrl === 'string' ? user.avatarUrl.trim() : '';
  const safeUrl = rawUrl.startsWith('/') || /^https:\/\//i.test(rawUrl) ? rawUrl : '';
  const sizeClass = styles[size] || styles.md;

  return (
    <span className={`${styles.root} ${sizeClass} ${className}`.trim()}>
      {safeUrl ? (
        <AvatarImage key={safeUrl} src={safeUrl} alt={user?.name || 'Foto profil'} initials={initials} />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}

